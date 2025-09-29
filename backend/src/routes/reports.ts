import express from 'express';
import { prisma } from '../index';

const router = express.Router();

// Sales report
router.get('/sales', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      groupBy = 'day' // day, week, month
    } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date();
    start.setDate(start.getDate() - 30); // Default to last 30 days

    const end = endDate ? new Date(endDate as string) : new Date();

    const sales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: {
          include: { product: true }
        },
        user: true
      },
      orderBy: { saleDate: 'asc' }
    });

    // Group sales by period
    const groupedSales: any = {};
    
    sales.forEach(sale => {
      let key: string;
      const date = new Date(sale.saleDate);
      
      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!groupedSales[key]) {
        groupedSales[key] = {
          period: key,
          totalSales: 0,
          totalAmount: 0,
          totalDiscount: 0,
          totalTax: 0,
          finalAmount: 0,
          sales: []
        };
      }

      groupedSales[key].totalSales += 1;
      groupedSales[key].totalAmount += sale.totalAmount;
      groupedSales[key].totalDiscount += sale.discount;
      groupedSales[key].totalTax += sale.tax;
      groupedSales[key].finalAmount += sale.finalAmount;
      groupedSales[key].sales.push(sale);
    });

    const report = Object.values(groupedSales);

    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
});

// Inventory report
router.get('/inventory', async (req, res) => {
  try {
    const {
      categoryId,
      supplierId,
      lowStock = 'false',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const where: any = { isActive: true };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (lowStock === 'true') {
      where.currentStock = {
        lte: prisma.product.fields.minStockLevel
      };
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        supplier: true
      },
      orderBy
    });

    // Calculate total value
    const totalValue = products.reduce((sum, product) => {
      return sum + (product.currentStock * product.costPrice);
    }, 0);

    // Calculate summary statistics
    const summary = {
      totalProducts: products.length,
      totalValue,
      lowStockCount: products.filter(p => p.currentStock <= p.minStockLevel).length,
      outOfStockCount: products.filter(p => p.currentStock === 0).length,
      averageStockValue: products.length > 0 ? totalValue / products.length : 0
    };

    res.json({ products, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
});

// Purchase orders report
router.get('/purchase-orders', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      supplierId,
      sortBy = 'orderDate',
      sortOrder = 'desc'
    } = req.query;

    const where: any = {};

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate as string);
      if (endDate) where.orderDate.lte = new Date(endDate as string);
    }

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        user: true,
        items: {
          include: { product: true }
        }
      },
      orderBy
    });

    // Calculate summary
    const summary = {
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      pendingOrders: orders.filter(o => o.status === 'PENDING').length,
      receivedOrders: orders.filter(o => o.status === 'RECEIVED').length
    };

    res.json({ orders, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate purchase orders report' });
  }
});

// Top selling products
router.get('/top-products', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      limit = '10'
    } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date();
    start.setDate(start.getDate() - 30);

    const end = endDate ? new Date(endDate as string) : new Date();
    const limitNum = parseInt(limit as string);

    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          saleDate: {
            gte: start,
            lte: end
          }
        }
      },
      _sum: {
        quantity: true,
        totalPrice: true
      },
      _count: {
        productId: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: limitNum
    });

    // Get product details
    const productIds = topProducts.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true, supplier: true }
    });

    const result = topProducts.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        product,
        totalQuantity: item._sum.quantity || 0,
        totalRevenue: item._sum.totalPrice || 0,
        salesCount: item._count.productId
      };
    });

    res.json({ topProducts: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate top products report' });
  }
});

// Dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      todaySales,
      totalProducts,
      lowStockProducts,
      pendingOrders,
      recentSales,
      recentInventoryLogs
    ] = await Promise.all([
      // Today's sales
      prisma.sale.aggregate({
        where: {
          saleDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        _sum: {
          totalAmount: true,
          finalAmount: true
        },
        _count: true
      }),
      // Total products
      prisma.product.count({
        where: { isActive: true }
      }),
      // Low stock products
      prisma.product.count({
        where: {
          isActive: true,
          currentStock: {
            lte: prisma.product.fields.minStockLevel
          }
        }
      }),
      // Pending orders
      prisma.purchaseOrder.count({
        where: { status: 'PENDING' }
      }),
      // Recent sales
      prisma.sale.findMany({
        take: 5,
        orderBy: { saleDate: 'desc' },
        include: {
          user: true,
          items: {
            include: { product: true }
          }
        }
      }),
      // Recent inventory logs
      prisma.inventoryLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          user: true
        }
      })
    ]);

    const dashboard = {
      todaySales: {
        count: todaySales._count,
        totalAmount: todaySales._sum.totalAmount || 0,
        finalAmount: todaySales._sum.finalAmount || 0
      },
      inventory: {
        totalProducts,
        lowStockProducts,
        pendingOrders
      },
      recentSales,
      recentInventoryLogs
    };

    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate dashboard data' });
  }
});

export default router;
