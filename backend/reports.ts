import { Router, Request, Response } from 'express';
import { pool } from './db.ts';
import { logger } from './utils/logger.ts';

const router = Router();

// Get reports data
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { type = 'daily', startDate, endDate } = req.query;
    
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    let query = '';
    let params: any[] = [merchantId];
    
    if (type === 'daily') {
      query = `
        SELECT 
          DATE(o.created_at) as date,
          COUNT(o.order_id) as sales,
          COALESCE(SUM(o.total_amount), 0) as revenue
        FROM oms.orders o
        WHERE o.merchant_id = $1
        AND o.status IN ('confirmed', 'shipped', 'delivered')
      `;
      
      if (startDate && endDate) {
        query += ` AND DATE(o.created_at) BETWEEN $2 AND $3`;
        params.push(startDate, endDate);
      } else {
        query += ` AND DATE(o.created_at) >= CURRENT_DATE - INTERVAL '30 days'`;
      }
      
      query += ` GROUP BY DATE(o.created_at) ORDER BY DATE(o.created_at) DESC`;
    } else if (type === 'monthly') {
      query = `
        SELECT 
          TO_CHAR(o.created_at, 'YYYY-MM') as date,
          COUNT(o.order_id) as sales,
          COALESCE(SUM(o.total_amount), 0) as revenue
        FROM oms.orders o
        WHERE o.merchant_id = $1
        AND o.status IN ('confirmed', 'shipped', 'delivered')
      `;
      
      if (startDate && endDate) {
        query += ` AND TO_CHAR(o.created_at, 'YYYY-MM') BETWEEN $2 AND $3`;
        params.push(startDate, endDate);
      } else {
        query += ` AND o.created_at >= CURRENT_DATE - INTERVAL '12 months'`;
      }
      
      query += ` GROUP BY TO_CHAR(o.created_at, 'YYYY-MM') ORDER BY TO_CHAR(o.created_at, 'YYYY-MM') DESC`;
    } else if (type === 'yearly') {
      query = `
        SELECT 
          EXTRACT(YEAR FROM o.created_at)::text as date,
          COUNT(o.order_id) as sales,
          COALESCE(SUM(o.total_amount), 0) as revenue
        FROM oms.orders o
        WHERE o.merchant_id = $1
        AND o.status IN ('confirmed', 'shipped', 'delivered')
        GROUP BY EXTRACT(YEAR FROM o.created_at)
        ORDER BY EXTRACT(YEAR FROM o.created_at) DESC
      `;
    }
    
    const result = await client.query(query, params);
    
    const formattedData = result.rows.map(row => ({
      date: row.date,
      sales: parseInt(row.sales) || 0,
      revenue: parseFloat(row.revenue) || 0
    }));
    
    res.json({ data: formattedData });
  } catch (error) {
    logger.error('Error fetching reports data', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch reports data' });
  } finally {
    client.release();
  }
});

// Get dashboard metrics
router.get('/dashboard', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const todayOrdersResult = await client.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
      FROM oms.orders 
      WHERE DATE(created_at) = $1 AND merchant_id = $2
    `, [today, (req as any).session.merchantId || 1]);

    const pendingOrdersResult = await client.query(`
      SELECT COUNT(*) as count
      FROM oms.orders 
      WHERE status = 'pending' AND merchant_id = $1
    `, [(req as any).session.merchantId || 1]);

    const lowStockResult = await client.query(`
      SELECT COUNT(*) as count
      FROM oms.inventory i
      JOIN oms.products p ON i.product_id = p.product_id
      WHERE i.quantity_available <= i.reorder_level AND p.merchant_id = $1
    `, [(req as any).session.merchantId || 1]);

    const monthlyRevenueResult = await client.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
      FROM oms.orders 
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `);

    const channelPerformanceResult = await client.query(`
      SELECT 
        channel,
        COUNT(*) as orders,
        SUM(total_amount) as revenue
      FROM oms.orders 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY channel
    `);

    const metrics = {
      todayOrders: parseInt(todayOrdersResult.rows[0].count),
      todayRevenue: parseFloat(todayOrdersResult.rows[0].revenue),
      pendingOrders: parseInt(pendingOrdersResult.rows[0].count),
      lowStockProducts: parseInt(lowStockResult.rows[0].count),
      monthlyRevenue: monthlyRevenueResult.rows,
      channelPerformance: channelPerformanceResult.rows
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching dashboard metrics', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
  } finally {
    client.release();
  }
});

// Get sales report
router.get('/sales', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { startDate, endDate, channel, groupBy = 'day' } = req.query;
    
    let dateFormat = 'YYYY-MM-DD';
    let dateTrunc = 'day';
    
    if (groupBy === 'month') {
      dateFormat = 'YYYY-MM';
      dateTrunc = 'month';
    } else if (groupBy === 'week') {
      dateFormat = 'YYYY-"W"WW';
      dateTrunc = 'week';
    }

    let query = `
      SELECT 
        DATE_TRUNC('${dateTrunc}', created_at) as period,
        TO_CHAR(DATE_TRUNC('${dateTrunc}', created_at), '${dateFormat}') as period_label,
        COUNT(*) as orders,
        SUM(total_amount) as revenue,
        AVG(total_amount) as avg_order_value
      FROM oms.orders 
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (channel && channel !== 'all') {
      query += ` AND channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    query += ` GROUP BY DATE_TRUNC('${dateTrunc}', created_at) ORDER BY period`;

    const result = await client.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching sales report', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch sales report' });
  } finally {
    client.release();
  }
});

// Export sales data as CSV
router.get('/export/sales', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { startDate, endDate, channel } = req.query;
    
    let query = `
      SELECT 
        order_number,
        customer_name,
        customer_email,
        channel,
        status,
        total_amount,
        created_at
      FROM oms.orders 
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (channel && channel !== 'all') {
      query += ` AND channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await client.query(query, params);
    
    // Convert to CSV
    const headers = ['Order Number', 'Customer Name', 'Email', 'Channel', 'Status', 'Amount', 'Date'];
    const csvData = [
      headers.join(','),
      ...result.rows.map((row: any) => [
        row.order_number,
        row.customer_name,
        row.customer_email,
        row.channel,
        row.status,
        row.total_amount,
        new Date(row.created_at).toISOString().split('T')[0]
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
    res.send(csvData);
  } catch (error) {
    logger.error('Error exporting sales data', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to export sales data' });
  } finally {
    client.release();
  }
});

export default router;