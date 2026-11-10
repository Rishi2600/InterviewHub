// The browser side of the backend's src/judge/sandbox/python.ts: the same
// CPython build, memory cap and read-only files, fetched from
// /runtimes/python (see scripts/fetch-python.ts in the backend).
import * as shim from '@bjorn3/browser_wasi_shim'
import { capMemory } from './wasm-memory'
import { unpack } from './pack'
import type { RunLimits, RunResult } from './types'

type Inode = InstanceType<typeof shim.Inode>

const BASE = `${import.meta.env.BASE_URL}runtimes/python`
const MEMORY_BYTES = 256 * 1024 * 1024

class OutputLimit extends Error {}

const { wasi } = shim
const ROFS = wasi.ERRNO_ROFS
const WRITE = BigInt(wasi.RIGHTS_FD_WRITE)
const CHANGES = wasi.OFLAGS_CREAT | wasi.OFLAGS_TRUNC

/** Directories the program can list and read but never change. */
class ReadOnlyOpenDirectory extends shim.OpenDirectory {
  path_open(
    dirflags: number,
    path: string,
    oflags: number,
    rightsBase: bigint,
    rightsInheriting: bigint,
    fdflags: number,
  ) {
    if (oflags & CHANGES || BigInt(rightsBase) & WRITE) return { ret: ROFS, fd_obj: null }
    return super.path_open(dirflags, path, oflags, rightsBase, rightsInheriting, fdflags)
  }
  path_create_directory() {
    return ROFS
  }
  path_link() {
    return ROFS
  }
  path_unlink() {
    return { ret: ROFS, inode_obj: null }
  }
  path_unlink_file() {
    return ROFS
  }
  path_remove_directory() {
    return ROFS
  }
}

class ReadOnlyDirectory extends shim.Directory {
  path_open() {
    return { ret: wasi.ERRNO_SUCCESS, fd_obj: new ReadOnlyOpenDirectory(this) }
  }
}

class Preopen extends ReadOnlyOpenDirectory {
  fd_prestat_get() {
    return { ret: 0, prestat: wasi.Prestat.dir('/') }
  }
}

function buildTree(files: Map<string, Uint8Array>): Inode {
  type Node = Map<string, Node | Uint8Array>
  const root: Node = new Map()
  for (const [path, data] of files) {
    const parts = path.split('/')
    let dir = root
    for (const part of parts.slice(0, -1)) {
      let next = dir.get(part)
      if (!(next instanceof Map)) {
        next = new Map()
        dir.set(part, next)
      }
      dir = next
    }
    dir.set(parts[parts.length - 1], data)
  }
  const build = (node: Node): Inode =>
    new ReadOnlyDirectory(
      new Map(
        [...node].map(([name, child]) => [
          name,
          child instanceof Map ? build(child) : new shim.File(child, { readonly: true }),
        ]),
      ),
    )
  return build(root)
}

async function fetchBytes(name: string): Promise<Uint8Array> {
  const res = await fetch(`${BASE}/${name}`)
  if (!res.ok) throw new Error('Python is not installed on this server yet.')
  return new Uint8Array(await res.arrayBuffer())
}

let loading: Promise<{ module: WebAssembly.Module; lib: Inode }> | null = null

/** Downloads and compiles CPython once per worker. A few seconds the first
 *  time; the browser caches the files after that. */
export function loadPython() {
  loading ??= (async () => {
    const [wasm, pack] = await Promise.all([fetchBytes('python.wasm'), fetchBytes('lib.pack')])
    const module = await WebAssembly.compile(capMemory(wasm, MEMORY_BYTES))
    return { module, lib: buildTree(unpack(pack)) }
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}

/** Runs one program on one input in a fresh CPython instance. The time limit
 *  is enforced from outside: the page terminates this worker. */
export async function runPython(code: string, stdin: string, limits: RunLimits): Promise<RunResult> {
  const { module, lib } = await loadPython()
  const started = performance.now()
  const encoder = new TextEncoder()
  const out = new TextDecoder()
  const err = new TextDecoder()
  let stdout = ''
  let stderr = ''
  let written = 0

  const sink = (toStderr: boolean) =>
    new shim.ConsoleStdout((data) => {
      const room = limits.outputBytes - written
      const kept = data.byteLength > room ? data.subarray(0, room) : data
      written += kept.byteLength
      const text = (toStderr ? err : out).decode(kept, { stream: true })
      if (toStderr) stderr += text
      else stdout += text
      if (data.byteLength > room) throw new OutputLimit()
    })

  const fds = [
    new shim.OpenFile(new shim.File(encoder.encode(stdin), { readonly: true })),
    sink(false),
    sink(true),
    new Preopen(
      new ReadOnlyDirectory(
        new Map<string, Inode>([
          ['main.py', new shim.File(encoder.encode(code), { readonly: true })],
          ['lib', lib],
        ]),
      ),
    ),
  ]
  const process = new shim.WASI(['python', '-S', '-B', '/main.py'], ['PYTHONHOME=/'], fds, { debug: false })
  const instance = (await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: process.wasiImport,
  })) as Parameters<typeof process.start>[0]

  const result = (verdict: RunResult['verdict']): RunResult => ({
    verdict,
    stdout,
    stderr,
    ms: Math.round(performance.now() - started),
  })

  let exitCode: number
  try {
    exitCode = process.start(instance)
  } catch (error) {
    if (error instanceof OutputLimit) return result('output')
    if (error instanceof shim.WASIProcExit) exitCode = error.code
    else {
      stderr += error instanceof Error ? error.message : String(error)
      return result('error')
    }
  }
  if (exitCode === 0) return result('ok')
  return result(/MemoryError\s*$/.test(stderr) ? 'memory' : 'error')
}
