import compression from "compression";
import multer from 'multer';
import session from "express-session";
import cookieParser from "cookie-parser";
import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';

import { logger } from './utils/logger.js';
import { sanitizeInput, preventUrlManipulation } from './middleware/validation.js';
import { apiLimiter, authLimiter, uploadLimiter, orderLimiter } from './middleware/rate-limit.js';
import { selectFields, compressResponse } from './utils/response-optimizer.js';



declare global {
  namespace Express {
    interface Request {
      session: import("express-session").Session & Partial<import("express-session").SessionData>;
    }
  }
}

// Basic HTTP configuration
const PORT = process.env.PORT || 5001;
const app = express();

const isProd = process.env.NODE_ENV === 'production';
logger.info(`Starting server in ${isProd ? 'production' : 'development'} mode...`);

// Add request logging middleware early
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Disable ETag/conditional GET to avoid 304 caching on API responses
app.set('etag', false);

// Force no-store caching policy for all API endpoints
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Enhanced CORS configuration
const corsOptions = {
  origin: isProd ? 
    (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []) :
    [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5000'
    ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-csrf-token',
    'Cache-Control'
  ],
  exposedHeaders: ['set-cookie']
};

// Apply CORS with the above configuration
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add cookie parser
app.use(cookieParser());



// Validate session secret in production
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'your-session-secret-change-in-production')) {
  logger.error('SESSION_SECRET must be set to a secure value in production');
  process.exit(1);
}

// Simple session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'sessionId',
  cookie: {
    secure: false, // Set to false for development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Enable gzip compression
app.use(compression({
  filter: (req: any, res: any) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

// Security middleware (before rate limiting)
app.use(preventUrlManipulation);
app.use(sanitizeInput);

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/*/upload*', uploadLimiter);
app.use('/api/orders', orderLimiter);

// Response optimization
app.use(selectFields);
app.use(compressResponse);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Configure multer for file uploads with security limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '8388608'), // 8MB default
    files: 1,
    fieldSize: 1024 * 1024, // 1MB field size limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Export upload middleware for use in routes
export { upload };

// HTTPS enforcement in production
if (isProd) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});





// Basic auth endpoints
// Removed basic in-memory login route to ensure the real database-backed authentication in routes.ts is used.
// If you need a fallback mock login, guard it behind an environment flag instead.




// Mock endpoints - only available in development
if (process.env.NODE_ENV === 'development') {
  app.get('/api/picks', (_req, res) => {
    const mockPicks = [
      {
        id: 'PK-2024-001',
        items: 12,
        location: 'Warehouse A',
        status: 'completed',
        time: '2024-01-01T10:00:00Z'
      },
      {
        id: 'PK-2024-002',
        items: 8,
        location: 'Warehouse B',
        status: 'in-progress',
        time: '2024-01-01T11:30:00Z'
      }
    ];
    
    res.json(mockPicks);
  });

  // Mock activities endpoint
  app.get('/api/activities/recent', (_req, res) => {
    const mockActivities = [
      {
        action: 'Pick list PK-2024-001 completed',
        time: '2 minutes ago',
        color: 'text-green-400'
      },
      {
        action: 'New order received from Flipkart',
        time: '5 minutes ago',
        color: 'text-blue-400'
      }
    ];
    
    res.json(mockActivities);
  });
}

// Try to register full routes if available
async function setupRoutes() {
  try {
    logger.info('Attempting to load full routes...');
    const { registerRoutes } = await import('./routes.ts');
    registerRoutes(app);
    logger.info('Full routes loaded successfully');
    return app;
  } catch (error) {
    logger.warn('Could not load full routes, using basic routes', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Server error', err instanceof Error ? err.message : String(err));
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler will be registered after Vite setup

// Start the server
async function startServer() {
  try {
    // Try to setup full routes first
    const server = await setupRoutes();
    
    if (server) {
      server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
      });
    } else {
      return null;
    }
  } catch (error) {
    logger.warn('Could not load full routes, using basic routes', error instanceof Error ? error.message : String(error));
    return null;
  }
}

startServer().catch(error => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
