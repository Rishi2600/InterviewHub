import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AVATAR_TYPES, hasImageSignature, readFileHead } from './avatar-file';

const SAMPLES: Record<string, Buffer> = {
  'image/png': Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
  ]),
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]),
  'image/gif': Buffer.from('GIF89a\x01\x00', 'latin1'),
  'image/webp': Buffer.from('RIFF\x24\x00\x00\x00WEBP', 'latin1'),
};
const HTML = Buffer.from('<html><script>alert(1)</script>');

describe('avatar file checks', () => {
  it('maps every allowed type to a fixed extension', () => {
    expect(AVATAR_TYPES).toEqual({
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
    });
  });

  it.each(Object.keys(SAMPLES))('accepts a real %s', (type) => {
    expect(hasImageSignature(SAMPLES[type], type)).toBe(true);
  });

  it.each(Object.keys(SAMPLES))('rejects HTML labelled %s', (type) => {
    expect(hasImageSignature(HTML, type)).toBe(false);
  });

  it('rejects one image format labelled as another', () => {
    expect(hasImageSignature(SAMPLES['image/gif'], 'image/png')).toBe(false);
  });

  it('rejects types outside the allowlist and empty files', () => {
    expect(hasImageSignature(SAMPLES['image/png'], 'image/svg+xml')).toBe(
      false,
    );
    expect(hasImageSignature(Buffer.alloc(0), 'image/png')).toBe(false);
  });

  it('reads at most the first 12 bytes of a file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'avatar-'));
    try {
      const path = join(dir, 'f');
      await writeFile(path, Buffer.concat([SAMPLES['image/png'], HTML]));
      const head = await readFileHead(path);
      expect(head).toHaveLength(12);
      expect(hasImageSignature(head, 'image/png')).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
