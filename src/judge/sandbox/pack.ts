/**
 * Python's standard library is hundreds of small files. They travel as one
 * "pack": a 4-byte header length, a JSON index of [path, offset, length],
 * then the file bytes. One read on the server, one download in the browser.
 */
export function pack(files: Map<string, Uint8Array>): Uint8Array {
  const index: [string, number, number][] = [];
  let offset = 0;
  for (const [path, data] of files) {
    index.push([path, offset, data.byteLength]);
    offset += data.byteLength;
  }
  const header = new TextEncoder().encode(JSON.stringify(index));
  const out = new Uint8Array(4 + header.byteLength + offset);
  new DataView(out.buffer).setUint32(0, header.byteLength, true);
  out.set(header, 4);
  let at = 4 + header.byteLength;
  for (const data of files.values()) {
    out.set(data, at);
    at += data.byteLength;
  }
  return out;
}

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
