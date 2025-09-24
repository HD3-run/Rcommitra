import { Router, Request, Response } from 'express';
import { pool } from './db.ts';
import { logger } from './utils/logger.ts';
import { validateOrder, ValidationResult } from './utils/validation.ts';
import { validatePagination, validateQuantity } from './middleware/validation.ts';
import { ORDER_STATUS, PAYMENT_METHODS, MESSAGES } from './utils/constants.ts';
import { authenticateUser } from './middleware/auth.ts';
import { cacheMiddleware, invalidateCache } from './middleware/cache.ts';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Get all orders with pagination and filtering
router.get('/', validatePagination, cacheMiddleware(30), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { page = 1, limit = 10, status, channel, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Math.min(Number(limit), 100); // Cap at 100
    
    // Get user info from session
    const userResult = await client.query(
      'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      logger.error('User not found in orders endpoint', {
        userId: (req as any).session.userId,
        sessionId: req.sessionID
      });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId, role } = userResult.rows[0];
    
    if (process.env.NODE_ENV === 'development') {
      logger.info('Orders endpoint called', {
        userId: (req as any).session.userId,
        role: role,
        merchantId: merchantId,
        queryParams: { page, limit, status, channel, search }
      });
    }
    
    // Optimized query with selective fields and proper joins
    let query = `
      SELECT o.order_id, o.customer_id, o.order_source, o.total_amount, o.status, 
             o.payment_status, o.payment_method, o.created_at, o.updated_at,
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             COALESCE(p.amount, 0.00) as paid_amount,
             COUNT(*) OVER() as total_count
      FROM oms.orders o 
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      LEFT JOIN oms.order_payments p ON o.order_id = p.order_id
      WHERE o.merchant_id = $1
    `;
    const params: any[] = [merchantId];
    let paramIndex = 2;
    
    // If user is not admin, only show their assigned orders
    if (role !== 'admin') {
      query += ` AND o.user_id = $${paramIndex}`;
      params.push((req as any).session.userId);
      paramIndex++;
      
      if (process.env.NODE_ENV === 'development') {
        logger.info('Non-admin user - filtering by user_id', {
          userId: (req as any).session.userId,
          userIdType: typeof (req as any).session.userId,
          role: role
        });
      }
    }

    if (status && status !== 'all') {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (channel && channel !== 'all') {
      query += ` AND o.order_source = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    if (search) {
      query += ` AND o.order_id = $${paramIndex}`;
      params.push(Number(search) || 0);
      paramIndex++;
    }

    query += ` ORDER BY o.order_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    if (process.env.NODE_ENV === 'development') {
      logger.info('Executing orders query', {
        query: query.replace(/\s+/g, ' '),
        params: params
      });
    }

    const result = await client.query(query, params);
    
    if (process.env.NODE_ENV === 'development') {
      logger.info('Orders query result', {
        rowCount: result.rows.length,
        totalCount: result.rows[0]?.total_count || 0,
        sampleRow: result.rows[0] ? {
          order_id: result.rows[0].order_id,
          customer_name: result.rows[0].customer_name,
          status: result.rows[0].status,
          total_amount: result.rows[0].total_amount
        } : null
      });
    }
    
    // Enhanced response with debug info
    const response = {
      orders: result.rows,
      pagination: {
        page: Number(page),
        limit: limitNum,
        total: result.rows[0]?.total_count || 0,
        totalPages: Math.ceil((result.rows[0]?.total_count || 0) / limitNum)
      }
    };
    
    if (process.env.NODE_ENV === 'development') {
      (response as any).debug = {
        queryParams: { page, limit, status, channel, search },
        userRole: role,
        merchantId,
        userId: (req as any).session.userId,
        userIdType: typeof (req as any).session.userId,
        queryExecuted: query.replace(/\s+/g, ' '),
        params: params,
        resultCount: result.rows.length
      };
    }
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching orders', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: (req as any).session.userId,
      query: req.query,
      path: req.path
    });
    res.status(500).json({ 
      message: 'Failed to fetch orders',
      debug: process.env.NODE_ENV === 'development' ? {
        error: error instanceof Error ? error.message : String(error)
      } : undefined
    });
  } finally {
    client.release();
  }
});

// Add manual order endpoint
router.post('/add-manual', validateQuantity, async (req: Request, res: Response) => {
  logger.info('Manual order creation request', { body: req.body, userId: (req as any).session.userId });
  
  const client = await pool.connect();
  try {
    // Get merchant ID from current user session
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      logger.error('User not found for manual order', { userId: (req as any).session.userId });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    await client.query('BEGIN');
    
    const { customerName, customerPhone, customerEmail, customerAddress, productName, quantity, unitPrice, orderSource, totalAmount = quantity * unitPrice } = req.body;

    // Create or find customer
    let customerId;
    const customerResult = await client.query(
      'SELECT customer_id FROM oms.customers WHERE phone = $1 AND merchant_id = $2',
      [customerPhone, merchantId]
    );
    
    if (customerResult.rows.length > 0) {
      customerId = customerResult.rows[0].customer_id;
    } else {
      const newCustomer = await client.query(
        'INSERT INTO oms.customers (merchant_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id',
        [merchantId, customerName, customerPhone, customerEmail, customerAddress]
      );
      customerId = newCustomer.rows[0].customer_id;
    }
    
    // Create order
    const orderResult = await client.query(
      'INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [merchantId, customerId, orderSource, totalAmount, 'pending']
    );
    
    const order = orderResult.rows[0];
    
    // Check if product exists in inventory
    const inventoryResult = await client.query(
      'SELECT p.product_id, i.quantity_available, i.cost_price FROM oms.products p JOIN oms.inventory i ON p.product_id = i.product_id WHERE p.product_name = $1 AND p.merchant_id = $2',
      [productName, merchantId]
    );
    
    if (inventoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Product "${productName}" not found in inventory. Please add it to inventory first.` });
    }
    
    const productId = inventoryResult.rows[0].product_id;
    const availableStock = inventoryResult.rows[0].quantity_available;
    const costPrice = inventoryResult.rows[0].cost_price || unitPrice;
    
    if (availableStock < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Insufficient stock for "${productName}". Available: ${availableStock}, Required: ${quantity}` });
    }
    
    // Create order item with cost_price from inventory
    await client.query(
      'INSERT INTO oms.order_items (order_id, product_id, sku, quantity, price_per_unit, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
      [order.order_id, productId, `SKU-${productId}`, quantity, costPrice, quantity * costPrice]
    );
    
    // Update inventory - deduct ordered quantity
    await client.query(
      'UPDATE oms.inventory SET quantity_available = quantity_available - $1 WHERE product_id = $2 AND merchant_id = $3',
      [quantity, productId, merchantId]
    );
    
    await client.query('COMMIT');
    
    // Invalidate cache after creating order
    invalidateCache('/api/orders');
    
    logger.info('Manual order created successfully', { orderId: order.order_id });
    res.status(201).json(order);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating manual order', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// Create new order
router.post('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    // Get merchant ID from current user session
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    await client.query('BEGIN');
    
    const { channel, items, totalAmount } = req.body;

    // Insert order
    const orderResult = await client.query(`
      INSERT INTO oms.orders (merchant_id, order_source, total_amount, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `, [merchantId, channel, totalAmount]);

    const order = orderResult.rows[0];

    // Insert order items
    for (const item of items) {
      await client.query(`
        INSERT INTO oms.order_items (order_id, product_id, sku, quantity, price_per_unit, total_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [order.order_id, item.productId, item.sku || 'SKU', item.quantity, item.unitPrice, item.totalPrice]);

      // Update inventory
      await client.query(`
        UPDATE oms.inventory 
        SET quantity_available = quantity_available - $1
        WHERE product_id = $2 AND merchant_id = $3
      `, [item.quantity, item.productId, merchantId]);
    }

    await client.query('COMMIT');
    
    // Invalidate cache after creating order
    invalidateCache('/api/orders');
    
    logger.info('Order created successfully', { orderId: order.order_id });
    res.status(201).json(order);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating order', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to create order' });
  } finally {
    client.release();
  }
});



// CSV upload endpoint
router.post('/upload-csv', upload.single('file'), async (req: Request, res: Response) => {
  logger.info('CSV upload started', { fileName: req.file?.originalname, userId: (req as any).session.userId });
  
  const client = await pool.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get merchant ID from current user session
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      logger.error('User not found for CSV upload', { userId: (req as any).session.userId });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    logger.info('Processing CSV for merchant', { merchantId, userId: (req as any).session.userId });
    const orders: any[] = [];
    const errors: string[] = [];

    // Parse CSV
    const stream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          try {
            // Expected CSV columns: customer_name, customer_phone, customer_email, customer_address, product_name, quantity, unit_price, order_source
            const order: { [key: string]: any } = {
              customerName: row.customer_name || row['Customer Name'],
              customerPhone: row.customer_phone || row['Customer Phone'],
              customerEmail: row.customer_email || row['Customer Email'],
              customerAddress: row.customer_address || row['Customer Address'],
              productName: row.product_name || row['Product Name'],
              quantity: parseInt(row.quantity || row['Quantity'], 10),
              unitPrice: parseFloat(row.unit_price || row['Unit Price']),
              orderSource: row.order_source || row['Order Source'] || 'CSV',
              totalAmount: parseFloat(row.total_amount || row['Total Amount']) || (parseInt(row.quantity || row['Quantity'], 10) * parseFloat(row.unit_price || row['Unit Price']))
            };
            
            if (!order.customerName || !order.productName) {
              errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
              return;
            }
            
            order.totalAmount = order.quantity * order.unitPrice;
            orders.push(order);
          } catch (error) {
            errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (orders.length === 0) {
      return res.status(400).json({ message: 'No valid orders found in CSV', errors });
    }

    await client.query('BEGIN');
    
    const createdOrders = [];
    
    for (const orderData of orders) {
      try {
        logger.info('Processing order data', { customerName: orderData.customerName, productName: orderData.productName });
        
        // Create or find customer
        let customerId;
        const customerResult = await client.query(
          'SELECT customer_id FROM oms.customers WHERE phone = $1 AND merchant_id = $2',
          [orderData.customerPhone, merchantId]
        );
        
        if (customerResult.rows.length > 0) {
          customerId = customerResult.rows[0].customer_id;
          logger.info('Found existing customer', { customerId });
        } else {
          const newCustomer = await client.query(
            'INSERT INTO oms.customers (merchant_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id',
            [merchantId, orderData.customerName, orderData.customerPhone, orderData.customerEmail, orderData.customerAddress]
          );
          customerId = newCustomer.rows[0].customer_id;
          logger.info('Created new customer', { customerId });
        }
        
        // Create order
        const orderResult = await client.query(
          'INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [merchantId, customerId, orderData.orderSource, orderData.totalAmount, 'pending']
        );
        
        const order = orderResult.rows[0];
        logger.info('Created order', { orderId: order.order_id });
        
        // Check if product exists in inventory
        const inventoryResult = await client.query(
          'SELECT p.product_id, i.quantity_available, i.cost_price FROM oms.products p JOIN oms.inventory i ON p.product_id = i.product_id WHERE p.product_name = $1 AND p.merchant_id = $2',
          [orderData.productName, merchantId]
        );
        
        if (inventoryResult.rows.length === 0) {
          errors.push(`Product "${orderData.productName}" not found in inventory. Please add it to inventory first.`);
          continue;
        }
        
        const productId = inventoryResult.rows[0].product_id;
        const availableStock = inventoryResult.rows[0].quantity_available;
        const costPrice = inventoryResult.rows[0].cost_price || orderData.unitPrice;
        
        if (availableStock < orderData.quantity) {
          errors.push(`Insufficient stock for "${orderData.productName}". Available: ${availableStock}, Required: ${orderData.quantity}`);
          continue;
        }
        
        logger.info('Product found in inventory', { productId, availableStock, costPrice });
        
        // Create order item with cost_price from inventory
        await client.query(
          'INSERT INTO oms.order_items (order_id, product_id, sku, quantity, price_per_unit, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
          [order.order_id, productId, `SKU-${productId}`, orderData.quantity, costPrice, orderData.quantity * costPrice]
        );
        
        // Update inventory - deduct ordered quantity
        await client.query(
          'UPDATE oms.inventory SET quantity_available = quantity_available - $1 WHERE product_id = $2 AND merchant_id = $3',
          [orderData.quantity, productId, merchantId]
        );
        
        logger.info('Created order item', { orderId: order.order_id, productId });
createdOrders.push(order as never);
      } catch (error: any) {
        errors.push(`Error creating order for ${orderData.customerName}: ${String(error)}`);
      }
    }
    
    await client.query('COMMIT');
    
    logger.info('CSV orders processed', { 
      totalRows: orders.length, 
      created: createdOrders.length, 
      errors: errors.length 
    });
    
    res.json({
      message: `Successfully processed ${createdOrders.length} orders`,
      created: createdOrders.length,
      errors: errors.length,
      errorDetails: errors
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error processing CSV upload', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to process CSV upload', error: error instanceof Error ? error.message : String(error) });
  } finally {
    client.release();
  }
});

// Create sample data for testing
router.post('/create-sample', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    await client.query('BEGIN');
    
    // Create sample customer
    const customerResult = await client.query(
      'INSERT INTO oms.customers (merchant_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id',
      [merchantId, 'Sample Customer', '+1234567890', 'customer@example.com', '123 Sample Street']
    );
    
    const customerId = customerResult.rows[0].customer_id;
    
    // Create sample product
    const productResult = await client.query(
      'INSERT INTO oms.products (merchant_id, product_name, sku, category) VALUES ($1, $2, $3, $4) RETURNING product_id',
      [merchantId, 'Sample Product', 'SKU-001', 'Electronics']
    );
    
    const productId = productResult.rows[0].product_id;
    
    // Create sample inventory
    await client.query(
      'INSERT INTO oms.inventory (merchant_id, product_id, quantity_available, reorder_level) VALUES ($1, $2, $3, $4)',
      [merchantId, productId, 100, 10]
    );
    
    // Create sample order
    const orderResult = await client.query(
      'INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [merchantId, customerId, 'Manual', 99.99, 'pending']
    );
    
    const orderId = orderResult.rows[0].order_id;
    
    // Create order item
    await client.query(
      'INSERT INTO oms.order_items (order_id, product_id, sku, quantity, price_per_unit, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
      [orderId, productId, 'SKU-001', 1, 99.99, 99.99]
    );
    
    await client.query('COMMIT');
    
    res.json({ message: 'Sample data created successfully', orderId, productId, customerId });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating sample data', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to create sample data' });
  } finally {
    client.release();
  }
});

// Debug endpoint - only available in development
if (process.env.NODE_ENV === 'development') {
  router.get('/debug', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT merchant_id, role, username FROM oms.users WHERE user_id = $1',
        [(req as any).session.userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({ message: MESSAGES.USER_NOT_FOUND });
      }
      
      const { merchant_id: merchantId, role, username } = userResult.rows[0];
      
      // Enhanced debug information
      const [ordersCount, assignedCount, usersCount, productsCount, specificAssignedOrders] = await Promise.all([
        client.query('SELECT COUNT(*) as total FROM oms.orders WHERE merchant_id = $1', [merchantId]),
        client.query('SELECT COUNT(*) as assigned FROM oms.orders WHERE merchant_id = $1 AND user_id = $2', [merchantId, (req as any).session.userId]),
        client.query('SELECT user_id, username, role FROM oms.users WHERE merchant_id = $1', [merchantId]),
        client.query('SELECT COUNT(*) as total FROM oms.products WHERE merchant_id = $1', [merchantId]),
        client.query('SELECT o.order_id, o.order_source, o.total_amount, o.status, o.created_at, c.name as customer_name FROM oms.orders o LEFT JOIN oms.customers c ON o.customer_id = c.customer_id WHERE o.merchant_id = $1 AND o.user_id = $2', [merchantId, (req as any).session.userId])
      ]);
      
      res.json({
        user: { role, merchantId, userId: (req as any).session.userId, username },
        data: {
          totalOrders: ordersCount.rows[0].total,
          assignedOrders: assignedCount.rows[0].assigned,
          totalProducts: productsCount.rows[0].total
        },
        assignedOrderDetails: specificAssignedOrders.rows,
        allUsers: usersCount.rows,
        sessionInfo: {
          sessionId: req.sessionID,
          hasSession: !!(req as any).session,
          sessionUserId: (req as any).session?.userId,
          sessionUserIdType: typeof (req as any).session?.userId
        }
      });
    } catch (error) {
      logger.error('Debug endpoint error', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Debug failed', error: error instanceof Error ? error.message : String(error) });
    } finally {
      client.release();
    }
  });
}

// Update payment status
router.patch('/:id/payment', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, paymentMethod, amount } = req.body;
    
    // Get user info from session
    const userResult = await client.query(
      'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId } = userResult.rows[0];
    
    // Validate payment status
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validPaymentStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}` });
    }
    
    // Validate payment method if provided
    if (paymentMethod && !Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
      return res.status(400).json({ message: `Invalid payment method. Must be one of: ${Object.values(PAYMENT_METHODS).join(', ')}` });
    }
    
    await client.query('BEGIN');
    
    // Check if order exists and belongs to merchant
    const orderResult = await client.query(
      'SELECT order_id, total_amount FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
      [id, merchantId]
    );
    
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const orderAmount = orderResult.rows[0].total_amount;
    const paymentAmount = amount || orderAmount;
    
    // Check if payment record exists
    const existingPayment = await client.query(
      'SELECT payment_id FROM oms.order_payments WHERE order_id = $1',
      [id]
    );
    
    if (existingPayment.rows.length > 0) {
      // Update existing payment
      await client.query(
        'UPDATE oms.order_payments SET status = $1, payment_method = $2, amount = $3, payment_date = CURRENT_TIMESTAMP WHERE order_id = $4',
        [status, paymentMethod || 'cash', paymentAmount, id]
      );
    } else {
      // Create new payment record
      await client.query(
        'INSERT INTO oms.order_payments (order_id, status, payment_method, amount, payment_date) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
        [id, status, paymentMethod || 'cash', paymentAmount]
      );
    }
    
    // Update orders table payment_status, total_amount, and payment_method
    await client.query(
      'UPDATE oms.orders SET payment_status = $1, total_amount = $2, payment_method = $3, updated_at = CURRENT_TIMESTAMP WHERE order_id = $4 AND merchant_id = $5',
      [status, paymentAmount, paymentMethod || 'cash', id, merchantId]
    );
    
    await client.query('COMMIT');
    
    logger.info('Payment status updated', { orderId: id, status, paymentMethod, amount: paymentAmount });
    res.json({ message: 'Payment status updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating payment status', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update payment status' });
  } finally {
    client.release();
  }
});

// Assign order to user
router.post('/assign', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { orderId, userId, deliveryNotes } = req.body;
    
    // Get admin info from session
    const userResult = await client.query(
      'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId, role } = userResult.rows[0];
    
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can assign orders' });
    }
    
    await client.query('BEGIN');
    
    // Get current order status
    const currentOrder = await client.query(
      'SELECT status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
      [orderId, merchantId]
    );
    
    if (currentOrder.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const oldStatus = currentOrder.rows[0].status;
    
    // Update order with assigned user
    await client.query(
      'UPDATE oms.orders SET user_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE order_id = $3 AND merchant_id = $4',
      [userId, 'confirmed', orderId, merchantId]
    );
    
    // Log status change from pending to confirmed
    await client.query(
      'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
      [orderId, oldStatus, 'confirmed', (req as any).session.userId]
    );
    
    await client.query('COMMIT');
    
    logger.info('Order assigned to user', { orderId, userId, assignedBy: (req as any).session.userId });
    res.json({ message: 'Order assigned successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error assigning order', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to assign order' });
  } finally {
    client.release();
  }
});

// Admin order status update
router.patch('/:id/status', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Get user info from session
    const userResult = await client.query(
      'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId, role } = userResult.rows[0];
    
    // Validate status value using constants
    const validStatuses = Object.values(ORDER_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    
    await client.query('BEGIN');
    
    // Get current status
    const currentOrder = await client.query(
      'SELECT status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
      [id, merchantId]
    );
    
    if (currentOrder.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const oldStatus = currentOrder.rows[0].status;
    
    // Update order status
    await client.query(
      'UPDATE oms.orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3',
      [status, id, merchantId]
    );
    
    // Log status change
    await client.query(
      'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
      [id, oldStatus, status, (req as any).session.userId]
    );
    
    await client.query('COMMIT');
    
    // Invalidate cache after status update
    invalidateCache('/api/orders');
    
    logger.info('Order status updated by admin', { orderId: id, status, userId: (req as any).session.userId });
    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating order status', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update order status' });
  } finally {
    client.release();
  }
});

export default router;