import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

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
        const name = columns[0]?.trim().replace(/^"(.*)"$/, '$1');
        console.log(name);
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
  const csvPath = path.join(process.cwd(), './prisma/csv_backups/Inventory_10_3_2025.csv');
  
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
  
  // Get Joyce admin user for logging
  const joyceUser = await prisma.user.findUnique({
    where: { username: 'joyce' }
  });
  
  if (!joyceUser) {
    console.log('❌ Joyce admin user not found, skipping inventory logs');
    return;
  }
  
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
          const previousStock = existingInventory.currentStock;
          const stockDifference = row.count - previousStock;
          
          await prisma.inventory.update({
            where: { id: existingInventory.id },
            data: {
              currentStock: row.count
            }
          });
          
          // Create inventory log for stock adjustment
          if (stockDifference !== 0) {
            await prisma.inventoryLog.create({
              data: {
                itemId: existingItem.id,
                userId: joyceUser.id,
                reason: 'ADJUSTMENT',
                totalAmount: stockDifference,
                notes: `CSV import adjustment: ${stockDifference > 0 ? '+' : ''}${stockDifference} (${previousStock} → ${row.count})`
              }
            });
          }
        } else {
          await prisma.inventory.create({
            data: {
              itemId: existingItem.id,
              currentStock: row.count
            }
          });
          
          // Create inventory log for new inventory record
          await prisma.inventoryLog.create({
            data: {
              itemId: existingItem.id,
              userId: joyceUser.id,
              reason: 'ADJUSTMENT',
              totalAmount: row.count,
              notes: `CSV import: Initial stock of ${row.count}`
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
        
        // Create inventory log for new item
        await prisma.inventoryLog.create({
          data: {
            itemId: newItem.id,
            userId: joyceUser.id,
            reason: 'ADJUSTMENT',
            totalAmount: row.count,
            notes: `CSV import: New item with initial stock of ${row.count}`
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
  console.log('🌱 Seeding admin users...');

  const joyce = await prisma.user.upsert({
    where: { username: 'joyce' },
    update: {},
    create: {
      username: 'joyce',
      password: await bcrypt.hash('joyce123', 10),
      firstName: 'Joyce',
      lastName: 'Samoutou',
      role: 'ADMIN',
      isActive: true
    }
  });

  const henri = await prisma.user.upsert({
    where: { username: 'henri' },
    update: {},
    create: {
      username: 'henri',
      password: await bcrypt.hash('henri123', 10),
      firstName: 'Henri',
      lastName: 'Samoutou',
      role: 'ADMIN',
      isActive: true
    }
  });

  console.log('✅ Admin user created:', joyce.username);
  console.log('✅ Admin user created:', henri.username);

  console.log('🌱 Seeding pharmacist user...');
  const annita = await prisma.user.upsert({
    where: { username: 'annita' },
    update: {},
    create: {
      username: 'annita',
      password: await bcrypt.hash('annita123', 10),
      firstName: 'Annita',
      lastName: '',
      role: 'TECHNICIAN',
      isActive: true
    }
  });

  const franck = await prisma.user.upsert({
    where: { username: 'franck' },
    update: {},
    create: {
      username: 'franck',
      password: await bcrypt.hash('franck123', 10),
      firstName: 'Franck',
      lastName: '',
      role: 'TECHNICIAN',
      isActive: true
    }
  });

  const orchydee = await prisma.user.upsert({
    where: { username: 'orchydee' },
    update: {},
    create: {
      username: 'orchydee',
      password: await bcrypt.hash('orchydee123', 10),
      firstName: 'Orchydee',
      lastName: '',
      role: 'TECHNICIAN',
      isActive: true
    }
  });

  const brunel = await prisma.user.upsert({
    where: { username: 'brunel' },
    update: {},
    create: {
      username: 'brunel',
      password: await bcrypt.hash('brunel123', 10),
      firstName: 'Brunel',
      lastName: '',
      role: 'TECHNICIAN',
      isActive: true
    }
  });

  console.log('✅ Technician user created:', annita.username);
  console.log('✅ Technician user created:', franck.username);
  console.log('✅ Technician user created:', orchydee.username);
  console.log('✅ Technician user created:', brunel.username);

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