import { open } from 'fs/promises';

/**
 * The only image types accepted as avatars, each with the extension it is
 * stored under. The extension never comes from the uploaded filename.
 */
export const AVATAR_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/** True if the first bytes of the file match the format it claims to be. */
export function hasImageSignature(head: Buffer, mimetype: string): boolean {
  const ascii = (start: number, end: number) =>
    head.subarray(start, end).toString('latin1');
  switch (mimetype) {
    case 'image/png':
      return head
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case 'image/gif':
      return ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a';
    case 'image/webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    default:
      return false;
  }
}

/** Reads the first bytes of a file on disk, enough for any check above. */
export async function readFileHead(path: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
