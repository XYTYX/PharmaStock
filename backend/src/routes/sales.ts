import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = express.Router();

const saleItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive')
});

const saleSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'INSURANCE', 'OTHER']).default('CASH'),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required')
});

// Get all sales
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '10',
      startDate,
      endDate,
      paymentMethod,
      sortBy = 'saleDate',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate as string);
      if (endDate) where.saleDate.lte = new Date(endDate as string);
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          user: true,
          items: {
            include: { product: true }
          }
        },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.sale.count({ where })
    ]);

    res.json({
      sales,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get sale by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json({ sale });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// Create sale
router.post('/', async (req, res) => {
  try {
    const { customerName, customerPhone, discount, tax, paymentMethod, notes, items } = saleSchema.parse(req.body);
    const userId = (req as any).user.id;

    // Generate sale number
    const saleCount = await prisma.sale.count();
    const saleNumber = `SALE-${String(saleCount + 1).padStart(6, '0')}`;

    // Calculate totals
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const finalAmount = totalAmount - discount + tax;

    // Check stock availability
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.productId}` });
      }

      if (product.currentStock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${item.quantity}` 
        });
      }
    }

    // Create sale and update stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create sale
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          userId,
          customerName,
          customerPhone,
          totalAmount,
          discount,
          tax,
          finalAmount,
          paymentMethod,
          notes,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice
            }))
          }
        },
        include: {
          user: true,
          items: {
            include: { product: true }
          }
        }
      });

      // Update stock and create inventory logs
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (product) {
          const newStock = product.currentStock - item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: newStock }
          });

          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              userId,
              type: 'SALE',
              quantity: -item.quantity,
              previousStock: product.currentStock,
              newStock,
              reference: saleNumber
            }
          });
        }
      }

      return sale;
    });

    res.status(201).json({ sale: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

// Get sales summary
router.get('/summary/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [sales, summary] = await Promise.all([
      prisma.sale.findMany({
        where: {
          saleDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        include: {
          items: {
            include: { product: true }
          }
        }
      }),
      prisma.sale.aggregate({
        where: {
          saleDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        _sum: {
          totalAmount: true,
          discount: true,
          tax: true,
          finalAmount: true
        },
        _count: true
      })
    ]);

    res.json({
      date: targetDate.toISOString().split('T')[0],
      summary: {
        totalSales: summary._count,
        totalAmount: summary._sum.totalAmount || 0,
        totalDiscount: summary._sum.discount || 0,
        totalTax: summary._sum.tax || 0,
        finalAmount: summary._sum.finalAmount || 0
      },
      sales
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales summary' });
  }
});

export default router;
