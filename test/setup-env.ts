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
// Redis is off unless REDIS_URL_TEST names a test Redis (npm run
// test:e2e:redis), so both modes run the same tests.
const redisUrl = process.env.REDIS_URL_TEST;
process.env.REDIS_ENABLED = redisUrl ? 'true' : 'false';
if (redisUrl) process.env.REDIS_URL = redisUrl;
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:5173';
// AI practice: never the real Groq (tests pass a fake), and small numbers.
process.env.GROQ_API_KEY = '';
process.env.AI_MODELS = 'fake-model';
process.env.AI_DAILY_REQUESTS = '1000';
process.env.AI_DAILY_TOKENS = '300000';
process.env.AI_TOKENS_PER_INTERVIEW = '30000';
process.env.AI_MAX_RUNNING = '5';
