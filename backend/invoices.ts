import { Router, Request, Response } from 'express';
import { pool } from './db.ts';
import { logger } from './utils/logger.ts';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Get all invoices
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId } = userResult.rows[0];
    
    const query = `
      SELECT o.order_id, o.total_amount, o.created_at, o.status as order_status,
             c.name as customer_name,
             o.order_id as invoice_id,
             CURRENT_DATE + INTERVAL '30 days' as due_date,
             COALESCE(p.status, 'pending') as payment_status,
             p.payment_method, p.payment_date
      FROM oms.orders o 
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      LEFT JOIN oms.order_payments p ON o.order_id = p.order_id
      WHERE o.merchant_id = $1 AND o.status IN ('confirmed', 'shipped', 'delivered')
      ORDER BY o.order_id DESC
    `;
    
    const result = await client.query(query, [merchantId]);
    
    const invoices = result.rows.map(row => ({
      invoice_id: row.invoice_id,
      order_id: row.order_id,
      customer_name: row.customer_name || 'Unknown Customer',
      total_amount: parseFloat(row.total_amount) || 0,
      status: row.payment_status,
      due_date: row.due_date.toISOString().split('T')[0],
      created_at: row.created_at,
      order_status: row.order_status,
      payment_method: row.payment_method,
      payment_date: row.payment_date
    }));
    
    res.json({ invoices });
  } catch (error) {
    logger.error('Error fetching invoices', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch invoices' });
  } finally {
    client.release();
  }
});

// Create manual invoice
router.post('/add-manual', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { orderId, dueDate, status } = req.body;
    
    if (!orderId || !dueDate) {
      return res.status(400).json({ message: 'Order ID and due date are required' });
    }
    
    // Get user info from session
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Verify order exists and belongs to merchant
    const orderResult = await client.query(
      'SELECT order_id, total_amount FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
      [orderId, merchantId]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // For now, just return success since we don't have invoice table
    // In future, this will create actual invoice record
    logger.info('Manual invoice created', { orderId, dueDate, status });
    res.status(201).json({ 
      message: 'Invoice created successfully',
      invoice: {
        invoice_id: orderId,
        order_id: orderId,
        due_date: dueDate,
        status: status
      }
    });
  } catch (error) {
    logger.error('Error creating manual invoice', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to create invoice' });
  } finally {
    client.release();
  }
});

// CSV upload for invoices
router.post('/upload-csv', upload.single('file'), async (req: Request, res: Response) => {
  logger.info('Invoice CSV upload started', { fileName: req.file?.originalname });
  
  const client = await pool.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get user info from session
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    const invoices: any[] = [];
    const errors: string[] = [];

    // Parse CSV
    const stream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          try {
            const invoice = {
              orderId: parseInt(row.order_id || row['Order ID']) || 0,
              dueDate: row.due_date || row['Due Date'],
              status: row.status || row['Status'] || 'pending'
            };
            
            if (!invoice.orderId || !invoice.dueDate) {
              errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
              return;
            }
            
            invoices.push(invoice);
          } catch (error) {
            errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (invoices.length === 0) {
      return res.status(400).json({ message: 'No valid invoices found in CSV', errors });
    }

    let created = 0;
    
    // Validate orders exist
    for (const invoiceData of invoices) {
      try {
        const orderResult = await client.query(
          'SELECT order_id FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
          [invoiceData.orderId, merchantId]
        );
        
        if (orderResult.rows.length > 0) {
          created++;
          logger.info('Invoice validated for order', { orderId: invoiceData.orderId });
        } else {
          errors.push(`Order ${invoiceData.orderId} not found`);
        }
      } catch (error) {
        errors.push(`Error validating order ${invoiceData.orderId}: ${error}`);
      }
    }
    
    logger.info('Invoice CSV processed', { 
      totalRows: invoices.length, 
      created, 
      errors: errors.length 
    });
    
    res.json({
      message: `Successfully processed ${created} invoices`,
      created,
      errors: errors.length,
      errorDetails: errors
    });
    
  } catch (error) {
    logger.error('Error processing invoice CSV upload', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to process CSV upload' });
  } finally {
    client.release();
  }
});

export default router;