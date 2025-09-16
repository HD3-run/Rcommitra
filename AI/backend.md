db schema: -- OMS SaaS Database Schema (Merchant-Centric) for AWS RDS PostgreSQL
-- Based on oms.merchants / oms.users / oms.products / oms.inventory / oms.orders spec

CREATE SCHEMA IF NOT EXISTS oms;

-- ========================
-- Merchants
-- ========================
CREATE SEQUENCE oms.merchant_seq START 100000;

CREATE TABLE oms.merchants (
    merchant_id BIGINT PRIMARY KEY DEFAULT nextval('oms.merchant_seq'),
    merchant_name VARCHAR(255) NOT NULL,
    contact_person_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','suspended','disabled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- Users
-- ========================
CREATE TABLE oms.users (
    user_id BIGINT PRIMARY KEY, -- auto-generated via trigger
    merchant_id BIGINT NOT NULL,
    username VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, -- store bcrypt hash
    role VARCHAR(50) DEFAULT 'admin',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','suspended','disabled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants (merchant_id) ON DELETE CASCADE
);

-- Function to generate user_id (max 6 per merchant)
CREATE OR REPLACE FUNCTION oms.generate_user_id(p_merchant_id BIGINT)
RETURNS BIGINT AS $$
DECLARE
    user_count INT;
    next_suffix INT;
    new_user_id BIGINT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM oms.users WHERE merchant_id = p_merchant_id;
    IF user_count >= 6 THEN
        RAISE EXCEPTION 'Maximum 6 users allowed per merchant (including admin)';
    END IF;
    next_suffix := user_count + 1;
    new_user_id := p_merchant_id * 10 + next_suffix;
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION oms.set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id := oms.generate_user_id(NEW.merchant_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_user_id
BEFORE INSERT ON oms.users
FOR EACH ROW
EXECUTE FUNCTION oms.set_user_id();

-- ========================
-- Products
-- ========================
CREATE SEQUENCE oms.products_product_id_seq START 1000000;

CREATE TABLE oms.products (
    product_id BIGINT PRIMARY KEY DEFAULT nextval('oms.products_product_id_seq'),
    merchant_id BIGINT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    brand VARCHAR(100),
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','discontinued')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants (merchant_id) ON DELETE CASCADE
);

-- Auto-generate SKU if not provided
CREATE OR REPLACE FUNCTION oms.generate_sku()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sku IS NULL OR TRIM(NEW.sku) = '' THEN
        NEW.sku := NEW.merchant_id || '-' || LPAD(NEW.product_id::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_sku
BEFORE INSERT ON oms.products
FOR EACH ROW
EXECUTE FUNCTION oms.generate_sku();

-- ========================
-- Inventory
-- ========================
CREATE TABLE oms.inventory (
    inventory_id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    sku VARCHAR(100) NOT NULL,
    quantity_available INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 0,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants (merchant_id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_products FOREIGN KEY (product_id)
        REFERENCES oms.products (product_id) ON DELETE CASCADE,
    CONSTRAINT uq_inventory_merchant_product UNIQUE (merchant_id, product_id)
);

-- ========================
-- Customers
-- ========================
CREATE TABLE oms.customers (
    customer_id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_customers_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants (merchant_id) ON DELETE CASCADE,
    CONSTRAINT uq_customer_phone UNIQUE (merchant_id, phone)
);

-- ========================
-- Orders
-- ========================
CREATE TABLE oms.orders (
    order_id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    customer_id BIGINT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_source VARCHAR(50) NOT NULL DEFAULT 'POS',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','cod')),
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants (merchant_id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_users FOREIGN KEY (user_id)
        REFERENCES oms.users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id)
        REFERENCES oms.customers (customer_id) ON DELETE SET NULL
);

CREATE TABLE oms.order_items (
    order_item_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    inventory_id BIGINT NULL,
    sku VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id)
        REFERENCES oms.orders (order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_products FOREIGN KEY (product_id)
        REFERENCES oms.products (product_id)
);

CREATE TABLE oms.order_payments (
    payment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
    CONSTRAINT fk_order_payments_orders FOREIGN KEY (order_id)
        REFERENCES oms.orders(order_id) ON DELETE CASCADE
);

CREATE TABLE oms.order_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changed_by BIGINT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_status_history_orders FOREIGN KEY (order_id)
        REFERENCES oms.orders(order_id) ON DELETE CASCADE
);
-- ============================================
-- Auto-update updated_at timestamp triggers
-- ============================================

-- Reusable function
CREATE OR REPLACE FUNCTION oms.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Merchants
CREATE TRIGGER trg_merchants_updated_at
BEFORE UPDATE ON oms.merchants
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();

-- Users
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON oms.users
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();

-- Products
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON oms.products
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();

-- Inventory
CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON oms.inventory
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();

-- Customers
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON oms.customers
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();

-- Orders
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON oms.orders
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();

-- Order Items
CREATE TRIGGER trg_order_items_updated_at
BEFORE UPDATE ON oms.order_items
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();

-- Order Payments
CREATE TRIGGER trg_order_payments_updated_at
BEFORE UPDATE ON oms.order_payments
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();

-- Order Status History
CREATE TRIGGER trg_order_status_history_updated_at
BEFORE UPDATE ON oms.order_status_history
FOR EACH ROW
EXECUTE FUNCTION oms.update_updated_at_column();
server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://localhost:5000", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:5173", "http://127.0.0.1:5000"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Serve the orders page
app.get('/orders', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

// Handle root URL
app.get('/', (req, res) => {
    res.redirect('/orders');
});

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
        clientId: 'whatsapp-bot'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-features=HttpsFirstBalancedModeAutoEnable'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('New client connected');

    // Handle QR code generation
    const handleQR = (qr) => {
        console.log('Generating QR code...');
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.error('Error generating QR code:', err);
                socket.emit('error', 'Failed to generate QR code');
                return;
            }
            console.log('QR code generated, sending to client');
            socket.emit('qr', url);
            socket.emit('message', 'QR Code generated. Scan it with your phone.');
        });
    };

    // Set up event listeners for the WhatsApp client
    client.on('qr', handleQR);

    client.on('authenticated', () => {
        console.log('Client authenticated');
        socket.emit('authenticated', 'WhatsApp is authenticated!');
        socket.emit('message', 'WhatsApp is authenticated!');
    });

    client.on('ready', () => {
        console.log('Client is ready');
        socket.emit('ready', 'WhatsApp is ready!');
        socket.emit('message', 'WhatsApp is ready!');
    });

    client.on('message_create', async (message) => {
        try {
            console.log('Received message:', message.body);
            
            // Basic response to any message
            if (message.body.toLowerCase() === 'hello' || message.body.toLowerCase() === 'hi') {
                await message.reply('👋 Hello! I am your WhatsApp bot. How can I help you today?');
            } else if (message.body.toLowerCase() === 'help') {
                const helpText = `*Available commands:*\n\n` +
                    `• *hello* or *hi* - Greet the bot\n` +
                    `• *help* - Show this help message\n` +
                    `• *order status* - Check your order status\n` +
                    `• *contact* - Get contact information`;
                await message.reply(helpText);
            } else if (message.body.toLowerCase().includes('order')) {
                await message.reply('To check your order status, please provide your order number.');
            } else {
                await message.reply('I\'m not sure how to respond to that. Type *help* to see available commands.');
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
        // Clean up the QR handler to prevent memory leaks
        client.removeListener('qr', handleQR);
    });

    // Handle generate QR code request
    socket.on('generateQR', () => {
        console.log('Received generateQR request');
        client.initialize().catch(err => {
            console.error('Failed to initialize WhatsApp client:', err);
            socket.emit('error', 'Failed to initialize WhatsApp client: ' + (err.message || 'Unknown error'));
        });
    });

    // If client is already authenticated, send ready status
    if (client.info) {
        console.log('Client already authenticated, sending ready status');
        socket.emit('ready', 'WhatsApp is ready!');
    }
});

// Start the server
const PORT = process.env.WHATSAPP_BOT_PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Visit http://localhost:${PORT}/orders to access the orders page`);
    
    // Don't auto-initialize on server start, wait for client request
    console.log('Waiting for client to request QR code...');
});

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    try {
        if (client.pupPage) {
            await client.destroy();
        }
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});
index.ts 

import compression from "compression";
import multer from 'multer';
import session from "express-session";
import cookieParser from "cookie-parser";
import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { createServer } from 'http';
import { registerRoutes } from './routes.js';
import { generateCSRFToken } from "./utils/csrf.js";
import { verifyCSRFToken } from "./utils/csrf.js";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

// Basic HTTP configuration
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';
const app = express();

console.log('Starting server in development mode...');

// Add request logging middleware early
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
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
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5000',
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



// Simple session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Enable gzip compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb'
}));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

// Security headers
app.use((req, res, next) => {
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




app.get('/api/picks', (req, res) => {
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
app.get('/api/activities/recent', (req, res) => {
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

// Try to register full routes if available
async function setupRoutes() {
  try {
    console.log('Attempting to load full routes...');
    const { registerRoutes } = await import('./routes.js');
    const server = await registerRoutes(app);
    console.log('Full routes loaded successfully');
    return server;
  } catch (error) {
    console.warn('Could not load full routes, using basic routes:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
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
      // If routes were loaded successfully, try to setup Vite
      try {
        const { setupVite } = await import('./vite.js');
        await setupVite(app, server);
        console.log('Vite development server setup complete');
        // Register routes
        await registerRoutes(app);
        // Register 404 handler after all other middleware/routes
        app.use('*', (req, res) => {
          console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
          res.status(404).json({ message: 'Route not found' });
        });
        // Start listening after successful Vite setup
        server.listen(PORT, () => {
          console.log(`Server running on http://localhost:${PORT}`);
          console.log(`Environment: ${process.env.NODE_ENV}`);
          console.log('Server is ready to handle requests');
        });
      } catch (viteError) {
        console.warn('Vite setup failed, running without Vite');
        server.listen(PORT, () => {
          console.log(`Server running on http://localhost:${PORT}`);
          console.log(`Environment: ${process.env.NODE_ENV}`);
          console.log('Server is ready to handle requests');
        });
      }
    } else {
      // If routes couldn't be loaded, start basic server
      const server = createServer(app);
      
      try {
        const { setupVite } = await import('./vite.js');
        await setupVite(app, server);
        console.log('Vite development server setup complete with basic routes');
        // Register routes
        await registerRoutes(app);
        // Register 404 handler after all other middleware/routes
        app.use('*', (req, res) => {
          console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
          res.status(404).json({ message: 'Route not found' });
        });
        // Start listening after successful Vite setup
        server.listen(PORT, () => {
          console.log(`Basic server running on http://localhost:${PORT}`);
          console.log(`Environment: ${process.env.NODE_ENV}`);
          console.log('Server is ready with basic functionality');
        });
      } catch (viteError) {
        console.warn('Vite setup failed, running basic server without Vite');
        server.listen(PORT, () => {
          console.log(`Basic server running on http://localhost:${PORT}`);
          console.log(`Environment: ${process.env.NODE_ENV}`);
          console.log('Server is ready with basic functionality');
        });
      }
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    
    // Last resort: basic HTTP server
    const server = createServer(app);
    server.listen(PORT, () => {
      console.log(`Fallback server running on http://localhost:${PORT}`);
      console.log('Basic functionality only');
    });
  }
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});




auth.ts client : 
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  merchantId: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

interface RegisterData {
  companyName: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
}

// Auth API functions
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const csrfToken = await getCSRFToken();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    
    // Store token in localStorage
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    
    return data;
  },

  logout: async (): Promise<void> => {
    const csrfToken = await getCSRFToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
      });
    } finally {
      // Always clear local storage, even if the request fails
      localStorage.removeItem('auth_token');
    }
  },

  register: async (data: RegisterData): Promise<{ message: string }> => {
    const csrfToken = await getCSRFToken();
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  },

  getCurrentUser: async (): Promise<User | null> => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        localStorage.removeItem('auth_token');
        return null;
      }

      return response.json();
    } catch (error) {
      localStorage.removeItem('auth_token');
      return null;
    }
  }
};

// React Query hooks
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(['currentUser'], data.user);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
    onError: (error) => {
      console.error('Login error:', error);
    }
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(['currentUser'], null);
      queryClient.clear();
    }
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: authApi.register
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
    staleTime: 0,
  });
};

// Combined auth hook (this is what components expect)
export const useAuth = () => {
  const { data: user, isLoading, error } = useCurrentUser();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  
  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    loginError: loginMutation.error,
    logoutError: logoutMutation.error
  };
};

// Auth utilities
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('auth_token');
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const clearAuth = (): void => {
  localStorage.removeItem('auth_token');
};

// Get auth headers for API requests
export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Fetch with auth headers
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const authHeaders = getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  // If we get a 401, clear the auth token
  if (response.status === 401) {
    clearAuth();
    // Optionally redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
  
  return response;
};

// Utility: fetch or retrieve CSRF token for protected endpoints
export async function getCSRFToken(): Promise<string> {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  const resp = await fetch('/api/csrf-token', { credentials: 'include' });
  const data = await resp.json();
  return data.csrfToken as string;
}


auth.ts server/middleware:  import jwt from "jsonwebtoken";
import { storage } from "../storage.js";
import { logger } from "../utils/logger.js";
import { verifyPassword, hashPassword } from "../utils/password.js";
import type { Request, Response, NextFunction } from "express";

export interface SocketUser {
  user_id: string;
  username: string;
  merchantId: string;
  role: string;
}

export interface AuthenticatedUser {
  user_id: string;
  username: string;
  role: string;
  merchantId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  merchantId?: string;
}

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export type UserRole = 'admin' | 'user' | 'merchant' | 'staff';

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret' : undefined);
const JWT_ISSUER = process.env.JWT_ISSUER || 'ecommitra';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ecommitra-app';

// Ensure JWT_SECRET is set in production
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Set a strong secret in environment variables for production.');
}

// Assert JWT_SECRET is a string for TypeScript
const JWT_SECRET_STRING = JWT_SECRET as string;

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : null;

    if (!token) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }

    let payload: any;
    try {
      const decoded = jwt.verify(token, JWT_SECRET_STRING, { 
        issuer: JWT_ISSUER, 
        audience: JWT_AUDIENCE 
      }) as { userId: string };
      payload = decoded;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!payload?.userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = {
      user_id: user.user_id,
      username: user.username,
      role: user.role as string,
      merchantId: user.merchantId,
    };

    next();
  } catch (error) {
    logger.error('authenticateToken error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: 'Authentication error' });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

export async function generateToken(userId: string): Promise<string> {
  return jwt.sign(
    { userId }, 
    JWT_SECRET_STRING, 
    { 
      expiresIn: '7d', 
      issuer: JWT_ISSUER, 
      audience: JWT_AUDIENCE 
    }
  );
}

export interface UserWithoutPassword {
  user_id: string;
  merchantId: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

// Accepts username or email for login
export async function verifyUserPassword(usernameOrEmail: string, password: string): Promise<UserWithoutPassword | null> {
  try {
    logger.debug('Verifying password for user:', { login: usernameOrEmail });
    let user = await storage.getUserByUsername(usernameOrEmail);
    // If not found by username, try email
    if (!user && usernameOrEmail.includes('@')) {
      if (typeof storage.getUserByEmail === 'function') {
        user = await storage.getUserByEmail(usernameOrEmail);
      } else if (storage.getUserByUsername) {
        // Try to fall back to getUserByUsername as email in the DB if that was stored
        user = await storage.getUserByUsername(usernameOrEmail);
      }
    }

    if (!user) {
      logger.warn('Login attempt for non-existent user', { login: usernameOrEmail });
      return null;
    }

    logger.debug('User found in database', { 
      user_id: user.user_id, 
      hasPassword: !!user.password,
      passwordStartsWith: user.password ? user.password.substring(0, 10) + '...' : 'none'
    });

    // First check if password is already hashed with bcrypt
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      logger.debug('Password appears to be hashed with bcrypt, using bcrypt comparison');
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        logger.warn('Invalid password for user (bcrypt comparison failed)', { login: usernameOrEmail });
        return null;
        }
    } 
    // For development, allow direct comparison if NODE_ENV is not production
    else if (process.env.NODE_ENV !== 'production' && password === user.password) {
      logger.debug('Development login with plain text password', { userId: user.user_id });
      
      // Auto-upgrade to hashed password in development
      try {
        const hashedPassword = await hashPassword(password);
        await storage.updateUser(user.user_id, { password: hashedPassword });
        logger.info('Auto-upgraded password to bcrypt hash for user', { user_id: user.user_id });
      } catch (updateError) {
        logger.error('Failed to update password hash', { 
          user_id: user.user_id, 
          error: updateError instanceof Error ? updateError.message : String(updateError) 
        });
      }
    } 
    // If we get here, the password is invalid
    else {
      logger.warn('Invalid password for user (direct comparison failed)', { login: usernameOrEmail });
      return null;
    }

    // Omit password from the returned user object
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as UserWithoutPassword;
  } catch (error) {
    logger.error('verifyUserPassword error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Socket authentication function
export async function authenticateSocketToken(token: string): Promise<SocketUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_STRING, { 
      issuer: JWT_ISSUER, 
      audience: JWT_AUDIENCE 
    }) as { userId: string };

    if (!decoded?.userId) {
      return null;
    }

    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return null;
    }

    return {
      user_id: user.user_id,
      username: user.username,
      merchantId: user.merchantId,
      role: user.role as string
    };
  } catch (error) {
    logger.error('Socket authentication error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
auth client: 
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  merchantId: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

interface RegisterData {
  companyName: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
}

// Auth API functions
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const csrfToken = await getCSRFToken();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    
    // Store token in localStorage
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    
    return data;
  },

  logout: async (): Promise<void> => {
    const csrfToken = await getCSRFToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
      });
    } finally {
      // Always clear local storage, even if the request fails
      localStorage.removeItem('auth_token');
    }
  },

  register: async (data: RegisterData): Promise<{ message: string }> => {
    const csrfToken = await getCSRFToken();
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  },

  getCurrentUser: async (): Promise<User | null> => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        localStorage.removeItem('auth_token');
        return null;
      }

      return response.json();
    } catch (error) {
      localStorage.removeItem('auth_token');
      return null;
    }
  }
};

// React Query hooks
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(['currentUser'], data.user);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
    onError: (error) => {
      console.error('Login error:', error);
    }
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(['currentUser'], null);
      queryClient.clear();
    }
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: authApi.register
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
    staleTime: 0,
  });
};

// Combined auth hook (this is what components expect)
export const useAuth = () => {
  const { data: user, isLoading, error } = useCurrentUser();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  
  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    loginError: loginMutation.error,
    logoutError: logoutMutation.error
  };
};

// Auth utilities
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('auth_token');
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const clearAuth = (): void => {
  localStorage.removeItem('auth_token');
};

// Get auth headers for API requests
export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Fetch with auth headers
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const authHeaders = getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  // If we get a 401, clear the auth token
  if (response.status === 401) {
    clearAuth();
    // Optionally redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
  
  return response;
};

// Utility: fetch or retrieve CSRF token for protected endpoints
export async function getCSRFToken(): Promise<string> {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  const resp = await fetch('/api/csrf-token', { credentials: 'include' });
  const data = await resp.json();
  return data.csrfToken as string;
}


auth.ts server middleware: import jwt from "jsonwebtoken";
import { storage } from "../storage.js";
import { logger } from "../utils/logger.js";
import { verifyPassword, hashPassword } from "../utils/password.js";
import type { Request, Response, NextFunction } from "express";

export interface SocketUser {
  user_id: string;
  username: string;
  merchantId: string;
  role: string;
}

export interface AuthenticatedUser {
  user_id: string;
  username: string;
  role: string;
  merchantId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  merchantId?: string;
}

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export type UserRole = 'admin' | 'user' | 'merchant' | 'staff';

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret' : undefined);
const JWT_ISSUER = process.env.JWT_ISSUER || 'ecommitra';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ecommitra-app';

// Ensure JWT_SECRET is set in production
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Set a strong secret in environment variables for production.');
}

