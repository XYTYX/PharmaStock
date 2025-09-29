import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Prescription Medications',
        description: 'Prescription-only medications requiring a doctor\'s prescription'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Over-the-Counter',
        description: 'Medications available without prescription'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Supplies',
        description: 'Medical supplies and equipment'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Vitamins & Supplements',
        description: 'Vitamins, minerals, and dietary supplements'
      }
    })
  ]);

  console.log('✅ Categories created');

  // Create suppliers
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        name: 'MedSupply Co.',
        contactName: 'John Smith',
        email: 'orders@medsupply.com',
        phone: '+1-555-0123',
        address: '123 Medical Drive, Health City, HC 12345'
      }
    }),
    prisma.supplier.create({
      data: {
        name: 'PharmaDirect',
        contactName: 'Sarah Johnson',
        email: 'sales@pharmadirect.com',
        phone: '+1-555-0456',
        address: '456 Pharmacy Lane, Med Town, MT 67890'
      }
    }),
    prisma.supplier.create({
      data: {
        name: 'HealthCare Solutions',
        contactName: 'Mike Wilson',
        email: 'orders@healthcaresolutions.com',
        phone: '+1-555-0789',
        address: '789 Wellness Way, Care City, CC 11111'
      }
    })
  ]);

  console.log('✅ Suppliers created');

  // Create users
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const pharmacistPassword = await bcrypt.hash('pharmacist123', 12);
  const techPassword = await bcrypt.hash('tech123', 12);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN'
      }
    }),
    prisma.user.create({
      data: {
        username: 'pharmacist',
        password: pharmacistPassword,
        firstName: 'Dr. Jane',
        lastName: 'Smith',
        role: 'PHARMACIST'
      }
    }),
    prisma.user.create({
      data: {
        username: 'tech',
        password: techPassword,
        firstName: 'Bob',
        lastName: 'Johnson',
        role: 'TECHNICIAN'
      }
    })
  ]);

  console.log('✅ Users created');

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Acetaminophen 500mg',
        description: 'Pain reliever and fever reducer',
        internalId: 'MED-001',
        sku: 'ACET-500-100',
        barcode: '1234567890123',
        categoryId: categories[1].id, // OTC
        supplierId: suppliers[0].id,
        unitPrice: 0.15,
        costPrice: 0.10,
        currentStock: 250,
        unit: 'tablets',
        medicineType: 'TABLET',
        isPrescription: false,
        requiresRefrigerator: false,
        expiryDate: '12-2025'
      }
    }),
    prisma.product.create({
      data: {
        name: 'Ibuprofen 200mg',
        description: 'Anti-inflammatory pain reliever',
        internalId: 'MED-002',
        sku: 'IBUP-200-100',
        barcode: '1234567890124',
        categoryId: categories[1].id, // OTC
        supplierId: suppliers[0].id,
        unitPrice: 0.20,
        costPrice: 0.15,
        currentStock: 180,
        unit: 'tablets',
        medicineType: 'TABLET',
        isPrescription: false,
        requiresRefrigerator: false,
        expiryDate: '06-2025'
      }
    }),
    prisma.product.create({
      data: {
        name: 'Amoxicillin 250mg',
        description: 'Antibiotic for bacterial infections',
        internalId: 'MED-003',
        sku: 'AMOX-250-30',
        barcode: '1234567890125',
        categoryId: categories[0].id, // Prescription
        supplierId: suppliers[1].id,
        unitPrice: 2.50,
        costPrice: 2.00,
        currentStock: 75,
        unit: 'capsules',
        medicineType: 'CAPSULE',
        isPrescription: true,
        requiresRefrigerator: false,
        expiryDate: '09-2025'
      }
    }),
    prisma.product.create({
      data: {
        name: 'Insulin Pen Needles',
        description: 'Sterile needles for insulin pens',
        internalId: 'MED-004',
        sku: 'NEED-31G-100',
        barcode: '1234567890126',
        categoryId: categories[2].id, // Supplies
        supplierId: suppliers[2].id,
        unitPrice: 0.30,
        costPrice: 0.25,
        currentStock: 150,
        unit: 'pieces',
        medicineType: 'TABLET', // Not a medicine, but using default
        isPrescription: false,
        requiresRefrigerator: false,
        expiryDate: '03-2026'
      }
    }),
    prisma.product.create({
      data: {
        name: 'Vitamin D3 1000 IU',
        description: 'Vitamin D supplement for bone health',
        internalId: 'MED-005',
        sku: 'VITD-1000-60',
        barcode: '1234567890127',
        categoryId: categories[3].id, // Vitamins
        supplierId: suppliers[1].id,
        unitPrice: 0.75,
        costPrice: 0.60,
        currentStock: 5, // Low stock for testing
        unit: 'tablets',
        medicineType: 'TABLET',
        isPrescription: false,
        requiresRefrigerator: false,
        expiryDate: '08-2025'
      }
    }),
    prisma.product.create({
      data: {
        name: 'Blood Pressure Cuff',
        description: 'Digital blood pressure monitoring device',
        internalId: 'MED-006',
        sku: 'BPCUFF-DIG-1',
        barcode: '1234567890128',
        categoryId: categories[2].id, // Supplies
        supplierId: suppliers[2].id,
        unitPrice: 45.00,
        costPrice: 35.00,
        currentStock: 8,
        unit: 'pieces',
        medicineType: 'TABLET', // Not a medicine, but using default
        isPrescription: false,
        requiresRefrigerator: false,
        expiryDate: '12-2027'
      }
    }),
    // Additional sample products with different medicine types
    prisma.product.create({
      data: {
        name: 'Lubricating Eye Drops',
        description: 'Artificial tears for dry eyes',
        internalId: 'MED-007',
        sku: 'EYE-001-10',
        barcode: '1234567890129',
        categoryId: categories[1].id, // OTC
        supplierId: suppliers[0].id,
        unitPrice: 3.50,
        costPrice: 2.80,
        currentStock: 25,
        unit: 'bottles',
        medicineType: 'EYE_DROPS',
        isPrescription: false,
        requiresRefrigerator: false,
        expiryDate: '04-2026'
      }
    }),
    prisma.product.create({
      data: {
        name: 'Antacid Gel',
        description: 'Gel antacid for heartburn relief',
        internalId: 'MED-008',
        sku: 'GEL-001-200',
        barcode: '1234567890130',
        categoryId: categories[1].id, // OTC
        supplierId: suppliers[1].id,
        unitPrice: 2.25,
        costPrice: 1.80,
        currentStock: 40,
        unit: 'tubes',
        medicineType: 'GEL',
        isPrescription: false,
        requiresRefrigerator: false,
        expiryDate: '11-2025'
      }
    }),
    prisma.product.create({
      data: {
        name: 'Probiotic Gel Capsules',
        description: 'Probiotic supplement in gel capsules',
        internalId: 'MED-009',
        sku: 'PROB-001-30',
        barcode: '1234567890131',
        categoryId: categories[3].id, // Vitamins
        supplierId: suppliers[2].id,
        unitPrice: 8.50,
        costPrice: 6.80,
        currentStock: 15,
        unit: 'capsules',
        medicineType: 'GEL_CAPSULE',
        isPrescription: false,
        requiresRefrigerator: true,
        expiryDate: '07-2025'
      }
    })
  ]);

  console.log('✅ Products created');

  // Create sample purchase order
  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-000001',
      supplierId: suppliers[0].id,
      userId: users[0].id,
      status: 'PENDING',
      totalAmount: 150.00,
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      notes: 'Regular monthly order',
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 500,
            unitPrice: 0.10,
            totalPrice: 50.00
          },
          {
            productId: products[1].id,
            quantity: 300,
            unitPrice: 0.15,
            totalPrice: 45.00
          },
          {
            productId: products[3].id,
            quantity: 1000,
            unitPrice: 0.25,
            totalPrice: 250.00
          }
        ]
      }
    }
  });

  console.log('✅ Purchase order created');

  // Create sample dispensations
  const dispensations = await Promise.all([
    prisma.dispensation.create({
      data: {
        dispensationNumber: 'DISP-000001',
        userId: users[1].id, // Pharmacist
        patientName: 'John Doe',
        patientId: 'P001',
        prescriptionNumber: 'RX-001',
        totalAmount: 15.50,
        items: {
          create: [
            {
              productId: products[0].id,
              quantity: 20,
              unitPrice: 0.25,
              totalPrice: 5.00
            },
            {
              productId: products[1].id,
              quantity: 30,
              unitPrice: 0.35,
              totalPrice: 10.50
            }
          ]
        }
      }
    }),
    prisma.dispensation.create({
      data: {
        dispensationNumber: 'DISP-000002',
        userId: users[2].id, // Technician
        patientName: 'Jane Smith',
        patientId: 'P002',
        prescriptionNumber: 'RX-002',
        totalAmount: 75.00,
        items: {
          create: [
            {
              productId: products[5].id,
              quantity: 1,
              unitPrice: 75.00,
              totalPrice: 75.00
            }
          ]
        }
      }
    })
  ]);

  console.log('✅ Dispensations created');

  // Create inventory logs for the dispensations
  for (const dispensation of dispensations) {
    // Get the dispensation items for this dispensation
    const dispensationItems = await prisma.dispensationItem.findMany({
      where: { dispensationId: dispensation.id }
    });
    
    for (const item of dispensationItems) {
      await prisma.inventoryLog.create({
        data: {
          productId: item.productId,
          userId: dispensation.userId,
          type: 'DISPENSATION',
          quantity: -item.quantity,
          previousStock: 0, // This would be calculated properly in real app
          newStock: 0, // This would be calculated properly in real app
          reference: dispensation.dispensationNumber
        }
      });
    }
  }

  console.log('✅ Inventory logs created');

  console.log('🎉 Database seeded successfully!');
  console.log('\nDefault login credentials:');
  console.log('Admin: admin / admin123');
  console.log('Pharmacist: pharmacist / pharmacist123');
  console.log('Technician: tech / tech123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
