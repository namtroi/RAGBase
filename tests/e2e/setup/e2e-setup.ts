import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import type { FastifyInstance } from 'fastify';
import { Client } from 'pg';
import { createApp } from '../../../apps/backend/src/app.js';
import { closeQueue, createProcessingQueue } from '../../../apps/backend/src/queue/processing-queue.js';
import { getPrisma } from '../../helpers/database.js';

let postgresContainer: any;
let redisContainer: any;
let app: FastifyInstance;

export async function setupE2E() {
  console.log('🚀 Starting E2E environment setup...');

  // Start containers in parallel
  console.log('📦 Starting PostgreSQL and Redis containers...');
  [postgresContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('test')
      .withUsername('test')
      .withPassword('test')
      .start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);

  console.log('✅ Containers started');

  // Set environment variables
  process.env.DATABASE_URL = postgresContainer.getConnectionUri();
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getPort()}`;
  process.env.API_KEY = 'e2e-test-key';
  process.env.UPLOAD_DIR = '/tmp/e2e-uploads';
  process.env.NODE_ENV = 'test';

  console.log('🔧 Environment configured');
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log(`   REDIS_URL: ${process.env.REDIS_URL}`);

  // Initialize database with pgvector extension
  console.log('🔌 Initializing pgvector extension...');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  await client.end();

  console.log('✅ pgvector extension created');

  // Push Prisma schema (faster and more reliable for tests)
  console.log('🗄️  Pushing Prisma schema...');
  try {
    execSync('pnpm --filter @schemaforge/backend db:push', {
      shell: true,  // Required for Windows compatibility
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      cwd: process.cwd(),  // Run from root directory
      stdio: 'inherit',
    });
    console.log('✅ Schema pushed');
  } catch (error) {
    console.error('❌ Schema push failed:', error);
    throw error;
  }

  // Create Fastify app
  console.log('🚀 Creating Fastify app...');
  app = await createApp();
  await app.ready();
  console.log('✅ Fastify app ready');

  // Initialize queue
  console.log('📬 Initializing BullMQ queue...');
  createProcessingQueue();
  console.log('✅ Queue initialized');

  console.log('🎉 E2E environment setup complete!');

  return { app, postgresContainer, redisContainer };
}

export async function teardownE2E() {
  console.log('🧹 Tearing down E2E environment...');

  try {
    await closeQueue();
    console.log('✅ Queue closed');
  } catch (error) {
    console.error('⚠️  Queue close error:', error);
  }

  try {
    await app?.close();
    console.log('✅ App closed');
  } catch (error) {
    console.error('⚠️  App close error:', error);
  }

  try {
    await getPrisma().$disconnect();
    console.log('✅ Prisma disconnected');
  } catch (error) {
    console.error('⚠️  Prisma disconnect error:', error);
  }

  try {
    await postgresContainer?.stop();
    console.log('✅ PostgreSQL container stopped');
  } catch (error) {
    console.error('⚠️  PostgreSQL stop error:', error);
  }

  try {
    await redisContainer?.stop();
    console.log('✅ Redis container stopped');
  } catch (error) {
    console.error('⚠️  Redis stop error:', error);
  }

  console.log('🎉 E2E teardown complete!');
}

export function getTestApp(): FastifyInstance {
  if (!app) {
    throw new Error('E2E environment not initialized. Call setupE2E() first.');
  }
  return app;
}

export const API_KEY = 'e2e-test-key';
