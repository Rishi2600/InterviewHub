// Guards for the dev database scripts: they only ever touch a local database.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Returns MONGODB_URI, or exits if it is unset, production, or not local. */
export function localMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) fail('MONGODB_URI is not set (see .env).');
  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV is production. These scripts are for development only.');
  }
  if (!uri.startsWith('mongodb://')) {
    fail('Only a local mongodb:// database is allowed, not mongodb+srv://.');
  }
  // mongodb://user:pass@host1:port,host2:port/db?options
  const hosts = uri
    .slice('mongodb://'.length)
    .split('/')[0]
    .split('@')
    .pop()!
    .split(',')
    .map((h) => h.replace(/:\d+$/, ''));
  const remote = hosts.filter((h) => !LOCAL_HOSTS.has(h));
  if (remote.length > 0) {
    fail(`Refusing to touch a non-local database (${remote.join(', ')}).`);
  }
  return uri;
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
