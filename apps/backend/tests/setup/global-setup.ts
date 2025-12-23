import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

let postgresContainer: any;
let redisContainer: any;

export async function setup() {
  console.log('🚀 Starting test containers...');

  // Start containers once for all tests
  postgresContainer = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  redisContainer = await new RedisContainer('redis:7-alpine').start();

  // Set env vars for tests
  process.env.DATABASE_URL = postgresContainer.getConnectionUri();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();
  process.env.API_KEY = 'test-api-key';

  console.log('✅ PostgreSQL:', process.env.DATABASE_URL);
  console.log('✅ Redis:', process.env.REDIS_URL);

  // Enable pgvector extension
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  await client.end();

  console.log('✅ pgvector extension enabled');

  // Run Prisma migrations
  const { execSync } = await import('child_process');
  execSync('pnpm db:push', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'inherit',
  });

  console.log('✅ Prisma migrations applied');

  // Return cleanup function
  return async () => {
    console.log('🧹 Stopping test containers...');
    await postgresContainer.stop();
    await redisContainer.stop();
    console.log('✅ Containers stopped');
  };
}

export async function teardown() {
  // Handled by returned function from setup
}
