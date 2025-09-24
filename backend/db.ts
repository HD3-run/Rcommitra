import { Pool } from 'pg';
import { logger } from './utils/logger.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production' ? 
      (process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false') : false
  },
  max: 20,  // Increased for better concurrency
  min: 5,   // Keep more connections ready
  idleTimeoutMillis: 10000, // Faster cleanup
  connectionTimeoutMillis: 1000, // Faster timeout
  statement_timeout: 5000, // 5 second query timeout
  query_timeout: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err.message);
  // Don't exit process, let it retry
});

// Add connection retry logic
pool.on('connect', () => {
  logger.info('Database connected successfully');
});

pool.on('remove', () => {
  logger.info('Database connection removed from pool');
});

// Connection pool metrics for monitoring
export function getPoolMetrics() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

// Emergency fallback for when pool is exhausted
export async function getEmergencyConnection() {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

export default pool;
export { pool };
