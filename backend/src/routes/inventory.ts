import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { requireRole } from '../middleware/auth';

const router = express.Router();

const inventoryAdjustmentSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.number().int(),
  reason: z.enum(['PURCHASE', 'DISPENSATION', 'ADJUSTMENT', 'TRANSFER', 'EXPIRED', 'DAMAGED', 'RETURN']),
  patientName: z.string().optional(),
  prescriptionNumber: z.string().optional(),
  notes: z.string().optional()
});

const itemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  form: z.enum(['TABLET', 'GEL_CAPSULE', 'CAPSULE', 'GEL', 'EYE_DROPS', 'POWDER']).optional(),
  expiryDate: z.string().optional(),
  initialStock: z.number().int().min(0).optional()
});

const updateItemSchema = itemSchema.partial();

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
    const { itemId, quantity, reason, patientName, prescriptionNumber, notes } = inventoryAdjustmentSchema.parse(req.body);
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
          patientName,
          prescriptionNumber,
          notes: notes || `Stock adjustment: ${quantity > 0 ? '+' : ''}${quantity}`
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

// Get current stock
router.get('/stock', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '50',
      search,
      sortBy = 'item.name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      item: {
        isActive: true
      }
    };

    if (search) {
      where.item.name = {
        contains: search as string
      };
    }

    const orderBy: any = {};
    if (sortBy === 'item.name') {
      orderBy.item = { name: sortOrder };
    } else if (sortBy === 'currentStock') {
      orderBy.currentStock = sortOrder;
    } else if (sortBy === 'item.form') {
      orderBy.item = { form: sortOrder };
    } else {
      orderBy[sortBy as string] = sortOrder;
    }

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: {
          item: true
        },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.inventory.count({ where })
    ]);

    res.json({
      inventory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching current stock:', error);
    res.status(500).json({ error: 'Failed to fetch current stock' });
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

// ==================== ADMIN ROUTES ====================

// Create new item (Admin only)
router.post('/items', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, description, form, expiryDate, initialStock } = itemSchema.parse(req.body);
    const userId = (req as any).user.id;

    // Check if item with same name already exists
    const existingItem = await prisma.item.findFirst({
      where: { 
        name: { equals: name },
        isActive: true
      }
    });

    if (existingItem) {
      return res.status(400).json({ error: 'Item with this name already exists' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the item
      const item = await tx.item.create({
        data: {
          name,
          description,
          form: form || 'TABLET',
          expiryDate
        }
      });

      // Create initial inventory if stock provided
      if (initialStock && initialStock > 0) {
        await tx.inventory.create({
          data: {
            itemId: item.id,
            currentStock: initialStock
          }
        });

        // Create inventory log for initial stock
        await tx.inventoryLog.create({
          data: {
            itemId: item.id,
            userId,
            reason: 'PURCHASE',
            totalAmount: initialStock,
            notes: `Initial stock: ${initialStock}`
          }
        });
      }

      return item;
    });

    res.status(201).json({ item: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update item (Admin only)
router.put('/items/:id', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateItemSchema.parse(req.body);

    // Check if item exists
    const existingItem = await prisma.item.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check for name conflicts if name is being updated
    if (data.name && data.name !== existingItem.name) {
      const nameConflict = await prisma.item.findFirst({
        where: { 
          name: { equals: data.name },
          isActive: true,
          id: { not: id }
        }
      });

      if (nameConflict) {
        return res.status(400).json({ error: 'Item with this name already exists' });
      }
    }

    const item = await prisma.item.update({
      where: { id },
      data,
      include: {
        Inventory: true
      }
    });

    res.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Update item stock directly (Admin only)
router.put('/items/:id/stock', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { currentStock } = z.object({
      currentStock: z.number().int().min(0)
    }).parse(req.body);
    const userId = (req as any).user.id;

    // Check if item exists
    const item = await prisma.item.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get current inventory
      const inventory = await tx.inventory.findFirst({
        where: { itemId: id }
      });

      const previousStock = inventory?.currentStock || 0;
      const stockDifference = currentStock - previousStock;

      // Update or create inventory
      if (inventory) {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { currentStock }
        });
      } else {
        await tx.inventory.create({
          data: {
            itemId: id,
            currentStock
          }
        });
      }

      // Create inventory log if there's a change
      if (stockDifference !== 0) {
        await tx.inventoryLog.create({
          data: {
            itemId: id,
            userId,
            reason: 'ADJUSTMENT',
            totalAmount: stockDifference,
            notes: `Admin stock adjustment: ${stockDifference > 0 ? '+' : ''}${stockDifference} (${previousStock} → ${currentStock})`
          }
        });
      }

      return { currentStock };
    });

    res.json({ stock: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

export default router;
