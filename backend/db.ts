import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 3,  // Maximum number of connections in the pool
  min: 1,  // Minimum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000 // Return error after 2 seconds if connection cannot be established
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process, let it retry
});

// Add connection retry logic
pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('remove', () => {
  console.log('Database connection removed from pool');
});

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
