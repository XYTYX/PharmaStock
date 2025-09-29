import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = express.Router();

const inventoryAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().int(),
  reason: z.string().min(1, 'Reason is required'),
  type: z.enum(['ADJUSTMENT', 'TRANSFER', 'EXPIRED', 'DAMAGED', 'RETURN'])
});

// Get inventory logs
router.get('/logs', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '10',
      productId,
      type,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    const [logs, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        include: {
          product: true,
          user: true
        },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.inventoryLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory logs' });
  }
});

// Create inventory adjustment
router.post('/adjust', async (req, res) => {
  try {
    const { productId, quantity, reason, type } = inventoryAdjustmentSchema.parse(req.body);
    const userId = (req as any).user.id;

    // Get current product
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const previousStock = product.currentStock;
    const newStock = previousStock + quantity;

    // Validate stock level
    if (newStock < 0) {
      return res.status(400).json({ 
        error: 'Insufficient stock for this adjustment',
        currentStock: previousStock,
        requestedAdjustment: quantity
      });
    }

    // Update product stock and create log in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update product stock
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock }
      });

      // Create inventory log
      const log = await tx.inventoryLog.create({
        data: {
          productId,
          userId,
          type,
          quantity,
          previousStock,
          newStock,
          reason
        },
        include: {
          product: true,
          user: true
        }
      });

      return log;
    });

    res.status(201).json({ log: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create inventory adjustment' });
  }
});

// Get stock alerts
router.get('/alerts', async (req, res) => {
  try {
    const [lowStock, expired, expiringSoon] = await Promise.all([
      // Low stock products
      prisma.product.findMany({
        where: {
          isActive: true,
          currentStock: {
            lte: prisma.product.fields.minStockLevel
          }
        },
        include: {
          category: true,
          supplier: true
        },
        orderBy: { currentStock: 'asc' }
      }),
      // Expired products (if you add expiration date field)
      prisma.product.findMany({
        where: {
          isActive: true,
          // Add expiration date logic here when field is added
        },
        include: {
          category: true,
          supplier: true
        }
      }),
      // Expiring soon products (if you add expiration date field)
      prisma.product.findMany({
        where: {
          isActive: true,
          // Add expiration date logic here when field is added
        },
        include: {
          category: true,
          supplier: true
        }
      })
    ]);

    res.json({
      lowStock,
      expired,
      expiringSoon
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock alerts' });
  }
});

// Get inventory summary
router.get('/summary', async (req, res) => {
  try {
    const [
      totalProducts,
      totalValue,
      lowStockCount,
      outOfStockCount,
      recentMovements
    ] = await Promise.all([
      prisma.product.count({
        where: { isActive: true }
      }),
      prisma.product.aggregate({
        where: { isActive: true },
        _sum: {
          currentStock: true
        }
      }),
      prisma.product.count({
        where: {
          isActive: true,
          currentStock: {
            lte: prisma.product.fields.minStockLevel
          }
        }
      }),
      prisma.product.count({
        where: {
          isActive: true,
          currentStock: 0
        }
      }),
      prisma.inventoryLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          user: true
        }
      })
    ]);

    res.json({
      totalProducts,
      totalValue: totalValue._sum.currentStock || 0,
      lowStockCount,
      outOfStockCount,
      recentMovements
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory summary' });
  }
});

export default router;
