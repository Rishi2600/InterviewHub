// Empties the local dev database and the uploads folder.
// Usage: npm run db:wipe [-- --yes]
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import mongoose from 'mongoose';
import { fail, localMongoUri } from './safety';

const UPLOADS = join(__dirname, '..', 'uploads');

/** Deletes every file under dir, keeping the folders the app writes into. */
async function clearFiles(dir: string): Promise<number> {
  let removed = 0;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) removed += await clearFiles(path);
    else if (entry.name !== '.gitkeep') {
      await rm(path);
      removed++;
    }
  }
  return removed;
}

async function main() {
  const uri = localMongoUri();
  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.db!;

  if (!process.argv.includes('--yes')) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const typed = await rl.question(
      `This deletes every document in "${db.databaseName}" and every uploaded file.\n` +
        `Type the database name to confirm: `,
    );
    rl.close();
    if (typed.trim() !== db.databaseName) {
      await conn.close();
      fail('Name did not match. Nothing was deleted.');
    }
  }

  // Emptied rather than dropped, so the indexes stay in place.
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`${name}: ${deletedCount} deleted`);
  }
  await conn.close();

  console.log(`uploads: ${await clearFiles(UPLOADS)} files deleted`);
  console.log('Done.');
}

void main();
