import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = express.Router();

const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive')
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required')
});

// Get all purchase orders
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '10',
      status,
      supplierId,
      sortBy = 'orderDate',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          user: true,
          items: {
            include: { product: true }
          }
        },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// Get purchase order by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        user: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Create purchase order
router.post('/', async (req, res) => {
  try {
    const { supplierId, expectedDate, notes, items } = purchaseOrderSchema.parse(req.body);
    const userId = (req as any).user.id;

    // Generate order number
    const orderCount = await prisma.purchaseOrder.count();
    const orderNumber = `PO-${String(orderCount + 1).padStart(6, '0')}`;

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId,
        userId,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes,
        totalAmount,
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
        supplier: true,
        user: true,
        items: {
          include: { product: true }
        }
      }
    });

    res.status(201).json({ order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// Update purchase order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { 
        status,
        ...(status === 'RECEIVED' && { receivedDate: new Date() })
      },
      include: {
        supplier: true,
        user: true,
        items: {
          include: { product: true }
        }
      }
    });

    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update purchase order status' });
  }
});

// Receive purchase order items
router.post('/:id/receive', async (req, res) => {
  try {
    const { id } = req.params;
    const { receivedItems } = req.body; // Array of { itemId, receivedQuantity }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status !== 'ORDERED') {
      return res.status(400).json({ error: 'Order must be in ORDERED status to receive items' });
    }

    // Update received quantities and stock levels
    for (const receivedItem of receivedItems) {
      const orderItem = order.items.find(item => item.id === receivedItem.itemId);
      if (!orderItem) continue;

      const receivedQuantity = Math.min(receivedItem.receivedQuantity, orderItem.quantity - orderItem.receivedQuantity);

      // Update order item
      await prisma.purchaseOrderItem.update({
        where: { id: receivedItem.itemId },
        data: {
          receivedQuantity: orderItem.receivedQuantity + receivedQuantity
        }
      });

      // Update product stock
      await prisma.product.update({
        where: { id: orderItem.productId },
        data: {
          currentStock: {
            increment: receivedQuantity
          }
        }
      });

      // Create inventory log
      await prisma.inventoryLog.create({
        data: {
          productId: orderItem.productId,
          userId: (req as any).user.id,
          type: 'PURCHASE',
          quantity: receivedQuantity,
          previousStock: (await prisma.product.findUnique({ where: { id: orderItem.productId } }))?.currentStock || 0,
          newStock: ((await prisma.product.findUnique({ where: { id: orderItem.productId } }))?.currentStock || 0) + receivedQuantity,
          reference: order.orderNumber
        }
      });
    }

    // Check if all items are fully received
    const updatedOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    const allReceived = updatedOrder?.items.every(item => item.receivedQuantity >= item.quantity);
    if (allReceived) {
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED', receivedDate: new Date() }
      });
    }

    res.json({ message: 'Items received successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to receive items' });
  }
});

export default router;
