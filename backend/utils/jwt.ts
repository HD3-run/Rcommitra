import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'ecommitra-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ecommitra-client';

// Phantom token storage (in production, use Redis)
const phantomTokens = new Map<string, any>();

// Generate opaque phantom token
export const generatePhantomToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Create JWT with proper validation
export const createJWT = (payload: any): string => {
  // Remove PII from JWT payload
  const sanitizedPayload = {
    sub: payload.userId,
    role: payload.role,
    merchant_id: payload.merchant_id,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(sanitizedPayload, JWT_SECRET, { algorithm: 'HS256' });
};

// Validate JWT with issuer/audience checks
export const validateJWT = (token: string): any => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'] // Don't trust algo header
    });
    return decoded;
  } catch (error) {
    logger.warn('JWT validation failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

// Phantom token pattern implementation
export const createPhantomTokenPair = (userPayload: any) => {
  const phantomToken = generatePhantomToken();
  const jwt = createJWT(userPayload);
  
  // Store JWT reference with phantom token
  phantomTokens.set(phantomToken, {
    jwt,
    userPayload,
    createdAt: Date.now(),
    expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes
  });
  
  return { phantomToken, jwt };
};

// Resolve phantom token to JWT
export const resolvePhantomToken = (phantomToken: string) => {
  const tokenData = phantomTokens.get(phantomToken);
  
  if (!tokenData) {
    return null;
  }
  
  // Check expiry
  if (Date.now() > tokenData.expiresAt) {
    phantomTokens.delete(phantomToken);
    return null;
  }
  
  return tokenData;
};

// Cleanup expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of phantomTokens.entries()) {
    if (now > data.expiresAt) {
      phantomTokens.delete(token);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes