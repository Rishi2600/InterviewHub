import { capMemory } from './wasm-memory';

// (module (memory (export "memory") 1)) written out by hand: one page to
// start, no maximum.
const MODULE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  // memory section: one memory, no max, min 1 page
  0x05, 0x03, 0x01, 0x00, 0x01,
  // export section: "memory" -> memory 0
  0x07, 0x0a, 0x01, 0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00,
]);
const PAGE = 64 * 1024;

function memoryOf(bytes: Uint8Array<ArrayBuffer>): WebAssembly.Memory {
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes));
  return instance.exports.memory as WebAssembly.Memory;
}

describe('capMemory', () => {
  it('lets memory grow without limit before the cap', () => {
    const memory = memoryOf(MODULE);
    expect(() => memory.grow(10)).not.toThrow();
  });

  it('stops memory growing past the cap', () => {
    const memory = memoryOf(capMemory(MODULE, 4 * PAGE));
    expect(() => memory.grow(3)).not.toThrow();
    expect(() => memory.grow(1)).toThrow(RangeError);
    expect(memory.buffer.byteLength).toBe(4 * PAGE);
  });

  it('keeps the rest of the module working', () => {
    const capped = capMemory(MODULE, 2 * PAGE);
    expect(WebAssembly.Module.exports(new WebAssembly.Module(capped))).toEqual([
      { name: 'memory', kind: 'memory' },
    ]);
  });

  it('refuses a module without its own memory', () => {
    const empty = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ]);
    expect(() => capMemory(empty, PAGE)).toThrow('no memory');
  });
});
