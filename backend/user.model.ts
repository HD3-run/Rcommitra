import pool from './db.ts';
import crypto from 'crypto';
import { promisify } from 'util';
import { logger } from './utils/logger.ts';

const pbkdf2 = promisify(crypto.pbkdf2);

export interface User {
  user_id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await pbkdf2(password, salt, 100000, 64, 'sha512');
    return salt + ':' + derivedKey.toString('hex');
  } catch (error) {
    logger.error('Password hashing failed', error instanceof Error ? error.message : String(error));
    throw new Error('Password hashing failed');
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(':');
    if (!salt || !key) {
      return false;
    }
    const derivedKey = await pbkdf2(password, salt, 100000, 64, 'sha512');
    return key === derivedKey.toString('hex');
  } catch (error) {
    logger.error('Password verification failed', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function createUser(username: string, email: string, passwordPlain: string, phoneNumber: string, businessName: string): Promise<User | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create merchant if not exists
    let merchantResult = await client.query(
      'SELECT merchant_id FROM oms.merchants WHERE email = $1',
      [email]
    );
    
    let merchantId;
    if (merchantResult.rows.length === 0) {
      merchantResult = await client.query(
        'INSERT INTO oms.merchants(merchant_name, contact_person_name, email, phone_number) VALUES($1, $2, $3, $4) RETURNING merchant_id',
        [businessName, username, email, phoneNumber]
      );
      merchantId = merchantResult.rows[0].merchant_id;
    } else {
      merchantId = merchantResult.rows[0].merchant_id;
    }
    
    const password_hash = await hashPassword(passwordPlain);
    const result = await client.query(
      'INSERT INTO oms.users(merchant_id, username, email, phone_number, password_hash, role) VALUES($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, role, created_at, updated_at',
      [merchantId, username, email, phoneNumber, password_hash, 'admin']
    );
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating user', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    client.release();
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id, username, email, password_hash, role, created_at, updated_at FROM oms.users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error finding user by email', error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    client.release();
  }
}