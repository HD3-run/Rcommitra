import { Request, Response, NextFunction } from 'express';

// Input sanitization
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/[<>]/g, '').trim();
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  next();
};

// Pagination validation
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  if (page < 1) req.query.page = '1';
  if (limit < 1 || limit > 100) req.query.limit = '20';
  
  next();
};

// Quantity validation
export const validateQuantity = (req: Request, res: Response, next: NextFunction) => {
  if (req.body.quantity !== undefined) {
    const quantity = parseInt(req.body.quantity);
    if (isNaN(quantity) || quantity < 0) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }
    req.body.quantity = quantity;
  }
  next();
};

// URL manipulation protection
export const preventUrlManipulation = (req: Request, res: Response, next: NextFunction) => {
  const url = req.url;
  if (url.includes('%2e') || url.includes('..') || url.includes('%2f')) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};