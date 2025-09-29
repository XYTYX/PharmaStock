#!/bin/bash

# Production Build Script for Raspberry Pi Deployment
# This script builds both frontend and backend for production

set -e

echo "🚀 Starting production build for Raspberry Pi..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run setup

# Build backend
echo "🔨 Building backend..."
cd backend
npm run build
cd ..

# Build frontend
echo "🔨 Building frontend..."
cd frontend
npm run build
cd ..

echo "✅ Production build completed successfully!"
echo "📁 Built files are ready in:"
echo "   - Backend: ./backend/dist/"
echo "   - Frontend: ./frontend/dist/"
echo ""
echo "Next steps:"
echo "1. Copy the entire project to your Raspberry Pi"
echo "2. Run ./deploy-to-pi.sh on the Raspberry Pi"
