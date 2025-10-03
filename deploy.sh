#!/bin/bash

# PharmaStock Deployment Script for new-sight.local
# This script sets up nginx and deploys your application

set -e

echo "🚀 Starting PharmaStock deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    print_error "Nginx is not installed. Please install nginx first:"
    echo "sudo apt update && sudo apt install nginx"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Please install PM2 first:"
    echo "npm install -g pm2"
    exit 1
fi

print_status "Setting up nginx configuration..."

# Create nginx site configuration
sudo cp nginx.conf /etc/nginx/sites-available/pharmastock

# Enable the site
sudo ln -sf /etc/nginx/sites-available/pharmastock /etc/nginx/sites-enabled/

# Remove default nginx site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
    print_warning "Removed default nginx site"
fi

# Test nginx configuration
print_status "Testing nginx configuration..."
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Reload nginx
print_status "Reloading nginx..."
sudo systemctl reload nginx

print_status "Building frontend for production..."
cd frontend
npm run build
cd ..

print_status "Starting applications with PM2..."
pm2 start ecosystem.config.js --env production

print_status "Saving PM2 configuration..."
pm2 save

print_status "Setting up PM2 startup script..."
pm2 startup

print_status "Deployment completed successfully!"
echo ""
echo "🌐 Your application is now available at: http://new-sight.local"
echo "📊 Frontend: http://new-sight.local"
echo "🔧 API: http://new-sight.local/api"
echo "❤️  Health check: http://new-sight.local/health"
echo ""
echo "📋 Useful commands:"
echo "  pm2 status                    - Check application status"
echo "  pm2 logs                      - View logs"
echo "  pm2 restart all              - Restart all applications"
echo "  sudo systemctl status nginx  - Check nginx status"
echo "  sudo nginx -t                 - Test nginx configuration"
echo ""
print_warning "Make sure to add 'new-sight.local' to your /etc/hosts file:"
echo "  echo '127.0.0.1 new-sight.local' | sudo tee -a /etc/hosts"
