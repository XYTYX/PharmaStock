import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = express.Router();

// Validation schemas
const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  supplierId: z.string().min(1, 'Supplier is required'),
  unitPrice: z.number().positive('Unit price must be positive'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  costPrice: z.number().positive('Cost price must be positive'),
  minStockLevel: z.number().int().min(0, 'Min stock level must be non-negative'),
  maxStockLevel: z.number().int().min(0, 'Max stock level must be non-negative'),
  unit: z.string().default('pieces'),
  isPrescription: z.boolean().default(false),
  requiresRefrigerator: z.boolean().default(false)
});

const updateProductSchema = productSchema.partial();

// Get all products with filters
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      categoryId,
      supplierId,
      lowStock = 'false',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    const isLowStock = lowStock === 'true';

    const where: any = {
      isActive: true
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { barcode: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (isLowStock) {
      where.currentStock = { lte: prisma.product.fields.minStockLevel };
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          supplier: true
        },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        inventoryLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: true }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create new product
router.post('/', async (req, res) => {
  try {
    const data = productSchema.parse(req.body);

    // Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku: data.sku }
    });

    if (existingProduct) {
      return res.status(400).json({ error: 'Product with this SKU already exists' });
    }

    // Check if barcode already exists (if provided)
    if (data.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: data.barcode }
      });

      if (existingBarcode) {
        return res.status(400).json({ error: 'Product with this barcode already exists' });
      }
    }

    const product = await prisma.product.create({
      data,
      include: {
        category: true,
        supplier: true
      }
    });

    res.status(201).json({ product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateProductSchema.parse(req.body);

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check for SKU conflicts
    if (data.sku && data.sku !== existingProduct.sku) {
      const skuConflict = await prisma.product.findUnique({
        where: { sku: data.sku }
      });

      if (skuConflict) {
        return res.status(400).json({ error: 'Product with this SKU already exists' });
      }
    }

    // Check for barcode conflicts
    if (data.barcode && data.barcode !== existingProduct.barcode) {
      const barcodeConflict = await prisma.product.findUnique({
        where: { barcode: data.barcode }
      });

      if (barcodeConflict) {
        return res.status(400).json({ error: 'Product with this barcode already exists' });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        supplier: true
      }
    });

    res.json({ product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Get low stock products
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
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
    });

    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

export default router;
