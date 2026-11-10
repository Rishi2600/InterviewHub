import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIMITS } from '../../common/validation/limits';
import { capMemory } from './wasm-memory';
import { unpack } from './pack';
import { RunLimits, RunResult } from './types';

type Shim = typeof import('@bjorn3/browser_wasi_shim');
type Inode = InstanceType<Shim['Inode']>;

/** Filled by `npm run runtimes:python`; see scripts/fetch-python.ts. */
export const PYTHON_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'runtimes',
  'python',
);

export function pythonInstalled(): boolean {
  return existsSync(join(PYTHON_DIR, 'python.wasm'));
}

interface PythonRuntime {
  shim: Shim;
  module: WebAssembly.Module;
  lib: Inode;
  preopen: (contents: Map<string, Inode>) => InstanceType<Shim['Fd']>;
}

class OutputLimit extends Error {}

let loading: Promise<PythonRuntime> | null = null;

/** Compiles CPython once per worker, with its memory capped. */
export function loadPython(): Promise<PythonRuntime> {
  loading ??= (async () => {
    // ESM-only package: loaded here so nothing else in the judge needs it.
    const shim = await import('@bjorn3/browser_wasi_shim');
    const wasm = capMemory(
      readFileSync(join(PYTHON_DIR, 'python.wasm')),
      LIMITS.code.memoryBytes,
    );
    const module = await WebAssembly.compile(wasm);
    const { Directory, preopen } = readOnlyFs(shim);
    const files = unpack(readFileSync(join(PYTHON_DIR, 'lib.pack')));
    return { shim, module, lib: buildTree(shim, Directory, files), preopen };
  })();
  return loading;
}

/**
 * Directories the program can list and read but never change: no new files,
 * no deletes, no writes. Its only writable outputs are stdout and stderr.
 */
function readOnlyFs(shim: Shim) {
  const { wasi } = shim;
  const ROFS = wasi.ERRNO_ROFS;
  const WRITE = BigInt(wasi.RIGHTS_FD_WRITE);
  const CHANGES = wasi.OFLAGS_CREAT | wasi.OFLAGS_TRUNC;

  class ReadOnlyOpenDirectory extends shim.OpenDirectory {
    path_open(
      dirflags: number,
      path: string,
      oflags: number,
      rightsBase: bigint,
      rightsInheriting: bigint,
      fdflags: number,
    ) {
      if (oflags & CHANGES || BigInt(rightsBase) & WRITE) {
        return { ret: ROFS, fd_obj: null };
      }
      return super.path_open(
        dirflags,
        path,
        oflags,
        rightsBase,
        rightsInheriting,
        fdflags,
      );
    }
    path_create_directory() {
      return ROFS;
    }
    path_link() {
      return ROFS;
    }
    path_unlink() {
      return { ret: ROFS, inode_obj: null };
    }
    path_unlink_file() {
      return ROFS;
    }
    path_remove_directory() {
      return ROFS;
    }
  }

  class Directory extends shim.Directory {
    path_open() {
      return {
        ret: wasi.ERRNO_SUCCESS,
        fd_obj: new ReadOnlyOpenDirectory(this),
      };
    }
  }

  class Preopen extends ReadOnlyOpenDirectory {
    fd_prestat_get() {
      return { ret: 0, prestat: wasi.Prestat.dir('/') };
    }
  }

  return {
    Directory,
    preopen: (contents: Map<string, Inode>) =>
      new Preopen(new Directory(contents)),
  };
}

/** Turns "python3.15/os.py" style paths into a read-only directory tree. */
function buildTree(
  shim: Shim,
  Directory: new (contents: Map<string, Inode>) => Inode,
  files: Map<string, Uint8Array>,
): Inode {
  type Node = Map<string, Node | Uint8Array>;
  const root: Node = new Map();
  for (const [path, data] of files) {
    const parts = path.split('/');
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let next = dir.get(part);
      if (!(next instanceof Map)) {
        next = new Map();
        dir.set(part, next);
      }
      dir = next;
    }
    dir.set(parts[parts.length - 1], data);
  }
  // CPython looks for this folder (compiled extensions) and warns on stderr
  // when it's missing. The pack only holds files, so add it back, empty.
  for (const [name, child] of root) {
    if (/^python3\.\d+$/.test(name) && child instanceof Map) {
      if (!child.has('lib-dynload')) child.set('lib-dynload', new Map());
    }
  }
  const build = (node: Node): Inode =>
    new Directory(
      new Map(
        [...node].map(([name, child]) => [
          name,
          child instanceof Map
            ? build(child)
            : new shim.File(child, { readonly: true }),
        ]),
      ),
    );
  return build(root);
}

/**
 * Runs one Python program on one input in a fresh CPython instance. Python
 * has no hook to stop itself, so the time limit is enforced from outside, by
 * the worker pool (or the browser) terminating the worker.
 */
export async function runPython(
  code: string,
  stdin: string,
  limits: RunLimits,
): Promise<RunResult> {
  const started = Date.now();
  const { shim, module, lib, preopen } = await loadPython();
  const encoder = new TextEncoder();
  const decoder = () => new TextDecoder('utf-8', { fatal: false });
  const out = decoder();
  const err = decoder();
  let stdout = '';
  let stderr = '';
  let written = 0;

  // Both streams share the output cap. Going past it ends the run at once;
  // an exception thrown here unwinds straight out of the WebAssembly.
  const sink = (toStderr: boolean) =>
    new shim.ConsoleStdout((data) => {
      const room = limits.outputBytes - written;
      const kept = data.byteLength > room ? data.subarray(0, room) : data;
      written += kept.byteLength;
      const text = (toStderr ? err : out).decode(kept, { stream: true });
      if (toStderr) stderr += text;
      else stdout += text;
      if (data.byteLength > room) throw new OutputLimit();
    });

  const fds = [
    new shim.OpenFile(new shim.File(encoder.encode(stdin), { readonly: true })),
    sink(false),
    sink(true),
    preopen(
      new Map<string, Inode>([
        ['main.py', new shim.File(encoder.encode(code), { readonly: true })],
        ['lib', lib],
      ]),
    ),
  ];
  const wasi = new shim.WASI(
    ['python', '-S', '-B', '/main.py'],
    // No colour codes in tracebacks: stderr is shown as plain text.
    ['PYTHONHOME=/', 'PYTHON_COLORS=0'],
    fds,
    { debug: false },
  );
  const instance = (await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  })) as Parameters<typeof wasi.start>[0];

  const result = (verdict: RunResult['verdict']): RunResult => ({
    verdict,
    stdout,
    stderr,
    ms: Date.now() - started,
  });

  let exitCode: number;
  try {
    exitCode = wasi.start(instance);
  } catch (error) {
    if (error instanceof OutputLimit) return result('output');
    if (error instanceof shim.WASIProcExit) {
      exitCode = error.code;
    } else {
      // A trap: usually the host stack, from very deep recursion.
      stderr += error instanceof Error ? error.message : String(error);
      return result('error');
    }
  }
  if (exitCode === 0) return result('ok');
  return result(/MemoryError\s*$/.test(stderr) ? 'memory' : 'error');
}
