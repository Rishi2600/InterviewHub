// Downloads the pinned CPython WebAssembly build, checks its hash, and lays
// it out for the judge (runtimes/python) and the browser (frontend/public).
// Run with: npm run runtimes:python

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pack } from '../src/judge/sandbox/pack';

// CPython 3.15.2 built for WASI by Brett Cannon (CPython core developer).
const VERSION = '3.15.2';
const URL = `https://github.com/brettcannon/cpython-wasi-build/releases/download/v${VERSION}/python-${VERSION}-wasi_sdk-33.zip`;
const SHA256 =
  'b8a63559c56760bbdc310dedb74fd69d10bcbafae26b705bea0ad353ad256888';

const ROOT = join(__dirname, '..');
const TARGETS = [
  join(ROOT, 'runtimes', 'python'),
  join(ROOT, 'frontend', 'public', 'runtimes', 'python'),
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === '__pycache__') return [];
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

async function main() {
  console.log(`Downloading CPython ${VERSION} for WASI…`);
  const response = await fetch(URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const zip = Buffer.from(await response.arrayBuffer());
  const hash = createHash('sha256').update(zip).digest('hex');
  if (hash !== SHA256) {
    throw new Error(`Hash mismatch: expected ${SHA256}, got ${hash}`);
  }

  const work = mkdtempSync(join(tmpdir(), 'interviewhub-python-'));
  try {
    writeFileSync(join(work, 'python.zip'), zip);
    execFileSync('unzip', [
      '-q',
      join(work, 'python.zip'),
      '-d',
      join(work, 'x'),
    ]);

    const libRoot = join(work, 'x', 'lib');
    const lib = new Map(
      filesUnder(libRoot).map((path) => [
        relative(libRoot, path).split('\\').join('/'),
        new Uint8Array(readFileSync(path)),
      ]),
    );
    const packed = pack(lib);

    for (const target of TARGETS) {
      rmSync(target, { recursive: true, force: true });
      mkdirSync(target, { recursive: true });
      cpSync(join(work, 'x', 'python.wasm'), join(target, 'python.wasm'));
      cpSync(join(work, 'x', 'LICENSE'), join(target, 'LICENSE'));
      writeFileSync(join(target, 'lib.pack'), packed);
      writeFileSync(join(target, 'VERSION'), `${VERSION}\n`);
      console.log(
        `Wrote ${relative(ROOT, target)} (${lib.size} library files)`,
      );
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
