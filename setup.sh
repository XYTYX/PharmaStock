#!/bin/bash

echo "🚀 Setting up PharmaStock..."

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🗄️ Setting up database..."
npx prisma db push

# Seed database
echo "🌱 Seeding database..."
npm run db:seed

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo "✅ Setup complete!"
echo ""
echo "To start the development servers:"
echo "  npm run dev"
echo ""
echo "Default login credentials:"
echo "  Admin: admin@pharmastock.com / admin123"
echo "  Pharmacist: pharmacist@pharmastock.com / pharmacist123"
echo "  Technician: tech@pharmastock.com / tech123"
