import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CSVRow {
  name: string;
  form: string;
  count: number;
  expiryDate: string;
}

function parseCSV(csvPath: string): CSVRow[] {
  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    const rows: CSVRow[] = [];
    
    // Skip header row (index 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',');
      if (columns.length >= 4) {
        const name = columns[0]?.trim();
        const form = columns[1]?.trim();
        const count = parseInt(columns[2]?.trim()) || 0;
        const expiryDate = columns[3]?.trim();
        
        if (name && form && count > 0 && expiryDate) {
          rows.push({
            name,
            form: form.toUpperCase(),
            count,
            expiryDate: formatExpiryDate(expiryDate)
          });
        }
      }
    }
    
    return rows;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return [];
  }
}

function formatExpiryDate(dateStr: string): string {
  // Convert formats like "Jan-27" to "01-2027"
  const monthMap: { [key: string]: string } = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    const month = monthMap[parts[0]];
    const year = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
    return `${month}-${year}`;
  }
  
  return dateStr;
}

async function seedCSVData() {
  const csvPath = path.join(process.cwd(), '../Inventory_9_27_2026.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  CSV file not found, skipping CSV data seeding');
    return;
  }
  
  console.log('📄 Reading CSV data...');
  const csvData = parseCSV(csvPath);
  
  if (csvData.length === 0) {
    console.log('⚠️  No valid data found in CSV file');
    return;
  }
  
  console.log(`📊 Found ${csvData.length} items in CSV`);
  
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let inventoryUpdated = 0;
  
  for (const row of csvData) {
    try {
      // Check if item already exists
      const existingItem = await prisma.item.findFirst({
        where: {
          name: row.name,
          form: row.form,
          expiryDate: row.expiryDate
        }
      });
      
      if (existingItem) {
        // Update existing item
        await prisma.item.update({
          where: { id: existingItem.id },
          data: {
            isActive: true
          }
        });
        
        // Update inventory
        const existingInventory = await prisma.inventory.findFirst({
          where: { itemId: existingItem.id }
        });
        
        if (existingInventory) {
          await prisma.inventory.update({
            where: { id: existingInventory.id },
            data: {
              currentStock: row.count
            }
          });
        } else {
          await prisma.inventory.create({
            data: {
              itemId: existingItem.id,
              currentStock: row.count
            }
          });
        }
        
        itemsUpdated++;
        inventoryUpdated++;
      } else {
        // Create new item
        const newItem = await prisma.item.create({
          data: {
            name: row.name,
            description: `${row.name} - ${row.form}`,
            form: row.form,
            expiryDate: row.expiryDate,
            isActive: true
          }
        });
        
        // Create inventory record
        await prisma.inventory.create({
          data: {
            itemId: newItem.id,
            currentStock: row.count
          }
        });
        
        itemsCreated++;
        inventoryUpdated++;
      }
    } catch (error) {
      console.error(`❌ Error processing item ${row.name}:`, error);
    }
  }
  
  console.log(`✅ CSV seeding completed:`);
  console.log(`   - Items created: ${itemsCreated}`);
  console.log(`   - Items updated: ${itemsUpdated}`);
  console.log(`   - Inventory records updated: ${inventoryUpdated}`);
}

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

  // Create some sample items with different forms and expiry dates
  const items = await Promise.all([
    // Paracetamol in different forms
    prisma.item.upsert({
      where: {
        unique_item_combination: {
          name: 'Paracetamol 500mg',
          form: 'TABLET',
          expiryDate: '12-2025'
        }
      },
      update: {},
      create: {
        name: 'Paracetamol 500mg',
        description: 'Pain relief and fever reducer',
        form: 'TABLET',
        isActive: true,
        expiryDate: '12-2025'
      }
    }),
    prisma.item.upsert({
      where: {
        unique_item_combination: {
          name: 'Paracetamol 500mg',
          form: 'CAPSULE',
          expiryDate: '08-2025'
        }
      },
      update: {},
      create: {
        name: 'Paracetamol 500mg',
        description: 'Pain relief and fever reducer',
        form: 'CAPSULE',
        isActive: true,
        expiryDate: '08-2025'
      }
    }),
    // Ibuprofen in different forms
    prisma.item.upsert({
      where: {
        unique_item_combination: {
          name: 'Ibuprofen 400mg',
          form: 'TABLET',
          expiryDate: '06-2025'
        }
      },
      update: {},
      create: {
        name: 'Ibuprofen 400mg',
        description: 'Anti-inflammatory pain relief',
        form: 'TABLET',
        isActive: true,
        expiryDate: '06-2025'
      }
    }),
    prisma.item.upsert({
      where: {
        unique_item_combination: {
          name: 'Ibuprofen 400mg',
          form: 'CAPSULE',
          expiryDate: '10-2025'
        }
      },
      update: {},
      create: {
        name: 'Ibuprofen 400mg',
        description: 'Anti-inflammatory pain relief',
        form: 'CAPSULE',
        isActive: true,
        expiryDate: '10-2025'
      }
    }),
    // Amoxicillin
    prisma.item.upsert({
      where: {
        unique_item_combination: {
          name: 'Amoxicillin 250mg',
          form: 'CAPSULE',
          expiryDate: '09-2025'
        }
      },
      update: {},
      create: {
        name: 'Amoxicillin 250mg',
        description: 'Antibiotic for bacterial infections',
        form: 'CAPSULE',
        isActive: true,
        expiryDate: '09-2025'
      }
    }),
    // Additional medications
    prisma.item.upsert({
      where: {
        unique_item_combination: {
          name: 'Aspirin 100mg',
          form: 'TABLET',
          expiryDate: '03-2026'
        }
      },
      update: {},
      create: {
        name: 'Aspirin 100mg',
        description: 'Blood thinner and pain relief',
        form: 'TABLET',
        isActive: true,
        expiryDate: '03-2026'
      }
    }),
    prisma.item.upsert({
      where: {
        unique_item_combination: {
          name: 'Vitamin D3 1000IU',
          form: 'CAPSULE',
          expiryDate: '07-2025'
        }
      },
      update: {},
      create: {
        name: 'Vitamin D3 1000IU',
        description: 'Vitamin supplement',
        form: 'CAPSULE',
        isActive: true,
        expiryDate: '07-2025'
      }
    }),
    prisma.item.upsert({
      where: {
        unique_item_combination: {
          name: 'Eye Drops 0.5%',
          form: 'EYE_DROPS',
          expiryDate: '11-2025'
        }
      },
      update: {},
      create: {
        name: 'Eye Drops 0.5%',
        description: 'Lubricating eye drops',
        form: 'EYE_DROPS',
        isActive: true,
        expiryDate: '11-2025'
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

  // Seed CSV data
  await seedCSVData();

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