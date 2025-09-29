import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true
    }
  });

  console.log('✅ Admin user created:', adminUser.username);

  // Create a technician user
  const techUser = await prisma.user.upsert({
    where: { username: 'tech1' },
    update: {},
    create: {
      username: 'tech1',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Technician',
      role: 'TECHNICIAN',
      isActive: true
    }
  });

  console.log('✅ Technician user created:', techUser.username);

  // Create some sample items
  const items = await Promise.all([
    prisma.item.create({
      data: {
        name: 'Paracetamol 500mg',
        description: 'Pain relief and fever reducer',
        form: 'TABLET',
        isActive: true,
        expiryDate: '12-2025'
      }
    }),
    prisma.item.create({
      data: {
        name: 'Ibuprofen 400mg',
        description: 'Anti-inflammatory pain relief',
        form: 'TABLET',
        isActive: true,
        expiryDate: '06-2025'
      }
    }),
    prisma.item.create({
      data: {
        name: 'Amoxicillin 250mg',
        description: 'Antibiotic for bacterial infections',
        form: 'CAPSULE',
        isActive: true,
        expiryDate: '09-2025'
      }
    })
  ]);

  console.log('✅ Sample items created:', items.length);

  // Create initial inventory for each item
  for (const item of items) {
    await prisma.inventory.create({
      data: {
        itemId: item.id,
        currentStock: 100
      }
    });
  }

  console.log('✅ Initial inventory created');

  // Create some sample patients
  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        patientName: 'John Doe',
        patientId: 'P001'
      }
    }),
    prisma.patient.create({
      data: {
        patientName: 'Jane Smith',
        patientId: 'P002'
      }
    })
  ]);

  console.log('✅ Sample patients created:', patients.length);

  // Create some sample inventory logs
  const logs = await Promise.all([
    prisma.inventoryLog.create({
      data: {
        userId: adminUser.id,
        itemId: items[0].id,
        patientId: patients[0].id,
        patientName: patients[0].patientName,
        totalAmount: 30,
        reason: 'PURCHASE',
        notes: 'Initial stock purchase'
      }
    }),
    prisma.inventoryLog.create({
      data: {
        userId: techUser.id,
        itemId: items[1].id,
        patientId: patients[1].id,
        patientName: patients[1].patientName,
        totalAmount: 20,
        reason: 'DISPENSATION',
        notes: 'Prescription dispensed'
      }
    })
  ]);

  console.log('✅ Sample inventory logs created:', logs.length);

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });