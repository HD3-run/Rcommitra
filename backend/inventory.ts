import { Router, Request, Response } from 'express';
import { pool } from './db.ts';
import { logger } from './utils/logger.ts';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Get all products with pagination and filtering
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { page = 1, limit = 10, category, search, lowStock } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    let query = `
      SELECT p.*, i.quantity_available, i.reorder_level, i.cost_price as unit_price,
             COUNT(*) OVER() as total_count,
             CASE WHEN i.quantity_available <= i.reorder_level THEN true ELSE false END as is_low_stock
      FROM oms.products p 
      LEFT JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = $1
    `;
    const params: any[] = [merchantId];
    let paramIndex = 2;

    if (category && category !== 'all') {
      query += ` AND p.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.product_name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (lowStock === 'true') {
      query += ` AND i.quantity_available <= i.reorder_level`;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await client.query(query, params);
    
    res.json({
      products: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.rows[0]?.total_count || 0,
        totalPages: Math.ceil((result.rows[0]?.total_count || 0) / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching products', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch products' });
  } finally {
    client.release();
  }
});

// Create new product
router.post('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { name, sku, description, category } = req.body;
    
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;

    const result = await client.query(`
      INSERT INTO oms.products (merchant_id, product_name, sku, description, category)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [merchantId, name, sku, description, category]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating product', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to create product' });
  } finally {
    client.release();
  }
});

// Update product
router.put('/:id', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, sku, description, category } = req.body;
    
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;

    const result = await client.query(`
      UPDATE oms.products 
      SET product_name = $1, sku = $2, description = $3, category = $4, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $5 AND merchant_id = $6
      RETURNING *
    `, [name, sku, description, category, id, merchantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating product', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update product' });
  } finally {
    client.release();
  }
});

// Get low stock products
router.get('/low-stock', async (req: Request, res: Response) => {
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
    
    const result = await client.query(`
      SELECT p.*, i.quantity_available, i.reorder_level
      FROM oms.products p 
      JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = $1 AND i.quantity_available <= i.reorder_level
      ORDER BY i.quantity_available ASC
    `, [merchantId]);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching low stock products', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch low stock products' });
  } finally {
    client.release();
  }
});

// Bulk update inventory
router.post('/bulk-update', async (req: Request, res: Response) => {
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
    
    const { updates } = req.body;
    const results = [];

    for (const update of updates) {
      const result = await client.query(`
        UPDATE oms.inventory 
        SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP
        WHERE sku = $2 AND merchant_id = $3
        RETURNING *
      `, [update.stockQuantity, update.sku, merchantId]);

      if (result.rows.length > 0) {
        results.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');
    
    res.json({ message: `${results.length} products updated successfully`, products: results });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error bulk updating inventory', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update inventory' });
  } finally {
    client.release();
  }
});



// CSV upload endpoint for inventory
router.post('/upload-csv', upload.single('file'), async (req: Request, res: Response) => {
  logger.info('POST /api/inventory/upload-csv - Request received', { 
    fileName: req.file?.originalname,
    fileSize: req.file?.size,
    userId: (req as any).session?.userId,
    sessionExists: !!(req as any).session
  });
  
  const client = await pool.connect();
  try {
    if (!req.file) {
      logger.error('No file uploaded');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    logger.info('User lookup for CSV upload', { userFound: userResult.rows.length > 0, userId: (req as any).session.userId });
    
    if (userResult.rows.length === 0) {
      logger.error('User not found for CSV upload', { userId: (req as any).session.userId });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    logger.info('Processing CSV for merchant', { merchantId });
    const products: any[] = [];
    const errors: string[] = [];

    const stream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          try {
            const product = {
              name: row.product_name || row['Product Name'],
              category: row.category || row['Category'],
              stock: parseInt(row.stock_quantity || row['Stock Quantity']) || 0,
              reorderLevel: parseInt(row.reorder_level || row['Reorder Level']) || 0,
              unitPrice: parseFloat(row.unit_price || row['Unit Price']) || 0
            };
            
            if (!product.name) {
              errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
              return;
            }
            
            products.push(product);
          } catch (error) {
            errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (products.length === 0) {
      return res.status(400).json({ message: 'No valid products found in CSV', errors });
    }

    await client.query('BEGIN');
    
    const createdProducts = [];
    
    for (const productData of products) {
      try {
        logger.info('Processing product from CSV', { productData });
        
        // Auto-generate SKU
        const sku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        logger.info('Generated SKU for CSV product', { sku, productName: productData.name });
        
        // Create product
        logger.info('Creating product from CSV', { merchantId, name: productData.name, sku, category: productData.category });
        const productResult = await client.query(
          'INSERT INTO oms.products (merchant_id, product_name, sku, category) VALUES ($1, $2, $3, $4) RETURNING product_id',
          [merchantId, productData.name, sku, productData.category]
        );
        
        const productId = productResult.rows[0].product_id;
        logger.info('Product created from CSV', { productId });
        
        // Create inventory record
        logger.info('Creating inventory from CSV', { merchantId, productId, sku, stock: productData.stock, reorderLevel: productData.reorderLevel, unitPrice: productData.unitPrice });
        await client.query(
          'INSERT INTO oms.inventory (merchant_id, product_id, sku, quantity_available, reorder_level, cost_price) VALUES ($1, $2, $3, $4, $5, $6)',
          [merchantId, productId, sku, productData.stock, productData.reorderLevel, productData.unitPrice]
        );
        
        logger.info('Inventory created from CSV', { productId });
        createdProducts.push({ productId, ...productData });
      } catch (error) {
        console.error('Error creating product from CSV:', error);
        logger.error('Error creating product from CSV', error instanceof Error ? error.message : String(error));
        errors.push(`Error creating product ${productData.name}: ${error}`);
      }
    }
    
    await client.query('COMMIT');
    
    logger.info('CSV processing completed', { 
      totalParsed: products.length,
      created: createdProducts.length,
      errors: errors.length
    });
    
    // Trigger inventory reload by logging completion
    logger.info('CSV upload completed - inventory should be refreshed');
    
    res.json({
      message: `Successfully processed ${createdProducts.length} products`,
      created: createdProducts.length,
      errors: errors.length,
      errorDetails: errors
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing inventory CSV upload:', error);
    logger.error('Error processing inventory CSV upload - DETAILED', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to process CSV upload', error: error instanceof Error ? error.message : String(error) });
  } finally {
    client.release();
  }
});

// Update product cost price
router.patch('/:id/price', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { unitPrice } = req.body;
    
    if (unitPrice === undefined || unitPrice < 0) {
      return res.status(400).json({ message: 'Valid unit price is required' });
    }
    
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    const result = await client.query(
      'UPDATE oms.inventory SET cost_price = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 AND merchant_id = $3 RETURNING *',
      [unitPrice, id, merchantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ message: 'Cost price updated successfully' });
  } catch (error) {
    logger.error('Error updating product cost price', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update cost price' });
  } finally {
    client.release();
  }
});

// Add single product with inventory
router.post('/add-product', async (req: Request, res: Response) => {
  logger.info('POST /api/inventory/add-product - Request received', { 
    body: req.body, 
    userId: (req as any).session?.userId,
    sessionExists: !!(req as any).session
  });
  
  const client = await pool.connect();
  try {
    const { name, category, stock, reorderLevel, unitPrice } = req.body;
    
    logger.info('Extracted request data', { name, category, stock, reorderLevel, unitPrice });
    
    if (!name) {
      logger.error('Missing required field: name');
      return res.status(400).json({ message: 'Product name is required' });
    }
    
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    logger.info('User lookup result', { userFound: userResult.rows.length > 0, userId: (req as any).session.userId });
    
    if (userResult.rows.length === 0) {
      logger.error('User not found in database', { userId: (req as any).session.userId });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    logger.info('Found merchant', { merchantId });
    
    await client.query('BEGIN');
    logger.info('Transaction started');
    
    // Auto-generate SKU
    const sku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    logger.info('Generated SKU', { sku });
    
    // Create product
    logger.info('Creating product', { merchantId, name, sku, category });
    const productResult = await client.query(
      'INSERT INTO oms.products (merchant_id, product_name, sku, category) VALUES ($1, $2, $3, $4) RETURNING product_id',
      [merchantId, name, sku, category]
    );
    
    const productId = productResult.rows[0].product_id;
    logger.info('Product created', { productId });
    
    // Create inventory record
    logger.info('Creating inventory record', { merchantId, productId, sku, stock, reorderLevel, unitPrice });
    await client.query(
      'INSERT INTO oms.inventory (merchant_id, product_id, sku, quantity_available, reorder_level, cost_price) VALUES ($1, $2, $3, $4, $5, $6)',
      [merchantId, productId, sku, stock, reorderLevel, unitPrice || 0]
    );
    
    await client.query('COMMIT');
    logger.info('Transaction committed successfully');
    logger.info('Manual product addition completed - inventory should be refreshed');
    
    res.json({ message: 'Product added successfully', productId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding product:', error);
    logger.error('Error adding product - DETAILED', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to add product', error: error instanceof Error ? error.message : String(error) });
  } finally {
    client.release();
  }
});

export default router;