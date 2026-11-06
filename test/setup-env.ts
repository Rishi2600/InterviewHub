// Runs before every end-to-end test file, before the app reads its config.
// Values set here win over .env, so the tests never touch the dev database.

const uri =
  process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27018/interviewhub_test';
const dbName = new URL(uri).pathname.replace(/^\//, '');

// Each test file wipes the database, so refuse anything that is not
// clearly a test database.
if (!dbName.endsWith('_test')) {
  throw new Error(
    `Refusing to run end-to-end tests against "${dbName}": the database name must end in _test.`,
  );
}

process.env.MONGODB_URI = uri;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'end-to-end-test-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REDIS_ENABLED = 'false';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:5173';