// Assert JWT_SECRET is a string for TypeScript
const JWT_SECRET_STRING = JWT_SECRET as string;

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : null;

    if (!token) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }

    let payload: any;
    try {
      const decoded = jwt.verify(token, JWT_SECRET_STRING, { 
        issuer: JWT_ISSUER, 
        audience: JWT_AUDIENCE 
      }) as { userId: string };
      payload = decoded;
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!payload?.userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = {
      user_id: user.user_id,
      username: user.username,
      role: user.role as string,
      merchantId: user.merchantId,
    };

    next();
  } catch (error) {
    logger.error('authenticateToken error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: 'Authentication error' });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

export async function generateToken(userId: string): Promise<string> {
  return jwt.sign(
    { userId }, 
    JWT_SECRET_STRING, 
    { 
      expiresIn: '7d', 
      issuer: JWT_ISSUER, 
      audience: JWT_AUDIENCE 
    }
  );
}

export interface UserWithoutPassword {
  user_id: string;
  merchantId: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

// Accepts username or email for login
export async function verifyUserPassword(usernameOrEmail: string, password: string): Promise<UserWithoutPassword | null> {
  try {
    logger.debug('Verifying password for user:', { login: usernameOrEmail });
    let user = await storage.getUserByUsername(usernameOrEmail);
    // If not found by username, try email
    if (!user && usernameOrEmail.includes('@')) {
      if (typeof storage.getUserByEmail === 'function') {
        user = await storage.getUserByEmail(usernameOrEmail);
      } else if (storage.getUserByUsername) {
        // Try to fall back to getUserByUsername as email in the DB if that was stored
        user = await storage.getUserByUsername(usernameOrEmail);
      }
    }

    if (!user) {
      logger.warn('Login attempt for non-existent user', { login: usernameOrEmail });
      return null;
    }

    logger.debug('User found in database', { 
      user_id: user.user_id, 
      hasPassword: !!user.password,
      passwordStartsWith: user.password ? user.password.substring(0, 10) + '...' : 'none'
    });

    // First check if password is already hashed with bcrypt
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      logger.debug('Password appears to be hashed with bcrypt, using bcrypt comparison');
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        logger.warn('Invalid password for user (bcrypt comparison failed)', { login: usernameOrEmail });
        return null;
        }
    } 
    // For development, allow direct comparison if NODE_ENV is not production
    else if (process.env.NODE_ENV !== 'production' && password === user.password) {
      logger.debug('Development login with plain text password', { userId: user.user_id });
      
      // Auto-upgrade to hashed password in development
      try {
        const hashedPassword = await hashPassword(password);
        await storage.updateUser(user.user_id, { password: hashedPassword });
        logger.info('Auto-upgraded password to bcrypt hash for user', { user_id: user.user_id });
      } catch (updateError) {
        logger.error('Failed to update password hash', { 
          user_id: user.user_id, 
          error: updateError instanceof Error ? updateError.message : String(updateError) 
        });
      }
    } 
    // If we get here, the password is invalid
    else {
      logger.warn('Invalid password for user (direct comparison failed)', { login: usernameOrEmail });
      return null;
    }

    // Omit password from the returned user object
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as UserWithoutPassword;
  } catch (error) {
    logger.error('verifyUserPassword error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Socket authentication function
export async function authenticateSocketToken(token: string): Promise<SocketUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_STRING, { 
      issuer: JWT_ISSUER, 
      audience: JWT_AUDIENCE 
    }) as { userId: string };

    if (!decoded?.userId) {
      return null;
    }

    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return null;
    }

    return {
      user_id: user.user_id,
      username: user.username,
      merchantId: user.merchantId,
      role: user.role as string
    };
  } catch (error) {
    logger.error('Socket authentication error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
schema.ts : // schema.ts placeholder
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "manager", "picker", "packer", "finance", "developer"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "allocated", "picking", "packing", "shipped", "delivered", "cancelled", "returned"]);
export const integrationTypeEnum = pgEnum("integration_type", ["shopify", "amazon", "flipkart", "shiprocket", "delhivery", "tally", "zoho"]);
export const warehouseStatusEnum = pgEnum("warehouse_status", ["active", "inactive", "maintenance"]);
export const returnStatusEnum = pgEnum("return_status", ["pending", "approved", "rejected", "processing", "completed"]);
export const returnTypeEnum = pgEnum("return_type", ["customer_return", "rto", "damaged"]);
export const shipmentStatusEnum = pgEnum("shipment_status", ["pending", "in_transit", "delivered", "failed", "returned"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "processing", "completed", "failed", "refunded"]);
export const activityTypeEnum = pgEnum("activity_type", ["order_created", "order_updated", "inventory_updated", "shipment_created", "return_processed", "payment_received", "inventory_alert", "order_alert"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "read", "update", "delete", "login", "logout", "export", "import"]);

// Users table
export const users = pgTable("users", {
  user_id: varchar("user_id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("picker"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Merchants table
export const merchants = pgTable("merchants", {
  merchantId: varchar("merchant_id").primaryKey().default(sql`gen_random_uuid()`),
  merchant_name: varchar("merchant_name", { length: 255 }).notNull(),
  contactPersonName: varchar("contact_person_name", { length: 150 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 15 }),
  status: varchar("status", { length: 50 }).default('ACTIVE').notNull(),
  businessType: varchar("business_type", { length: 50 }),
  panNumber: varchar("pan_number", { length: 10 }),
  gstin: varchar("gstin", { length: 15 }),
  cinNumber: varchar("cin_number", { length: 21 }),
  udyamNumber: varchar("udyam_number", { length: 19 }),
  billingAddressLine1: varchar("billing_address_line1", { length: 255 }),
  billingAddressLine2: varchar("billing_address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  pincode: varchar("pincode", { length: 10 }),
  country: varchar("country", { length: 100 }),
  bankAccountNumber: varchar("bank_account_number", { length: 20 }),
  bankIfsc: varchar("bank_ifsc", { length: 15 }),
  bankName: varchar("bank_name", { length: 100 }),
  bankBranch: varchar("bank_branch", { length: 100 }),
  upiId: varchar("upi_id", { length: 100 }),
  invoiceCurrency: varchar("invoice_currency", { length: 10 }).default('INR').notNull(),
  invoiceFrequency: varchar("invoice_frequency", { length: 50 }),
  invoiceEmail: varchar("invoice_email", { length: 255 }),
  gstApplicable: boolean("gst_applicable").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Warehouses table
export const warehouses = pgTable("warehouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  pincode: text("pincode").notNull(),
  capacity: integer("capacity").notNull(),
  currentOccupancy: integer("current_occupancy").notNull().default(0),
  status: warehouseStatusEnum("status").notNull().default("active"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  brand: text("brand"),
  weight: decimal("weight", { precision: 10, scale: 3 }),
  dimensions: jsonb("dimensions").default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory table
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  productId: varchar("product_id").notNull(),
  warehouseId: varchar("warehouse_id").notNull(),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  incoming: integer("incoming").notNull().default(0),
  damaged: integer("damaged").notNull().default(0),
  safetyStock: integer("safety_stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  orderNumber: text("order_number").notNull().unique(),
  externalId: text("external_id").unique(),
  customerId: varchar("customer_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  shippingAddress: jsonb("shipping_address").notNull(),
  billingAddress: jsonb("billing_address"),
  channel: text("channel").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  priority: integer("priority").notNull().default(1),
  notes: text("notes"),
  tags: text("tags").array(),
  warehouseId: varchar("warehouse_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order Items table
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  productId: varchar("product_id").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

// Picks table
export const picks = pgTable("picks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  pickNumber: text("pick_number").notNull().unique(),
  warehouseId: varchar("warehouse_id").notNull(),
  pickerId: varchar("picker_id"),
  status: text("status").notNull().default("pending"),
  totalItems: integer("total_items").notNull(),
  pickedItems: integer("picked_items").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Integrations table
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  type: integrationTypeEnum("type").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  status: text("status").notNull().default("connected"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Returns table
export const returns = pgTable("returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  returnNumber: text("return_number").notNull().unique(),
  orderId: varchar("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  reason: text("reason").notNull(),
  status: returnStatusEnum("status").notNull().default("pending"),
  type: returnTypeEnum("type").notNull().default("customer_return"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shipments table
export const shipments = pgTable("shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  shipmentNumber: text("shipment_number").notNull().unique(),
  orderId: varchar("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  carrier: text("carrier").notNull(),
  trackingNumber: text("tracking_number"),
  status: shipmentStatusEnum("status").notNull().default("pending"),
  shippingAddress: jsonb("shipping_address").notNull(),
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payments table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  paymentId: text("payment_id").notNull().unique(),
  orderId: varchar("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  method: text("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  gateway: text("gateway").notNull(),
  transactionId: text("transaction_id"),
  settlementAmount: decimal("settlement_amount", { precision: 10, scale: 2 }),
  fees: decimal("fees", { precision: 10, scale: 2 }),
  invoiceData: jsonb("invoice_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activities table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  type: activityTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  userId: varchar("user_id"),
  entityId: varchar("entity_id"),
  entityType: text("entity_type"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  userId: varchar("user_id"),
  action: auditActionEnum("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: varchar("resource_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  user_id: true,
  createdAt: true,
});
export const insertMerchantSchema = createInsertSchema(merchants).omit({
  merchantId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarehouseSchema = createInsertSchema(warehouses).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertPickSchema = createInsertSchema(picks).omit({
  id: true,
  createdAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
});

export const insertReturnSchema = createInsertSchema(returns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type Pick = typeof picks.$inferSelect;
export type InsertPick = z.infer<typeof insertPickSchema>;

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;

export type Return = typeof returns.$inferSelect;
export type InsertReturn = z.infer<typeof insertReturnSchema>;

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = z.infer<typeof insertShipmentSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Invoice = {
  id: string;
  merchantId: string;
  orderId: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled' | 'overdue';
  fileUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertInvoice = Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>;

export type ApiKey = {
  id: string;
  merchantId: string;
  key: string;
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
};

export type InsertApiKey = Omit<ApiKey, 'id' | 'createdAt'>;

export type Settings = {
  [key: string]: any;
};

export type DashboardMetrics = {
  todayOrders: number;
  pendingAllocation: number;
  pickAccuracy: number;
  todayRevenue: number;
  totalOrders: number;
  pendingReturns: number;
  unreadNotifications: number;
};
schema.js: // schema.ts placeholder
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
// Enums
export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "manager", "picker", "packer", "finance", "developer"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "allocated", "picking", "packing", "shipped", "delivered", "cancelled", "returned"]);
export const integrationTypeEnum = pgEnum("integration_type", ["shopify", "amazon", "flipkart", "shiprocket", "delhivery", "tally", "zoho"]);
export const warehouseStatusEnum = pgEnum("warehouse_status", ["active", "inactive", "maintenance"]);
export const returnStatusEnum = pgEnum("return_status", ["pending", "approved", "rejected", "processing", "completed"]);
export const returnTypeEnum = pgEnum("return_type", ["customer_return", "rto", "damaged"]);
export const shipmentStatusEnum = pgEnum("shipment_status", ["pending", "in_transit", "delivered", "failed", "returned"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "processing", "completed", "failed", "refunded"]);
export const activityTypeEnum = pgEnum("activity_type", ["order_created", "order_updated", "inventory_updated", "shipment_created", "return_processed", "payment_received", "inventory_alert", "order_alert"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "read", "update", "delete", "login", "logout", "export", "import"]);
// Users table
export const users = pgTable("users", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    role: userRoleEnum("role").notNull().default("picker"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
});
// Merchants table
export const merchants = pgTable("merchants", {
    merchantId: varchar("merchant_id").primaryKey().default(sql `gen_random_uuid()`),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    settings: jsonb("settings").default({}),
    createdAt: timestamp("created_at").defaultNow(),
});
// Warehouses table
export const warehouses = pgTable("warehouses", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    country: text("country").notNull(),
    pincode: text("pincode").notNull(),
    capacity: integer("capacity").notNull(),
    currentOccupancy: integer("current_occupancy").notNull().default(0),
    status: warehouseStatusEnum("status").notNull().default("active"),
    settings: jsonb("settings").default({}),
    createdAt: timestamp("created_at").defaultNow(),
});
// Products table
export const products = pgTable("products", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    brand: text("brand"),
    weight: decimal("weight", { precision: 10, scale: 3 }),
    dimensions: jsonb("dimensions").default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
});
// Inventory table
export const inventory = pgTable("inventory", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    productId: varchar("product_id").notNull(),
    warehouseId: varchar("warehouse_id").notNull(),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    incoming: integer("incoming").notNull().default(0),
    damaged: integer("damaged").notNull().default(0),
    safetyStock: integer("safety_stock").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// Orders table
export const orders = pgTable("orders", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    orderNumber: text("order_number").notNull().unique(),
    externalId: text("external_id").unique(),
    customerId: varchar("customer_id"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    shippingAddress: jsonb("shipping_address").notNull(),
    billingAddress: jsonb("billing_address"),
    channel: text("channel").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("INR"),
    priority: integer("priority").notNull().default(1),
    notes: text("notes"),
    tags: text("tags").array(),
    warehouseId: varchar("warehouse_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// Order Items table
export const orderItems = pgTable("order_items", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    orderId: varchar("order_id").notNull(),
    productId: varchar("product_id").notNull(),
    sku: text("sku").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});
// Picks table
export const picks = pgTable("picks", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    pickNumber: text("pick_number").notNull().unique(),
    warehouseId: varchar("warehouse_id").notNull(),
    pickerId: varchar("picker_id"),
    status: text("status").notNull().default("pending"),
    totalItems: integer("total_items").notNull(),
    pickedItems: integer("picked_items").notNull().default(0),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
});
// Integrations table
export const integrations = pgTable("integrations", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    type: integrationTypeEnum("type").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at"),
    status: text("status").notNull().default("connected"),
    createdAt: timestamp("created_at").defaultNow(),
});
// Returns table
export const returns = pgTable("returns", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    returnNumber: text("return_number").notNull().unique(),
    orderId: varchar("order_id").notNull(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    reason: text("reason").notNull(),
    status: returnStatusEnum("status").notNull().default("pending"),
    type: returnTypeEnum("type").notNull().default("customer_return"),
    refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// Shipments table
export const shipments = pgTable("shipments", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    shipmentNumber: text("shipment_number").notNull().unique(),
    orderId: varchar("order_id").notNull(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    carrier: text("carrier").notNull(),
    trackingNumber: text("tracking_number"),
    status: shipmentStatusEnum("status").notNull().default("pending"),
    shippingAddress: jsonb("shipping_address").notNull(),
    estimatedDelivery: timestamp("estimated_delivery"),
    actualDelivery: timestamp("actual_delivery"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// Payments table
export const payments = pgTable("payments", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    paymentId: text("payment_id").notNull().unique(),
    orderId: varchar("order_id").notNull(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("INR"),
    method: text("method").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    gateway: text("gateway").notNull(),
    transactionId: text("transaction_id"),
    settlementAmount: decimal("settlement_amount", { precision: 10, scale: 2 }),
    fees: decimal("fees", { precision: 10, scale: 2 }),
    invoiceData: jsonb("invoice_data"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
// Activities table
export const activities = pgTable("activities", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    type: activityTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    userId: varchar("user_id"),
    entityId: varchar("entity_id"),
    entityType: text("entity_type"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
});
// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    merchantId: varchar("merchant_id").notNull(),
    userId: varchar("user_id"),
    action: auditActionEnum("action").notNull(),
    resource: text("resource").notNull(),
    resourceId: varchar("resource_id"),
    details: text("details"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").default({}),
    timestamp: timestamp("timestamp").defaultNow(),
});
// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
    id: true,
    createdAt: true,
});
export const insertTenantSchema = createInsertSchema(tenants).omit({
    id: true,
    createdAt: true,
});
export const insertWarehouseSchema = createInsertSchema(warehouses).omit({
    id: true,
    createdAt: true,
});
export const insertProductSchema = createInsertSchema(products).omit({
    id: true,
    createdAt: true,
});
export const insertInventorySchema = createInsertSchema(inventory).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertOrderSchema = createInsertSchema(orders).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
    id: true,
});
export const insertPickSchema = createInsertSchema(picks).omit({
    id: true,
    createdAt: true,
});
export const insertIntegrationSchema = createInsertSchema(integrations).omit({
    id: true,
    createdAt: true,
});
export const insertReturnSchema = createInsertSchema(returns).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertShipmentSchema = createInsertSchema(shipments).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertPaymentSchema = createInsertSchema(payments).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const insertActivitySchema = createInsertSchema(activities).omit({
    id: true,
    createdAt: true,
});
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
    id: true,
    timestamp: true,
});

 routes.ts:
import express, { type Express, Request, Response, NextFunction } from "express";
import http from 'http';
import cors, { type CorsOptions } from "cors";
import { storage } from "./pg-storage.js";
import type { Settings } from "../shared/schema.js";
import { userRoleEnum } from "../shared/schema.js";
import { whatsappService, type WhatsAppMessage } from "./services/whatsapp-service.js";
import { pool } from "./db.js";
import { 
  insertUserSchema, 
  insertOrderSchema, 
  insertPickSchema, 
  insertIntegrationSchema, 
  insertProductSchema, 
  insertInventorySchema, 
  insertPaymentSchema 
} from "../shared/schema.js";
import { z } from "zod";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { 
  authenticateToken, 
  requireRole, 
  generateToken, 
  verifyUserPassword, 
  type AuthenticatedRequest 
} from "./middleware/auth.js";
import { enforceMerchantIsolation, getMerchantId } from "./middleware/tenant.js";
import { hashPassword } from "./utils/password.js";
import { logger } from "./utils/logger.js";
import { InventoryAllocationService } from "./services/inventory-allocation.js";
import { APIIntegrationService } from "./services/api-integrations.js";
import { AlertService } from "./services/alert-service.js";
import { AnalyticsService } from "./services/analytics.js";
import { whatsappWebService } from "./services/whatsapp-web-service.js";
import { getWebSocketService } from "./websocket.js";
import { 
  generateCSV, 
  formatOrdersForExport, 
  formatInventoryForExport, 
  formatPaymentsForExport 
} from "./utils/export.js";
import { 
  generateOrderNumber, 
  generatePickNumber, 
  generateReturnNumber, 
  generateShipmentNumber, 
  generatePaymentId 
} from "./utils/barcode.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { generateCSRFToken, verifyCSRFToken } from "./utils/csrf.js";
import { auditLog } from "./middleware/audit.js";
import { Server } from 'socket.io';

// Allowed order status values used across the application
export type OrderStatus = 'pending' | 'allocated' | 'picking' | 'packing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

const inventoryService = new InventoryAllocationService();
const apiService = new APIIntegrationService();
const alertService = new AlertService();
const analyticsService = new AnalyticsService();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1 // Only 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Separate multer config for invoice uploads (supports PDF, images)
const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size for invoices
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPEG, PNG files are allowed for invoices'));
    }
  }
});

export async function registerRoutes(app: express.Express): Promise<http.Server> {
  // Create HTTP server for WebSocket
  const server = http.createServer(app);
  const io = new Server(server, { 
    cors: { 
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"], 
      methods: ['GET', 'POST'], 
      credentials: true 
    } 
  });
  
  // Ensure database connection is established
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('Database connection verified before setting up routes');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to connect to database', { error: errorMessage });
    throw new Error('Database connection failed');
  }

  // Initialize services
  const inventoryAllocationService = new InventoryAllocationService();
  const apiIntegrationService = new APIIntegrationService();
  const alertService = new AlertService();
  const analyticsService = new AnalyticsService();

  app.get('/api/csrf-token', (req, res) => {
    const csrfToken = generateCSRFToken();
    // Set the token in an HTTP-only cookie for added security
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false, // Needs to be accessible by client-side JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Also send the token in the response body for clients that don't use cookies
    res.json({ csrfToken });
  });

  // CSRF protection middleware
  const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF check for safe HTTP methods
    if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method)) {
      return next();
    }

    // Get token from multiple possible sources
    const csrfToken = (
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'] ||
      (req.cookies && req.cookies['XSRF-TOKEN']) ||
      (req.body && req.body._csrf) ||
      (req.query && req.query._csrf)
    );
    
    if (!csrfToken) {
      logger.warn('CSRF token missing', { 
        url: req.originalUrl,
        method: req.method,
        headers: req.headers
      });
      return res.status(403).json({ 
        success: false,
        message: 'CSRF token is missing',
        code: 'CSRF_TOKEN_MISSING'
      });
    }

    if (!verifyCSRFToken(csrfToken as string)) {
      logger.warn('Invalid CSRF token', { 
        url: req.originalUrl,
        method: req.method 
      });
      return res.status(403).json({ 
        success: false,
        message: 'Invalid CSRF token',
        code: 'INVALID_CSRF_TOKEN'
      });
    }

    // If we got here, the token is valid
    next();
  };

  // Apply CSRF protection to all non-GET routes
  app.use(csrfProtection);
  
    
  // Configure CORS with proper typing
  const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, origin?: string) => void) => {
      // In development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, origin || '*');
      }
      
      // In production, only allow specific origins
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5000')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean) as string[];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-CSRF-Token',
      'X-Requested-With',
      'Accept',
      'X-XSRF-TOKEN'
    ],
    exposedHeaders: ['XSRF-TOKEN'],
    maxAge: 86400 // 24 hours
  };

  app.use(cors(corsOptions));

  // Add request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const { method, originalUrl, headers, ip, body, query, params } = req;
    
    // Skip logging for health checks and static files
    if (originalUrl === '/api/health' || 
        originalUrl.startsWith('/assets/') || 
        originalUrl.startsWith('/_next/')) {
      return next();
    }

    // Log request start
    logger.debug(`→ ${method} ${originalUrl}`, {
      ip,
      headers: {
        'user-agent': headers['user-agent'],
        referer: headers['referer'],
        'content-type': headers['content-type']
      },
      query,
      params,
      body: method === 'POST' || method === 'PUT' || method === 'PATCH' ? body : undefined
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLevel = res.statusCode >= 400 ? 'error' : 'info';
      
      logger.log(logLevel, `← ${method} ${originalUrl} ${res.statusCode} (${duration}ms)`, {
        status: res.statusCode,
        duration,
        'content-length': res.get('content-length'),
        'content-type': res.get('content-type')
      });
    });
    
    next();
  });
  
  // Add error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body
    });
    
    res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });
  
  
  // Apply rate limiting to all API routes (1000 requests per 15 minutes per IP)
  app.use('/api/', rateLimit(15 * 60 * 1000, 1000));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get('/api/csrf-token', (req, res) => {
    const csrfToken = generateCSRFToken();
    // Set the token in an HTTP-only cookie for added security
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false, // Needs to be accessible by client-side JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Also send the token in the response body for clients that don't use cookies
    res.json({ csrfToken });
  });
  
  // More aggressive rate limiting for authentication endpoints (50 requests per 15 minutes per IP)
  app.use('/api/auth/', rateLimit(15 * 60 * 1000, 50));
  
  // Higher limits for data export endpoints (100 requests per 15 minutes per IP)
  app.use('/api/export/', rateLimit(15 * 60 * 1000, 100));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Test route to check database connection (only enabled in non-production and does not leak sensitive data)
  if (process.env.NODE_ENV !== 'production') {
    app.get("/api/test-db", async (req, res) => {
      try {
        const user = await storage.getUserByUsername('admin');
        res.json({ 
          success: true, 
          userFound: !!user, 
          username: user?.username
        });
      } catch (error) {
        res.json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  // Registration route
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { companyName, adminUsername, adminEmail, adminPassword } = req.body;
      
      if (!companyName || !adminUsername || !adminEmail || !adminPassword) {
        logger.warn('Registration attempt with missing fields', { companyName, adminUsername, adminEmail });
        return res.status(400).json({ message: "All fields are required" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(adminUsername);
      if (existingUser) {
        logger.warn('Registration attempt with existing username', { adminUsername });
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Create unique domain with timestamp
      const timestamp = Date.now();
      const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const merchantData = {
        merchant_name: companyName,
        contactEmail: adminEmail,
        contactPhone: "0000000000" // Default phone number
      };
      
      const userData = {
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        role: userRoleEnum.admin
      };
      
      const { merchant, admin: user } = await storage.createMerchantWithAdmin(merchantData, userData);
      
      // Create default warehouse only
      try {
        const warehouse = await storage.createWarehouse({
          merchantId: merchant.merchantId,      
          name: "Main Warehouse",
          address: "123 Business Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
          country: "India",
          capacity: 10000,
          currentOccupancy: 0,
          status: "active"
        });
        
        logger.info('Warehouse created for new merchant', { 
          merchantId: merchant.merchantId, 
          warehouseId: warehouse.id 
        });
      } catch (error) {
        logger.warn('Failed to create warehouse', { merchantId: merchant.merchantId, error: error instanceof Error ? error.message : String(error) });
      }
      
      logger.info('New merchant registration successful', { 
        merchantId: merchant.merchantId, 
        userId: user.user_id, 
        companyName, 
        adminUsername 
      });
      
      res.status(201).json({
        message: "Registration successful",
        merchant: {
          id: merchant.merchantId,
          name: merchant.merchant_name,
        },
        user: {
          id: user.user_id,
          username: user.username,
          role: user.role
        }
      });
      
    } catch (error) {
      logger.error('Registration error', { 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined 
      });
      
      // Handle specific database constraint errors
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        if ('constraint' in error) {
          if (error.constraint === 'users_username_key') {
            return res.status(400).json({ message: "Username already exists" });
          }
          if (error.constraint === 'users_email_key') {
            return res.status(400).json({ message: "Email already exists" });
          }
        }
      }
      
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        const message = "Username and password are required";
        logger.warn('Login attempt with missing credentials', { 
          username: username ? 'provided' : 'missing',
          hasPassword: !!password
        });
        return res.status(400).json({ message });
      }
      
      logger.debug('Login attempt', { username });
      const user = await verifyUserPassword(username, password);
      
      if (!user) {
        logger.warn('Failed login attempt - invalid credentials', { username });
        // Use generic message to avoid user enumeration
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      try {
        const token = await generateToken(user.user_id);
        logger.info('User logged in successfully', { 
          userId: user.user_id,
          username: user.username,
          role: user.role,
          merchantId: user.merchantId
        });
        
        return res.json({ 
          user: { 
            user_id: user.user_id, 
            username: user.username, 
            email: user.email, 
            role: user.role, 
            merchantId: user.merchantId 
          },
          token
        });
      } catch (tokenError) {
        const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
        logger.error('Token generation failed', { 
          userId: user.user_id,
          error: errorMessage,
          stack: tokenError instanceof Error ? tokenError.stack : undefined
        });
        return res.status(500).json({ 
          message: "Authentication error",
          ...(process.env.NODE_ENV === 'development' && { error: errorMessage })
        });
      }
    } catch (error) {
      logger.error('Login error', { 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined 
      });
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      // Map merchantId to merchantId for the response
      const { merchantId, ...rest } = req.user;
      res.json({ ...rest, merchantId: merchantId });
    } catch (error) {
      logger.error('auth_me_error',
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      res.status(500).json({ message: "Failed to fetch current user" });
    }
  });

  // Get user by ID
  app.get("/api/users/:user_id", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.params.user_id);
      if (!user || user.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      logger.error('get_user_by_id_error',
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Could not log out' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Mock warehouses endpoint
  app.get('/api/warehouses', (req, res) => {
    const mockWarehouses = [
      {
        id: 'wh-mumbai',
        name: 'Mumbai Central Warehouse',
        address: '123 Industrial Area',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        capacity: 10000,
        currentOccupancy: 7500,
        status: 'active'
      }
    ];
    
    res.json(mockWarehouses);
  });

  // Mock picks endpoints
  app.get('/api/picks/active', (req, res) => {
    const mockPicks = [
      {
        id: 'pick-001',
        pickNumber: 'PK-2024-001',
        status: 'in_progress',
        totalItems: 15,
        pickedItems: 8,
        warehouseId: 'wh-mumbai'
      }
    ];
    
    res.json(mockPicks);
  });
  
  // Dashboard metrics
  app.get("/api/dashboard/metrics", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const metrics = await storage.getDashboardMetrics(merchantId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Orders routes
  app.get("/api/orders", authenticateToken, enforceMerchantIsolation, auditLog('read', 'orders'), async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      let limit: number | undefined = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      if (limit !== undefined && isNaN(limit)) {
        limit = undefined;
      }
      const orders = await storage.getOrders(merchantId, limit);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/count", authenticateToken, async (req, res) => {
    try {
      const merchantId = req.user!.merchantId;
      const orders = await storage.getOrders(merchantId);
      res.json({ count: orders.length });
    } catch (error) {
      logger.error("Failed to get orders count:", error);
      res.status(500).json({ message: "Failed to get orders count" });
    }
  });

  // Get returns count (placeholder - returns 0 until returns system is implemented)
  app.get("/api/returns/count", authenticateToken, async (req, res) => {
    try {
      // For now, return 0 since returns system is not fully implemented
      res.json({ count: 0 });
    } catch (error) {
      logger.error("Failed to get returns count:", error);
      res.status(500).json({ message: "Failed to get returns count" });
    }
  });

  app.get("/api/orders/:id", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order || order.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'manager', 'owner']), auditLog('create', 'orders'), async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const orderItems = req.body.items || [];
      
      if (!Array.isArray(orderItems) || orderItems.length === 0) {
        return res.status(400).json({ 
          message: "Order must contain at least one item",
          code: "NO_ITEMS"
        });
      }

      // Check inventory for all items before creating the order
      const inventory = await storage.getInventory(merchantId);
      interface OutOfStockItem {
        productId: string;
        sku: string;
        requested: number;
        available: number;
        warehouseId?: string;
      }
      const outOfStockItems: OutOfStockItem[] = [];
      
      for (const item of orderItems) {
        const productInventory = inventory.find(inv => 
          inv.productId === item.productId && 
          inv.warehouseId === (item.warehouseId || req.body.warehouseId)
        );
        
        if (!productInventory || productInventory.onHand < item.quantity) {
          const product = await storage.getProduct(item.productId);
          outOfStockItems.push({
            productId: item.productId,
            sku: item.sku || product?.sku || 'unknown',
            requested: item.quantity,
            available: productInventory?.onHand || 0,
            warehouseId: item.warehouseId || req.body.warehouseId
          });
        }
      }
      
      if (outOfStockItems.length > 0) {
        return res.status(400).json({
          message: "Some items are out of stock",
          code: "OUT_OF_STOCK",
          outOfStockItems
        });
      }
      
      // Generate order number if not provided
      const orderNumber = req.body.orderNumber || generateOrderNumber();
      const orderData = insertOrderSchema.parse({ 
        ...req.body, 
        orderNumber, 
        merchantId, 
        status: 'pending' // Ensure status is set
      });
      
      // Create the order
      const order = await storage.createOrder(orderData);
      
      // Broadcast order update via WebSocket
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastOrderUpdate(merchantId, order);
      }
      
      try {
        // Reserve inventory for the order
        for (const item of orderItems) {
          await storage.reserveInventory({
            merchantId,
            productId: item.productId,
            warehouseId: item.warehouseId || req.body.warehouseId,
            quantity: item.quantity,
            orderId: order.id
          });
        }
        
        logger.info('Inventory reserved for order', { orderId: order.id });
      } catch (reservationError) {
        // If inventory reservation fails, delete the order and return an error
        await storage.deleteOrder(order.id);
        logger.error('Failed to reserve inventory for order', { 
          orderId: order.id, 
          error: reservationError instanceof Error ? reservationError.message : String(reservationError)
        });
        
        return res.status(400).json({
          message: "Failed to reserve inventory for the order",
          code: "INVENTORY_RESERVATION_FAILED",
          details: reservationError instanceof Error ? reservationError.message : String(reservationError)
        });
      }
      
      // Auto-generate payment record for the order
      try {
        const paymentData = {
          merchantId,
          paymentId: generatePaymentId(),
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          amount: order.totalAmount,
          currency: order.currency,
          method: "pending", // Will be updated when actual payment is made
          status: "pending" as const,
          gateway: "system", // Default gateway
          transactionId: null,
          settlementAmount: null,
          fees: null
        };
        
        const payment = await storage.createPayment(paymentData);
        logger.info('Payment record auto-generated for order', { 
          orderId: order.id, 
          paymentId: payment.id 
        });
      } catch (paymentError) {
        logger.error('Failed to auto-generate payment', { 
          orderId: order.id, 
          error: paymentError instanceof Error ? paymentError.message : String(paymentError)
        });
      }
     // Always auto-allocate inventory
const merchant = await storage.getMerchant(merchantId);
if (merchant?.merchantId) {
  try {
    const allocationResult = await inventoryService.allocateInventoryForOrder(order.id);
    logger.info('Order created with auto-allocation', { 
      orderId: order.id, 
      allocationSuccess: allocationResult.success 
    });
  } catch (allocationError) {
    logger.error('Auto-allocation failed for new order', { 
      orderId: order.id, 
      error: allocationError instanceof Error ? allocationError.message : String(allocationError)
    });
  }
}

      // Create activity log
      if (req.user) {
        await storage.createActivity({
          merchantId,
          type: "order_created",
          title: "New order created",
          description: `Order ${order.orderNumber} created for ${order.customerName}`,
          userId: req.user?.user_id,
          entityId: order.id,
          entityType: "order"
        });
      }
      
      res.status(201).json(order);
    } catch (error) {
      logger.error('Order creation failed', { 
        error: error instanceof Error ? error.message : String(error), 
        merchantId: getMerchantId(req) 
      });
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid order data", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.patch("/api/orders/:id", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'manager', 'owner']), auditLog('update', 'orders'), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const order = await storage.updateOrder(id, updates);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Broadcast order update via WebSocket
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastOrderUpdate(getMerchantId(req), order);
      }
      
      res.json(order);
    } catch (error) {
      logger.error('Failed to update order', { 
        error: error instanceof Error ? error.message : String(error),
        orderId: req.params.id
      });
      res.status(500).json({ message: 'Failed to update order' });
    }
  });

  // Warehouse routes
  app.get("/api/warehouses", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      logger.info('Fetching warehouses', { merchantId });
      
      const warehouses = await storage.getWarehouses(merchantId);
      logger.info(`Successfully fetched ${warehouses.length} warehouses`, { merchantId });
      
      // Ensure consistent response format
      const response = warehouses.map(warehouse => ({
        id: warehouse.id,
        name: warehouse.name,
        address: warehouse.address,
        city: warehouse.city,
        state: warehouse.state,
        country: warehouse.country,
        pincode: warehouse.pincode,
        capacity: warehouse.capacity,
        currentOccupancy: warehouse.currentOccupancy,
        status: warehouse.status,
        settings: warehouse.settings || {},
        createdAt: warehouse.createdAt?.toISOString(),
        updatedAt: warehouse.updatedAt?.toISOString(),
      }));
      
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to fetch warehouses', { 
        merchantId: req.merchantId, 
        error: errorMessage,
        stack: errorStack
      });
      
      res.status(500).json({ 
        message: 'Failed to fetch warehouses',
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  app.get("/api/warehouses", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      logger.info('Fetching warehouses', { merchantId });
      
      const warehouses = await storage.getWarehouses(merchantId);
      logger.info(`Successfully fetched ${warehouses.length} warehouses`, { merchantId });
      
      // Ensure consistent response format
      const response = warehouses.map(warehouse => ({
        id: warehouse.id,
        name: warehouse.name,
        address: warehouse.address,
        city: warehouse.city,
        state: warehouse.state,
        country: warehouse.country,
        pincode: warehouse.pincode,
        capacity: warehouse.capacity,
        currentOccupancy: warehouse.currentOccupancy,
        status: warehouse.status,
        settings: warehouse.settings || {},
        createdAt: warehouse.createdAt?.toISOString(),
        updatedAt: warehouse.updatedAt?.toISOString(),
      }));
      
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to fetch warehouses', { 
        merchantId: req.merchantId, 
        error: errorMessage,
        stack: errorStack
      });
      
      res.status(500).json({ 
        message: 'Failed to fetch warehouses',
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  app.get("/api/warehouses", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const warehouses = await storage.getWarehouses(merchantId);
      return res.json(warehouses);
    } catch (error) {
      logger.error('Failed to fetch warehouses', { error: error instanceof Error ? error.message : String(error) });
      return res.status(500).json({ message: 'Failed to fetch warehouses' });
    }
  });

  app.post("/api/warehouses", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const warehouseData = { ...req.body, merchantId: getMerchantId(req) };
      const warehouse = await storage.createWarehouse(warehouseData);
      return res.status(201).json(warehouse);
    } catch (error) {
      logger.error('Failed to create warehouse', { error: error instanceof Error ? error.message : String(error) });
      return res.status(500).json({ message: "Failed to create warehouse" });
    }
  });

  app.patch("/api/warehouses/:id", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const updates = req.body;
      const warehouse = await storage.updateWarehouse(req.params.id, updates);
      if (!warehouse || warehouse.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      return res.json(warehouse);
    } catch (error) {
      logger.error('Failed to update warehouse', { error: error instanceof Error ? error.message : String(error) });
      return res.status(500).json({ message: "Failed to update warehouse" });
    }
  });

  // Picks routes
  app.get("/api/picks", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const picks = await storage.getPicks(merchantId);
      res.json(picks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch picks" });
    }
  });

  app.get("/api/picks/active", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const picks = await storage.getActivePicks(merchantId);
      res.json(picks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active picks" });
    }
  });

  app.post("/api/picks", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const pickNumber = req.body.pickNumber || generatePickNumber();
      const pickData = insertPickSchema.parse({ ...req.body, pickNumber, merchantId: getMerchantId(req) });
      const pick = await storage.createPick(pickData);
      res.status(201).json(pick);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid pick data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create pick" });
    }
  });

  app.patch("/api/picks/:id", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const updates = req.body;
      const pick = await storage.updatePick(req.params.id, updates);
      if (!pick) {
        return res.status(404).json({ message: "Pick not found" });
      }
      res.json(pick);
    } catch (error) {
      res.status(500).json({ message: "Failed to update pick" });
    }
  });

  // Integrations routes
  app.get("/api/integrations", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const integrations = await storage.getIntegrations(merchantId);
      res.json(integrations);
    } catch (error) {
      console.error("/api/integrations error", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const integrationData = insertIntegrationSchema.parse({ ...req.body, merchantId: getMerchantId(req) });
      const integration = await storage.createIntegration(integrationData);
      res.status(201).json(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid integration data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  app.patch("/api/integrations/:id", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const updates = req.body;
      const integration = await storage.updateIntegration(req.params.id, updates);
      
      if (!integration || integration.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "Integration not found" });
      }
      
      res.json(integration);
    } catch (error) {
      res.status(500).json({ message: "Failed to update integration" });
    }
  });

  // Analytics routes
  app.get("/api/analytics", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const days = parseInt(req.query.days as string) || 30;
      const analytics = await analyticsService.getOrderAnalytics(merchantId, days);
      
      // Broadcast analytics update via WebSocket
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastAnalyticsUpdate(merchantId, analytics as any);
      }
      
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Get inventory with specific rate limiting (60 requests per minute)
  app.get("/api/inventory", authenticateToken, enforceMerchantIsolation, rateLimit(1 * 60 * 1000, 60), async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const inventory = await storage.getInventory(merchantId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // Bulk upload inventory (alias route supporting /api/inventory/bulk-upload)
  app.post("/api/inventory/bulk-upload",
    authenticateToken,
    enforceMerchantIsolation,
    rateLimit(5 * 60 * 1000, 10), // 10 requests per 5 minutes
    upload.single('file'),
    async (req: AuthenticatedRequest & { file?: Express.Multer.File }, res) => {
      const merchantId = getMerchantId(req);
      try {
        // Global multer in server/index.ts applies to paths containing '/bulk-upload'
        // so req.file should be available here.
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const results: any[] = [];
        const errors: string[] = [];
        let rowCount = 0;

        // Accept common header variations and normalize
        const REQUIRED_SETS = [
          ["productid", "product_id", "productId"],
          ["warehouseid", "warehouse_id", "warehouseId"],
          ["onhand", "on_hand", "onHand"],
          ["reserved", "Reserved"],
          ["incoming", "Incoming"],
          ["safetystock", "safety_stock", "safetyStock"],
        ];

        const stream = Readable.from(req.file.buffer.toString());
        const processCSV = new Promise<void>((resolve, reject) => {
          let headersValidated = false;
          let missingMessage: string | null = null;

          stream
            .pipe(csv({
              mapHeaders: ({ header }) => header.trim(),
            }))
            .on('headers', (headers: string[]) => {
              const lower = headers.map(h => h.trim());
              const missing: string[] = [];
              for (const set of REQUIRED_SETS) {
                const present = set.some(key => lower.includes(key));
                if (!present) missing.push(set[set.length - 1]); // use camelCase name in error
              }
              if (missing.length > 0) {
                missingMessage = `Missing required headers: ${missing.join(', ')}`;
                // Destroy stream to stop further processing
                (stream as Readable).destroy(new Error(missingMessage));
              }
              headersValidated = true;
            })
            .on('data', (data: any) => {
              rowCount++;
              // Normalize lookups
              const pick = (obj: Record<string, unknown>, keys: string[], fallback: unknown = undefined) => {
                for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k];
                return fallback;
              };

              try {
                const productId = pick(data, ["productid", "product_id", "productId"]);
                const warehouseId = pick(data, ["warehouseid", "warehouse_id", "warehouseId"]);
                const onHand = parseInt(pick(data, ["onhand", "on_hand", "onHand"], '0') as string, 10);
                const reserved = parseInt(pick(data, ["reserved", "Reserved"], '0') as string, 10);
                const incoming = parseInt(pick(data, ["incoming", "Incoming"], '0') as string, 10);
                const safetyStock = parseInt(pick(data, ["safetystock", "safety_stock", "safetyStock"], '0') as string, 10);

                if (!productId) throw new Error('Missing required field: productId');
                if (!warehouseId) throw new Error('Missing required field: warehouseId');
                if (Number.isNaN(onHand) || Number.isNaN(reserved) || Number.isNaN(incoming) || Number.isNaN(safetyStock)) {
                  throw new Error('Invalid numeric value in one or more fields');
                }

                results.push({
                  merchantId,
                  productId,
                  warehouseId,
                  onHand,
                  reserved,
                  incoming,
                  safetyStock,
                });
              } catch (e) {
                errors.push(`Row ${rowCount}: ${e instanceof Error ? e.message : String(e)}`);
              }
            })
            .on('end', () => {
              if (!headersValidated && !missingMessage) {
                missingMessage = 'CSV appears to have no headers row';
              }
              if (missingMessage) {
                return reject(new Error(missingMessage));
              }
              resolve();
            })
            .on('error', (err) => reject(err));
        });

        await processCSV;

        let created = 0;
        const BATCH_SIZE = 200;
        const batchPromises: Promise<Array<{success: boolean; error?: string}>>[] = [];
        
        for (let i = 0; i < results.length; i += BATCH_SIZE) {
          const batch = results.slice(i, i + BATCH_SIZE);
          
          const processRow = async (row: any, index: number) => {
            const rowNumber = i + index + 2; // +2 for 1-based index and header row
            
            try {
              // Validate required fields
              if (!row.productid && !row.product_id) {
                throw new Error('Missing required field: productId');
              }
              if (!row.warehouseid && !row.warehouse_id) {
                throw new Error('Missing required field: warehouseId');
              }
              
              // Parse numeric fields with validation
              const onHand = parseInt(String(row.onhand || row.on_hand || '0'), 10);
              const reserved = parseInt(String(row.reserved || '0'), 10);
              const incoming = parseInt(String(row.incoming || '0'), 10);
              const safetyStock = parseInt(String(row.safetystock || row.safety_stock || '0'), 10);
              
              if (isNaN(onHand) || isNaN(reserved) || isNaN(incoming) || isNaN(safetyStock)) {
                throw new Error('Invalid numeric value in one or more fields');
              }
              
              const inventoryData = {
                merchantId,
                productId: row.productid || row.product_id,
                warehouseId: row.warehouseid || row.warehouse_id,
                onHand,
                reserved,
                incoming,
                safetyStock
              };
              
              await storage.createInventory(inventoryData);
              return { success: true };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              errors.push(`Row ${rowNumber}: ${errorMessage}`);
              return { success: false, error: errorMessage };
            }
          };
          
          const batchPromise = Promise.all(batch.map(processRow));
          batchPromises.push(batchPromise);
        }
        
        try {
          // Wait for all batches to complete
          const batchResults = await Promise.all(batchPromises);
          created = batchResults.flat().filter((r: { success: boolean }) => r.success).length;
          
          // Log inventory upload activity
          const userId = (req as Request).user as { user_id: string } | undefined;
          const activityData = {
            merchantId,
            userId: userId?.user_id,
            type: 'inventory_updated' as const,
            title: 'Bulk Inventory Update',
            description: `Processed ${results.length} rows (${created} created, ${errors.length} errors)`,
            entityId: undefined,
            entityType: 'inventory' as const,
            metadata: {
              ipAddress: req.ip,
              filename: req.file?.originalname || 'unknown',
              rowsProcessed: results.length,
              rowsCreated: created,
              errorCount: errors.length
            }
          };
          await storage.createActivity(activityData);
          
          return res.status(200).json({
            message: 'Inventory upload completed',
            totalRows: results.length,
            created,
            errors: errors.length > 0 ? errors : undefined
          });
          
        } catch (error) {
          // Enhanced error handling with detailed error information
          let errorDetails: { message: string; error: string; details: Record<string, unknown>; stack?: string; code?: string } = {
            message: 'Error processing inventory upload',
            error: 'Unknown error',
            details: {},
            stack: undefined as string | undefined,
            code: 'UPLOAD_ERROR'
          };

          if (error instanceof Error) {
            errorDetails = {
              ...errorDetails,
              error: error.message,
              stack: error.stack,
              details: {
                name: error.name,
                ...((error as any).details ?? {}) // Include any additional error details
              }
            };
            
            // Handle specific error types
            if ('code' in error) {
              errorDetails.code = (error as { code?: string }).code;
            }
            
            // Handle validation errors
            if (error.name === 'ValidationError' || 'errors' in error) {
              errorDetails.code = 'VALIDATION_ERROR';
              errorDetails.details = {
                ...((error as any).errors ?? {}) as Record<string, unknown>,
                ...errorDetails.details
              };
            }
          } else if (typeof error === 'string') {
            errorDetails.error = error;
          }

          // Log the full error for debugging
          logger.error('Error processing inventory upload batches', { 
            error: errorDetails,
            fileInfo: {
              originalname: req.file?.originalname,
              size: req.file?.size,
              mimetype: req.file?.mimetype
            },
            batchInfo: {
              batchSize: results?.length || 0,
              batchIndex: batchPromises.length,
              createdSoFar: created
            }
          });

          // Return error response with appropriate details based on environment
          return res.status(500).json({
            success: false,
            message: errorDetails.message,
            error: errorDetails.error,
            ...(process.env.NODE_ENV === 'development' ? {
              details: errorDetails.details,
              code: errorDetails.code,
              stack: errorDetails.stack
            } : {
              code: errorDetails.code
            })
          });
        }
        
        // Log inventory upload activity
        const user = (req as Request).user as { user_id: string };
        if (user) {
          await storage.createActivity({
            merchantId,
            type: "inventory_updated" as const,
            title: "Bulk inventory upload",
            description: `${created} inventory records uploaded via CSV`,
            userId: user.user_id,
            entityId: undefined,
            entityType: "inventory" as const,
            metadata: {
              ipAddress: req.ip,
              filename: req.file?.originalname || 'unknown',
              rowsProcessed: results.length,
              rowsCreated: created,
              errorCount: errors.length
            }
          });
        }
        
        logger.info('Inventory bulk upload completed', { 
          merchantId, 
          totalRows: results.length, 
          created, 
          errors: errors.length 
        });
        
        return res.json({ 
          message: `Uploaded ${created} inventory records successfully`,
          created,
          totalRows: results.length,
          errors: errors.length > 0 ? errors.slice(0, 50) : undefined
        });

      } catch (error) {
        logger.error('Error processing inventory upload', { 
          error: error instanceof Error ? error.message : String(error),
          merchantId
        });
        return res.status(500).json({ 
          message: "Failed to process inventory upload",
          error: error instanceof Error ? error.message : String(error)
        });
      }
  });

  // Orders upload with inventory validation
  app.post("/api/orders/upload", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'manager', 'owner']), upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const merchantId = getMerchantId(req);
      
      // Check if inventory exists before allowing order upload
      const inventory = await storage.getInventory(merchantId);
      if (inventory.length === 0) {
        return res.status(400).json({ 
          message: "Cannot upload orders without inventory. Please upload inventory first.",
          code: "NO_INVENTORY"
        });
      }

      const results: any[] = [];
      const errors: string[] = [];
      const MAX_ROWS = 5000;
      let rowCount = 0;

      const stream = Readable.from(req.file.buffer.toString());
      
      stream
        .pipe(csv())
        .on('data', (data: any) => {
          rowCount++;
          if (rowCount > MAX_ROWS) {
            return;
          }
          results.push(data);
        })
        .on('end', async () => {
          if (rowCount > MAX_ROWS) {
            return res.status(400).json({ 
              message: `File contains ${rowCount} rows. Maximum allowed is ${MAX_ROWS} rows per upload.` 
            });
          }

          let created = 0;
          let paymentsCreated = 0;
          const BATCH_SIZE = 100;
          
          for (let i = 0; i < results.length; i += BATCH_SIZE) {
            const batch = results.slice(i, i + BATCH_SIZE);
            
            for (const row of batch) {
              try {
                // Validate required fields
                if (!row.orderNumber && !row.order_number) {
                  errors.push(`Row ${i + created + 1}: Missing order number`);
                  continue;
                }
                if (!row.customerName && !row.customer_name) {
                  errors.push(`Row ${i + created + 1}: Missing customer name`);
                  continue;
                }
                if (!row.totalAmount && !row.total_amount) {
                  errors.push(`Row ${i + created + 1}: Missing total amount`);
                  continue;
                }

                const orderData = {
                  merchantId,
                  orderNumber: row.orderNumber || row.order_number,
                  customerName: row.customerName || row.customer_name,
                  customerEmail: row.customerEmail || row.customer_email || null,
                  customerPhone: row.customerPhone || row.customer_phone || null,
                  totalAmount: parseFloat(row.totalAmount || row.total_amount).toFixed(2),
                  currency: row.currency || 'INR',
                  status: (row.status || 'pending') as OrderStatus,
                  priority: parseInt(row.priority || '1'),
                  channel: row.channel || 'Manual Upload',
                  shippingAddress: {
                    street: row.shippingStreet || row.shipping_street || 'Not provided',
                    city: row.shippingCity || row.shipping_city || 'Not provided',
                    state: row.shippingState || row.shipping_state || 'Not provided',
                    pincode: row.shippingPincode || row.shipping_pincode || '000000',
                    country: row.shippingCountry || row.shipping_country || 'India'
                  }
                };
                
                const order = await storage.createOrder(orderData);
                created++;
                
                // Auto-generate payment for each order
                try {
                  const paymentData = {
                    merchantId,
                    paymentId: `PAY-${Date.now()}-${order.id.slice(-6)}`,
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    customerName: order.customerName,
                    amount: order.totalAmount,
                    currency: order.currency,
                    method: row.paymentMethod || "pending",
                    status: "pending" as const,
                    gateway: "system",
                    transactionId: row.transactionId || row.transaction_id || null,
                    settlementAmount: row.settlementAmount ? parseFloat(row.settlementAmount).toFixed(2) : null,
                    fees: row.fees ? parseFloat(row.fees).toFixed(2) : null
                  };
                  
                  await storage.createPayment(paymentData);
                  paymentsCreated++;
                } catch (paymentError) {
                  logger.warn('Failed to create payment for uploaded order', { 
                    orderId: order.id, 
                    error: paymentError instanceof Error ? paymentError.message : String(paymentError)
                  });
                }
              } catch (error) {
                errors.push(`Row ${i + created + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          }
          
          // Log bulk upload activity
          if (req.user) {
            await storage.createActivity({
              merchantId,
              type: "order_created",
              title: "Bulk order upload",
              description: `${created} orders uploaded via CSV with ${paymentsCreated} payment records`,
              userId: req.user?.user_id,
              entityId: null,
              entityType: "order"
            });
          }
          
          logger.info('Order bulk upload completed', { 
            merchantId, 
            totalRows: results.length, 
            created, 
            paymentsCreated,
            errors: errors.length 
          });
          
          res.json({ 
            message: `Uploaded ${created} orders successfully with ${paymentsCreated} payment records`,
            created,
            paymentsCreated,
            totalRows: results.length,
            errors: errors.length > 0 ? errors.slice(0, 50) : undefined
          });
        });
    } catch (error) {
      logger.error('Order upload failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({ message: "Failed to process CSV file" });
    }
  });

  // Integration sync route
  app.post("/api/integrations/:id/sync", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);
      if (!integration || integration.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "Integration not found" });
      }
      
      const merchantId = getMerchantId(req);
      
      // Real API sync based on integration type
      if (integration.type === 'shopify' && integration.config) {
        await apiService.syncShopifyOrders(merchantId, {
          ...(integration.config as Record<string, unknown>),
          integrationId: integration.id
        });
      } else if (integration.type === 'amazon' && integration.config) {
        await apiService.syncAmazonOrders(merchantId, {
          ...(integration.config as Record<string, unknown>),
          integrationId: integration.id
        });
      }
      
      const updatedIntegration = await storage.updateIntegration(req.params.id, {
        lastSyncAt: new Date(),
        status: "connected"
      });
      
      logger.info('Integration sync completed', { 
        integrationId: integration.id, 
        type: integration.type, 
        merchantId 
      });
      
      res.json(updatedIntegration);
    } catch (error) {
      logger.error('Integration sync failed', { 
        integrationId: req.params.id, 
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ message: "Failed to sync integration" });
    }
  });

  app.delete("/api/integrations/:id", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const integration = await storage.getIntegration(req.params.id);
      if (!integration || integration.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "Integration not found" });
      }
      
      const success = await storage.deleteIntegration(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Integration not found" });
      }
      res.json({ message: "Integration deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Inventory allocation routes
  app.post("/api/orders/:id/allocate", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'manager', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order || order.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const result = await inventoryService.allocateInventoryForOrder(req.params.id);
      res.json(result);
    } catch (error) {
      logger.error('Manual allocation failed', { orderId: req.params.id, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to allocate inventory" });
    }
  });

  app.post("/api/orders/:id/deallocate", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'manager', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order || order.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      await inventoryService.deallocateInventoryForOrder(req.params.id);
      res.json({ message: "Inventory deallocated successfully" });
    } catch (error) {
      logger.error('Failed to deallocate inventory', { 
        error: error instanceof Error ? error.message : String(error),
        orderId: req.params.id 
      });
      res.status(500).json({ 
        message: "Failed to deallocate inventory",
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  });

  app.get("/api/analytics/inventory", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const analytics = await analyticsService.getInventoryAnalytics(merchantId);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory analytics" });
    }
  });

  app.get("/api/analytics/financial", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'manager', 'owner', 'finance']), async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const days = parseInt(req.query.days as string) || 30;
      const report = await analyticsService.getFinancialReport(merchantId, days);
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch financial report" });
    }
  });

  // Legacy analytics endpoint for backward compatibility
  app.get("/api/analytics", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      logger.info('Fetching analytics data for tenant', { merchantId });
      
      const orderAnalytics = await analyticsService.getOrderAnalytics(merchantId, 30);
      logger.info('Successfully fetched order analytics', { merchantId });
      
      const result = {
        totalOrders: orderAnalytics.totalOrders,
        totalRevenue: orderAnalytics.totalRevenue,
        averageOrderValue: orderAnalytics.avgOrderValue,
        conversionRate: 0,
        topProducts: [],
        orderTrends: orderAnalytics.dailyTrends,
        channelPerformance: Object.entries(orderAnalytics.channelPerformance).map(([channel, data]) => ({
          channel,
          orders: (data as any).todayOrders ?? (data as any).orders ?? 0,
          revenue: (data as any).todayRevenue ?? (data as any).revenue ?? 0
        }))
      };
      
      logger.debug('Analytics response data', { 
        merchantId, 
        totalOrders: result.totalOrders,
        totalRevenue: result.totalRevenue
      });
      
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to fetch analytics', { 
        error: errorMessage,
        stack: errorStack,
        merchantId: getMerchantId(req)
      });
      
      res.status(500).json({ 
        message: "Failed to fetch analytics",
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  // Shipments routes
  app.get("/api/shipments", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const shipments = await storage.getShipments(merchantId);
      res.json(shipments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipments" });
    }
  });

  // Payments routes
  app.get("/api/payments", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const payments = await storage.getPayments(merchantId);
      res.json(payments || []);
    } catch (error) {
      logger.error('Failed to fetch payments', { error: error instanceof Error ? error.message : String(error), merchantId: getMerchantId(req) });
      // Return empty array instead of error to prevent UI crash
      res.json([]);
    }
  });

  app.patch("/api/payments/:id", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'manager', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment || payment.merchantId !== getMerchantId(req)) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      const updates = req.body;
      const updatedPayment = await storage.updatePayment(req.params.id, updates);
      
      // Log activity for payment status change
      if (req.user && updates.status && updates.status !== payment.status) {
        await storage.createActivity({
          merchantId: getMerchantId(req),
          type: "payment_received",
          title: "Payment status updated",
          description: `Payment ${payment.paymentId} status changed from ${payment.status} to ${updates.status}`,
          userId: req.user?.user_id,
          entityId: payment.id,
          entityType: "payment"
        });
      }
      
      res.json(updatedPayment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  

  // Batch upload payments
  app.post("/api/payments/upload", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'manager', 'owner']), upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
  
      const merchantId = getMerchantId(req);
      const results: any[] = [];
      const errors: string[] = [];
      const MAX_ROWS = 5000;
      let rowCount = 0;

      const stream = Readable.from(req.file.buffer.toString());
      
      stream
        .pipe(csv())
        .on('data', (data: any) => {
          rowCount++;
          if (rowCount > MAX_ROWS) {
            return;
          }
          results.push(data);
        })
        .on('end', async () => {
          if (rowCount > MAX_ROWS) {
            return res.status(400).json({ 
              message: `File contains ${rowCount} rows. Maximum allowed is ${MAX_ROWS} rows per upload.` 
            });
          }

          let created = 0;
          const BATCH_SIZE = 100;
          
          for (let i = 0; i < results.length; i += BATCH_SIZE) {
            const batch = results.slice(i, i + BATCH_SIZE);
            
            for (const row of batch) {
              try {
                // Validate required fields
                if (!row.paymentId && !row.payment_id) {
                  errors.push(`Row ${i + created + 1}: Missing payment ID`);
                  continue;
                }
                if (!row.orderNumber && !row.order_number) {
                  errors.push(`Row ${i + created + 1}: Missing order number`);
                  continue;
                }
                if (!row.amount) {
                  errors.push(`Row ${i + created + 1}: Missing amount`);
                  continue;
                }
  
                const paymentData = {
                  merchantId,
                  paymentId: row.paymentId || row.payment_id,
                  orderId: row.orderId || row.order_id || `ord-${Date.now()}-${created}`,
                  orderNumber: row.orderNumber || row.order_number,
                  customerName: row.customerName || row.customer_name || 'Unknown Customer',
                  amount: parseFloat(row.amount).toFixed(2),
                  currency: row.currency || 'INR',
                  method: row.method || 'Unknown',
                  status: (row.status || 'pending') as any,
                  gateway: row.gateway || 'manual',
                  transactionId: row.transactionId || row.transaction_id || null,
                  settlementAmount: row.settlementAmount ? parseFloat(row.settlementAmount).toFixed(2) : null,
                  fees: row.fees ? parseFloat(row.fees).toFixed(2) : null
                };
                
                await storage.createPayment(paymentData);
                created++;
              } catch (error) {
                errors.push(`Row ${i + created + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          }
          
          // Log bulk upload activity
          if (req.user) {
            await storage.createActivity({
              merchantId,
              type: "payment_received",
              title: "Bulk payment upload",
              description: `${created} payments uploaded via CSV`,
              userId: req.user?.user_id,
              entityId: null,
              entityType: "payment"
            });
          }
          
          logger.info('Payment bulk upload completed', { 
            merchantId, 
            totalRows: results.length, 
            created, 
            errors: errors.length 
          });
          
          res.json({ 
            message: `Uploaded ${created} payments successfully`,
            created,
            totalRows: results.length,
            errors: errors.length > 0 ? errors.slice(0, 50) : undefined
          });
        })
        .on('error', (error) => {
          logger.error('CSV parsing error', { error: error.message });
          res.status(400).json({ message: "Invalid CSV file format" });
        });
    } catch (error) {
      logger.error('Payment upload failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      res.status(500).json({ message: "Failed to process CSV file" });
    }
  });

  // Activities routes
  app.get("/api/activities/recent", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getActivities(merchantId, limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Alert routes
  app.post("/api/alerts/check-stock", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const result = await alertService.checkLowStockAlerts(merchantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to check stock alerts" });
    }
  });

  app.post("/api/alerts/check-orders", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const result = await alertService.checkOrderAlerts(merchantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to check order alerts" });
    }
  });

  // WhatsApp Integration Routes
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      logger.info('WhatsApp webhook received', { body: req.body });
      
      // Handle Twilio WhatsApp webhook
      const { From, Body, MediaUrl0, MediaContentType0, MessageSid } = req.body;
      
      if (!From || !Body) {
        return res.status(400).json({ message: "Invalid WhatsApp message format" });
      }

      // Extract tenant ID from phone number or use default for now
      // In production, you'd map phone numbers to tenants
      const merchantId = getMerchantId(req);
      
      const message: WhatsAppMessage = {
        from: From.replace('whatsapp:', ''),
        body: Body,
        timestamp: new Date(),
        messageId: MessageSid,
        mediaUrl: MediaUrl0,
        mediaType: MediaContentType0
      };

      await whatsappService.handleIncomingMessage(message, merchantId);
      
      res.status(200).send('OK');
    } catch (error) {
      logger.error('WhatsApp webhook error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      res.status(500).json({ message: "Failed to process WhatsApp message" });
    }
  });

  // WhatsApp webhook verification (for Twilio)
  app.get("/api/whatsapp/webhook", (req, res) => {
    const { hub } = req.query;
    if (hub) {
      res.status(200).send(hub);
    } else {
      res.status(400).send('Bad Request');
    }
  });

  // WhatsApp service status and management routes
  app.get("/api/whatsapp/status", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const status = {
        active: true,
        activeSessions: whatsappService.getActiveSessionsCount(),
        lastCleanup: new Date().toISOString()
      };
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get WhatsApp status" });
    }
  });

  app.post("/api/whatsapp/cleanup-sessions", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      whatsappService.clearExpiredSessions();
      res.json({ message: "Expired sessions cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to cleanup sessions" });
    }
  });

  app.get("/api/whatsapp/sessions", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const phoneNumber = req.query.phone as string;
      if (phoneNumber) {
        const session = whatsappService.getSessionByPhone(phoneNumber);
        res.json(session || null);
      } else {
        res.json({ 
          totalSessions: whatsappService.getActiveSessionsCount(),
          message: "Use ?phone=<number> to get specific session details"
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get session information" });
    }
  });

  // Export routes
  app.get("/api/export/orders", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const orders = await storage.getOrders(merchantId);
      const formattedOrders = formatOrdersForExport(orders);
      const csv = generateCSV(formattedOrders, [
        'orderNumber', 'customerName', 'customerEmail', 'totalAmount', 'currency', 
        'status', 'channel', 'createdAt', 'shippingCity', 'shippingState'
      ]);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Failed to export orders" });
    }
  });

  app.get("/api/export/inventory", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const inventory = await storage.getInventory(merchantId);
      const formattedInventory = formatInventoryForExport(inventory);
      const csv = generateCSV(formattedInventory, [
        'productId', 'warehouseId', 'onHand', 'reserved', 'available', 
        'incoming', 'safetyStock', 'status'
      ]);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="inventory-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Failed to export inventory" });
    }
  });

  app.get("/api/export/payments", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const payments = await storage.getPayments(merchantId);
      const formattedPayments = formatPaymentsForExport(payments || []);
      const csv = generateCSV(formattedPayments, [
        'paymentId', 'orderNumber', 'customerName', 'amount', 'currency', 
        'method', 'status', 'gateway', 'transactionId', 'createdAt'
      ]);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payments-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Failed to export payments" });
    }
  });

  // Audit log routes
  app.get("/api/audit-logs", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getAuditLogs(merchantId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Performance metrics
  app.get("/api/metrics/performance", authenticateToken, enforceMerchantIsolation, requireRole(['admin', 'owner']), async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const metrics = {
        apiResponseTime: Math.floor(Math.random() * 200) + 50, // Simulated
        databaseConnections: Math.floor(Math.random() * 10) + 5,
        activeUsers: Math.floor(Math.random() * 20) + 1,
        systemUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch performance metrics" });
    }
  });

  // Auto-check alerts when inventory is updated
  app.post("/api/inventory/auto-check-alerts", authenticateToken, enforceMerchantIsolation, async (req: AuthenticatedRequest, res) => {
    try {
      const merchantId = getMerchantId(req);
      const stockAlerts = await alertService.checkLowStockAlerts(merchantId);
      const orderAlerts = await alertService.checkOrderAlerts(merchantId);
      res.json({ stockAlerts, orderAlerts });
    } catch (error) {
      res.status(500).json({ message: "Failed to check alerts" });
    }
  });

  // Add a health check endpoint
  app.get('/health', (_, res) => {
    return res.status(200).json({ status: 'ok' });
  });

  // Return the server after setting up all route handlers
  // Note: Vite middleware will handle the catch-all routing in development
  if (!server) {
    throw new Error('Failed to create HTTP server');
  }
  
  return server;
}
