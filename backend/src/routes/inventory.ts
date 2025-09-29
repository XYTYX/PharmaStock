import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = express.Router();

const inventoryAdjustmentSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.number().int(),
  reason: z.enum(['PURCHASE', 'DISPENSATION', 'ADJUSTMENT', 'TRANSFER', 'EXPIRED', 'DAMAGED', 'RETURN'])
});

// Get inventory logs
router.get('/logs', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '10',
      itemId,
      reason,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (itemId) {
      where.itemId = itemId;
    }

    if (reason) {
      where.reason = reason;
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
          item: true,
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
    const { itemId, quantity, reason } = inventoryAdjustmentSchema.parse(req.body);
    const userId = (req as any).user.id;

    // Get current item
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get current inventory
    const inventory = await prisma.inventory.findFirst({
      where: { itemId }
    });

    const previousStock = inventory?.currentStock || 0;
    const newStock = previousStock + quantity;

    // Validate stock level
    if (newStock < 0) {
      return res.status(400).json({ 
        error: 'Insufficient stock for this adjustment',
        currentStock: previousStock,
        requestedAdjustment: quantity
      });
    }

    // Update inventory and create log in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update or create inventory
      if (inventory) {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { currentStock: newStock }
        });
      } else {
        await tx.inventory.create({
          data: {
            itemId,
            currentStock: newStock
          }
        });
      }

      // Create inventory log
      const log = await tx.inventoryLog.create({
        data: {
          itemId,
          userId,
          reason,
          totalAmount: quantity,
          notes: `Stock adjustment: ${quantity > 0 ? '+' : ''}${quantity}`
        },
        include: {
          item: true,
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

// Get inventory summary
router.get('/summary', async (req, res) => {
  try {
    const [
      totalItems,
      totalInventory,
      recentMovements
    ] = await Promise.all([
      prisma.item.count({
        where: { isActive: true }
      }),
      prisma.inventory.aggregate({
        _sum: {
          currentStock: true
        }
      }),
      prisma.inventoryLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          item: true,
          user: true
        }
      })
    ]);

    res.json({
      totalItems,
      totalInventory: totalInventory._sum.currentStock || 0,
      recentMovements
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory summary' });
  }
});

export default router;
