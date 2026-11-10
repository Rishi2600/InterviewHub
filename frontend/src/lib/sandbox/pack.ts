// Mirrors the backend's src/judge/sandbox/pack.ts (reading only).
export function unpack(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(0, true);
  const index = JSON.parse(
    new TextDecoder().decode(bytes.subarray(4, 4 + length)),
  ) as [string, number, number][];
  const start = 4 + length;
  return new Map(
    index.map(([path, offset, size]) => [
      path,
      bytes.subarray(start + offset, start + offset + size),
    ]),
  );
}
