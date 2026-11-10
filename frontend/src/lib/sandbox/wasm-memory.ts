// Mirrors the backend's src/judge/sandbox/wasm-memory.ts.
const PAGE_BYTES = 64 * 1024;
const MEMORY_SECTION = 5;

function readLeb(bytes: Uint8Array, at: number): [value: number, next: number] {
  let value = 0;
  let shift = 0;
  let i = at;
  for (;;) {
    const byte = bytes[i++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return [value, i];
    shift += 7;
  }
}

function leb(value: number): number[] {
  const out: number[] = [];
  let rest = value;
  do {
    let byte = rest & 0x7f;
    rest = Math.floor(rest / 128);
    if (rest > 0) byte |= 0x80;
    out.push(byte);
  } while (rest > 0);
  return out;
}

/**
 * Returns a copy of a WebAssembly module whose own memory can never grow past
 * `maxBytes`. A program that asks for more gets a failed allocation (Python
 * raises MemoryError) instead of taking the host's memory.
 */
export function capMemory(
  module: Uint8Array,
  maxBytes: number,
): Uint8Array<ArrayBuffer> {
  const maxPages = Math.floor(maxBytes / PAGE_BYTES);
  let at = 8; // magic number and version
  while (at < module.length) {
    const id = module[at];
    const [size, body] = readLeb(module, at + 1);
    if (id === MEMORY_SECTION) {
      const [count, first] = readLeb(module, body);
      if (count !== 1) throw new Error('Expected exactly one memory');
      const flags = module[first];
      if (flags !== 0 && flags !== 1) {
        throw new Error('Shared or 64-bit memory is not supported');
      }
      const [min, afterMin] = readLeb(module, first + 1);
      const end = flags === 1 ? readLeb(module, afterMin)[1] : afterMin;
      const content = [
        ...leb(1),
        1,
        ...leb(Math.min(min, maxPages)),
        ...leb(maxPages),
      ];
      const out = new Uint8Array(
        module.length -
          (end - at) +
          1 +
          leb(content.length).length +
          content.length,
      );
      out.set(module.subarray(0, at), 0);
      out.set([MEMORY_SECTION, ...leb(content.length), ...content], at);
      out.set(
        module.subarray(end),
        at + 1 + leb(content.length).length + content.length,
      );
      return out;
    }
    at = body + size;
  }
  throw new Error('The module defines no memory of its own');
}
