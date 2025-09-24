import { Router, Request, Response } from 'express';
import { createUser, findUserByEmail, verifyPassword } from './user.model.ts';
import { logger } from './utils/logger.ts';
import { pool } from './db.ts';
import { createPhantomTokenPair } from './utils/jwt.ts';
import ordersRouter from './orders.ts';
import inventoryRouter from './inventory.ts';
import reportsRouter from './reports.ts';
import invoicesRouter from './invoices.ts';
import { authenticateUser } from './middleware/auth.ts';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

const router = Router();

// Register route
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, phoneNumber, businessName } = req.body;

  if (!username || !email || !password || !phoneNumber || !businessName) {
    return res.status(400).json({ message: 'All fields are required: username, email, password, phone number, and business name' });
  }

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      logger.warn('Registration attempt for existing user', { email: email.substring(0, 3) + '***' });
      return res.status(409).json({ message: 'User with that email already exists' });
    }

    const newUser = await createUser(username, email, password, phoneNumber, businessName);
    if (newUser) {
      logger.info('User registered successfully', { userId: newUser.user_id });
      req.session.userId = newUser.user_id;
      return res.status(201).json({ 
        message: 'User registered successfully', 
        userId: newUser.user_id, 
        username: newUser.username,
        role: newUser.role
      });
    } else {
      return res.status(500).json({ message: 'Failed to register user' });
    }
  } catch (error) {
    logger.error('Registration error', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Login route
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      logger.warn('Failed login attempt - invalid password', { email: email.substring(0, 3) + '***' });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    logger.info('User logged in successfully', { userId: user.user_id });
    req.session.userId = user.user_id;
    
    // Create phantom token pair for enhanced security
    const { phantomToken } = createPhantomTokenPair({
      userId: user.user_id,
      role: user.role,
      merchant_id: user.merchant_id
    });
    
    return res.status(200).json({ 
      message: 'Logged in successfully', 
      userId: user.user_id, 
      username: user.username,
      role: user.role,
      token: phantomToken // Send phantom token to client
    });
  } catch (error) {
    logger.error('Login error', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout route
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error', err instanceof Error ? err.message : String(err));
      return res.status(500).json({ message: 'Failed to log out' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

// Protected route example
router.get('/protected', (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  res.status(200).json({ message: 'You have access to protected data!', userId: req.session.userId });
});

export function registerRoutes(app: Router) {
  // Authentication middleware
  // Removed requireAuth as authenticateUser handles authentication and populates req.user
  
  // Add session debugging middleware for development
  if (process.env.NODE_ENV === 'development') {
    app.use('/api', (req, res, next) => {
      logger.info('API Request Debug', {
        path: req.path,
        method: req.method,
        sessionId: req.sessionID,
        userId: (req as any).session?.userId,
        userIdType: typeof (req as any).session?.userId,
        hasSession: !!(req as any).session,
        cookies: req.headers.cookie ? 'present' : 'none'
      });
      next();
    });
  }
  
  // Register route modules
  app.use('/api/auth', router);
  app.use('/api/orders', authenticateUser, ordersRouter);
  app.use('/api/inventory', authenticateUser, inventoryRouter);
  app.use('/api/reports', authenticateUser, reportsRouter);
  app.use('/api/invoices', authenticateUser, invoicesRouter);
  
  // Add debug endpoint for development
  if (process.env.NODE_ENV === 'development') {
    app.get('/api/debug/verify-user-data', async (req: Request, res: Response) => {
      const client = await pool.connect();
      try {
        // Check for specific user 'mya' and their assignments
        const mayaUser = await client.query(
          'SELECT user_id, merchant_id, username, role FROM oms.users WHERE username = $1',
          ['mya']
        );
        
        if (mayaUser.rows.length === 0) {
          return res.json({ message: 'User mya not found', sessionUserId: (req as any).session?.userId });
        }
        
        const mayaId = mayaUser.rows[0].user_id;
        const merchantId = mayaUser.rows[0].merchant_id;
        
        // Get mya's assigned orders
        const mayaOrders = await client.query(
          'SELECT o.order_id, o.order_source, o.total_amount, o.status, o.created_at, c.name as customer_name FROM oms.orders o LEFT JOIN oms.customers c ON o.customer_id = c.customer_id WHERE o.user_id = $1',
          [mayaId]
        );
        
        // Check current session user
        const currentUserId = (req as any).session?.userId;
        const isCurrentUserMaya = currentUserId && (parseInt(currentUserId) === mayaId || currentUserId === mayaId.toString());
        
        res.json({
          mayaUser: mayaUser.rows[0],
          mayaOrders: mayaOrders.rows,
          currentSessionUserId: currentUserId,
          currentUserIdType: typeof currentUserId,
          isCurrentUserMaya,
          sessionExists: !!(req as any).session,
          sessionId: req.sessionID
        });
      } catch (error) {
        logger.error('Error verifying user data', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to verify user data' });
      } finally {
        client.release();
      }
    });
  }
  

  
  // Profile management endpoints
  app.get('/api/profile', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT username, email, phone_number FROM oms.users WHERE user_id = $1',
        [req.session.userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const user = result.rows[0];
      res.json({
        username: user.username,
        email: user.email,
        phone: user.phone_number || ''
      });
    } catch (error) {
      logger.error('Error fetching profile', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to fetch profile' });
    } finally {
      client.release();
    }
  });
  
  app.put('/api/profile', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { name, email, phone } = req.body;
      
      await client.query('BEGIN');
      
      // Update user profile
      const userResult = await client.query(
        'UPDATE oms.users SET username = $1, email = $2, phone_number = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4 RETURNING username, email, phone_number, merchant_id',
        [name, email, phone, req.session.userId]
      );
      
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      // Also update merchant information
      await client.query(
        'UPDATE oms.merchants SET contact_person_name = $1, email = $2, phone_number = $3, updated_at = CURRENT_TIMESTAMP WHERE merchant_id = $4',
        [name, email, phone, user.merchant_id]
      );
      
      await client.query('COMMIT');
      
      logger.info('Profile and merchant updated successfully', { userId: req.session.userId, merchantId: user.merchant_id });
      res.json({ 
        message: 'Profile updated successfully',
        user: {
          username: user.username,
          email: user.email,
          phone_number: user.phone_number
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating profile', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to update profile' });
    } finally {
      client.release();
    }
  });
  
  app.put('/api/profile/password', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Get current user data
      const userResult = await client.query(
        'SELECT password_hash FROM oms.users WHERE user_id = $1',
        [req.session.userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      // Hash new password and update
      const { hashPassword } = await import('./user.model.ts');
      const newPasswordHash = await hashPassword(newPassword);
      
      await client.query(
        'UPDATE oms.users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [newPasswordHash, req.session.userId]
      );
      
      logger.info('Password changed successfully', { userId: req.session.userId });
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Error changing password', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to change password' });
    } finally {
      client.release();
    }
  });
  
  // User management endpoints (Admin only)
  app.get('/api/users', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const currentUserResult = await client.query(
        'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
        [req.session.userId]
      );
      
      if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const merchantId = currentUserResult.rows[0].merchant_id;
      
      const usersResult = await client.query(
        'SELECT user_id, username, email, phone_number, role, created_at FROM oms.users WHERE merchant_id = $1 ORDER BY created_at DESC',
        [merchantId]
      );
      
      res.json({ users: usersResult.rows });
    } catch (error) {
      logger.error('Error fetching users', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to fetch users' });
    } finally {
      client.release();
    }
  });
  
  app.post('/api/users', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { username, email, phone, role, password } = req.body;
      
      // Verify admin access
      const currentUserResult = await client.query(
        'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
        [req.session.userId]
      );
      
      if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const merchantId = currentUserResult.rows[0].merchant_id;
      
      // Check if email already exists
      const existingUser = await client.query(
        'SELECT user_id FROM oms.users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ message: 'User with this email already exists' });
      }
      
      // Use merchant-provided password
      const { hashPassword } = await import('./user.model.ts');
      const passwordHash = await hashPassword(password);
      
      // Insert new user (only in users table, not merchants)
      const result = await client.query(
        'INSERT INTO oms.users (merchant_id, username, email, phone_number, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, phone_number, role',
        [merchantId, username, email, phone, passwordHash, role]
      );
      
      logger.info('User created successfully', { userId: result.rows[0].user_id, createdBy: req.session.userId });
      res.status(201).json({ 
        message: 'User created successfully with custom password',
        user: result.rows[0]
      });
    } catch (error) {
      logger.error('Error creating user', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to create user' });
    } finally {
      client.release();
    }
  });
  
  app.put('/api/users/:userId/role', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      // Verify admin access
      const currentUserResult = await client.query(
        'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
        [req.session.userId]
      );
      
      if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const merchantId = currentUserResult.rows[0].merchant_id;
      
      // Update user role (only for users in same merchant)
      const result = await client.query(
        'UPDATE oms.users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND merchant_id = $3 RETURNING user_id',
        [role, userId, merchantId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found or access denied' });
      }
      
      logger.info('User role updated', { userId, newRole: role, updatedBy: req.session.userId });
      res.json({ message: 'Role updated successfully' });
    } catch (error) {
      logger.error('Error updating user role', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to update role' });
    } finally {
      client.release();
    }
  });
  
  app.delete('/api/users/:userId', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { userId } = req.params;
      
      // Verify admin access
      const currentUserResult = await client.query(
        'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
        [req.session.userId]
      );
      
      if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const merchantId = currentUserResult.rows[0].merchant_id;
      
      // Prevent admin from deleting themselves
      if (userId === req.session.userId) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }
      
      // Delete user (only from same merchant, and not admin role)
      const result = await client.query(
        'DELETE FROM oms.users WHERE user_id = $1 AND merchant_id = $2 AND role != $3 RETURNING user_id',
        [userId, merchantId, 'admin']
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found, access denied, or cannot delete admin' });
      }
      
      logger.info('User deleted', { userId, deletedBy: req.session.userId });
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      logger.error('Error deleting user', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to delete user' });
    } finally {
      client.release();
    }
  });
  
  // Order assignment endpoints - using order_status_history for tracking
  app.post('/api/orders/assign', async (req: Request, res: Response) => {
    logger.info('Order assignment request', { body: req.body, userId: req.session.userId });
    
    const client = await pool.connect();
    try {
      const { orderId, userId, deliveryNotes } = req.body;
      
      if (!orderId || !userId) {
        logger.error('Missing required fields', { orderId, userId });
        return res.status(400).json({ message: 'Order ID and User ID are required' });
      }
      
      // Verify admin access
      const currentUserResult = await client.query(
        'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
        [req.session.userId]
      );
      
      logger.info('Current user check', { currentUser: currentUserResult.rows[0] });
      
      if (currentUserResult.rows.length === 0 || currentUserResult.rows[0].role !== 'admin') {
        logger.error('Access denied - not admin', { role: currentUserResult.rows[0]?.role });
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const merchantId = currentUserResult.rows[0].merchant_id;
      
      // Check if order exists
      const orderCheck = await client.query(
        'SELECT order_id, status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
        [orderId, merchantId]
      );
      
      logger.info('Order check result', { orderExists: orderCheck.rows.length > 0, order: orderCheck.rows[0] });
      
      if (orderCheck.rows.length === 0) {
        logger.error('Order not found', { orderId, merchantId });
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Check if user exists and belongs to same merchant
      const userCheck = await client.query(
        'SELECT user_id FROM oms.users WHERE user_id = $1 AND merchant_id = $2',
        [userId, merchantId]
      );
      
      logger.info('User check result', { userExists: userCheck.rows.length > 0 });
      
      if (userCheck.rows.length === 0) {
        logger.error('User not found or different merchant', { userId, merchantId });
        return res.status(404).json({ message: 'User not found' });
      }
      
      await client.query('BEGIN');
      
      const oldStatus = orderCheck.rows[0].status;
      logger.info('About to update order', { orderId, userId, oldStatus, merchantId });
      
      // Update order with assigned user (using existing user_id column)
      try {
        const result = await client.query(
          'UPDATE oms.orders SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3 RETURNING *',
          [userId, orderId, merchantId]
        );
        
        logger.info('Order update successful', { rowsAffected: result.rowCount, orderId, userId });
        
        // Log assignment in order status history
        await client.query(
          'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
          [orderId, oldStatus, oldStatus, req.session.userId]
        );
        
        logger.info('Status history logged successfully');
        
        await client.query('COMMIT');
      } catch (updateError) {
        console.error('Raw database error:', updateError);
        logger.error('Database update failed', updateError instanceof Error ? updateError.message : String(updateError));
        throw updateError;
      }
      
      logger.info('Order assigned successfully', { orderId, userId, assignedBy: req.session.userId });
      res.json({ message: 'Order assigned successfully', deliveryNotes });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error assigning order - detailed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        orderId: req.body.orderId,
        userId: req.body.userId
      });
      res.status(500).json({ message: 'Failed to assign order', error: error instanceof Error ? error.message : String(error) });
    } finally {
      client.release();
    }
  });
  
  // Employee endpoints - using actual schema
  app.get('/api/employee/assigned-orders', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT o.order_id, o.order_date, o.total_amount, o.status, o.order_source,
               c.name as customer_name, c.phone as customer_phone, c.address as delivery_address
        FROM oms.orders o
        LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
        WHERE o.user_id = $1 AND o.status = 'shipped'
        ORDER BY o.order_date DESC
      `, [req.session.userId]);
      
      res.json({ orders: result.rows });
    } catch (error) {
      logger.error('Error fetching assigned orders', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to fetch assigned orders' });
    } finally {
      client.release();
    }
  });
  
  app.get('/api/employee/orders', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT o.order_id, o.order_date, o.total_amount, o.status, o.order_source,
               c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as delivery_address
        FROM oms.orders o
        LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
        WHERE o.user_id = $1
        ORDER BY o.order_date DESC
      `, [req.session.userId]);
      
      res.json({ orders: result.rows });
    } catch (error) {
      logger.error('Error fetching employee orders', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to fetch orders' });
    } finally {
      client.release();
    }
  });
  
  app.put('/api/employee/orders/:orderId/status', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      logger.info('PUT /api/employee/orders/:orderId/status', { orderId, status, userId: req.session.userId });
      
      // Validate status value - using database constraint values
      const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        logger.error('Invalid status value', { status, validStatuses });
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      
      await client.query('BEGIN');
      
      // Get current status
      const currentOrder = await client.query(
        'SELECT status FROM oms.orders WHERE order_id = $1 AND user_id = $2',
        [orderId, req.session.userId]
      );
      
      if (currentOrder.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Order not found or not assigned to you' });
      }
      
      const oldStatus = currentOrder.rows[0].status;
      logger.info('Status update details', { orderId, oldStatus, newStatus: status });
      
      // Update order status
      await client.query(
        'UPDATE oms.orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND user_id = $3',
        [status, orderId, req.session.userId]
      );
      
      // Log status change
      await client.query(
        'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
        [orderId, oldStatus, status, req.session.userId]
      );
      
      await client.query('COMMIT');
      
      logger.info('Order status updated by employee', { orderId, status, userId: req.session.userId });
      res.json({ message: 'Order status updated successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating order status | Data:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Failed to update order status' });
    } finally {
      client.release();
    }
  });
}