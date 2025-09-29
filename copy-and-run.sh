#!/bin/bash

# Copy and Run Script for PharmaStock
# This script copies the application from USB drive to home directory and runs it
# Usage: ./copy-and-run.sh [--update]

set -e

echo "🍓 Copying PharmaStock from USB drive to home directory..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Run as regular user."
    exit 1
fi

# Load configuration from github-config.sh if it exists
if [ -f "github-config.sh" ]; then
    source github-config.sh
else
    # Default configuration
    GITHUB_REPO="your-username/pharmastock"  # Update this with your GitHub repo
    GITHUB_BRANCH="main"  # Update this if you use a different branch
    INSTALL_DIR="/home/$USER/pharmastock"
    BACKUP_DIR="/home/$USER/pharmastock-backup"
fi

# Check if thumbdrive is mounted
if [ ! -d "/mnt/thumbdrive" ]; then
    echo "❌ USB drive not mounted. Please run setup first:"
    echo "sudo ./setup-raspberry-pi.sh"
    exit 1
fi

THUMBDRIVE_PATH="/mnt/thumbdrive"
SOURCE_DIR="$THUMBDRIVE_PATH/pharmastock-source"

# Check if source directory exists on USB drive
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Source directory not found on USB drive: $SOURCE_DIR"
    echo "Please ensure the PharmaStock source code is in: $SOURCE_DIR"
    exit 1
fi

# Check if this is an update
if [ "$1" = "--update" ]; then
    echo "🔄 Updating from USB drive..."
    UPDATE_MODE=true
else
    echo "📥 Copying from USB drive..."
    UPDATE_MODE=false
fi

# Create backup of existing installation if it exists and not updating
if [ -d "$INSTALL_DIR" ] && [ "$UPDATE_MODE" = false ]; then
    echo "💾 Creating backup of existing installation..."
    rm -rf "$BACKUP_DIR"
    mv "$INSTALL_DIR" "$BACKUP_DIR"
    echo "✅ Backup created at: $BACKUP_DIR"
fi

# Copy application from USB drive to home directory
echo "📁 Copying application from USB drive..."
echo "Source: $SOURCE_DIR"
echo "Destination: $INSTALL_DIR"

# Remove existing installation if updating
if [ -d "$INSTALL_DIR" ] && [ "$UPDATE_MODE" = true ]; then
    echo "🗑️  Removing existing installation for update..."
    rm -rf "$INSTALL_DIR"
fi

# Copy the application
cp -r "$SOURCE_DIR" "$INSTALL_DIR"

# Set proper ownership
chown -R $USER:$USER "$INSTALL_DIR"

echo "✅ Application copied successfully!"

# Change to installation directory
cd "$INSTALL_DIR"

# Check if setup script has been run
if [ ! -d "/mnt/thumbdrive" ]; then
    echo "❌ Raspberry Pi setup not completed"
    echo "Please run the setup script first:"
    echo "sudo ./setup-raspberry-pi.sh"
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating environment file..."
    cp backend/env.example backend/.env
    
    # Set default database path based on thumbdrive structure
    if [ -d "$THUMBDRIVE_PATH/boot" ]; then
        DATABASE_PATH="file:/mnt/thumbdrive/pharmastock/pharmastock.db"
    else
        DATABASE_PATH="file:/mnt/thumbdrive/pharmastock.db"
    fi
    
    # Update DATABASE_URL in .env file
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_PATH\"|" backend/.env
    
    echo "⚠️  Environment file created with default settings"
    echo "📝 Please edit backend/.env to set your JWT_SECRET:"
    echo "   nano backend/.env"
    echo ""
    echo "Current DATABASE_URL: $DATABASE_PATH"
    read -p "Press Enter after editing the .env file..."
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run setup

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd backend
npx prisma generate
cd ..

# Create database directory on thumbdrive (check if boot folder exists)
if [ -d "$THUMBDRIVE_PATH/boot" ]; then
    DATABASE_DIR="$THUMBDRIVE_PATH/pharmastock"
else
    DATABASE_DIR="$THUMBDRIVE_PATH"
fi

echo "💾 Setting up database on thumbdrive..."
sudo mkdir -p "$DATABASE_DIR"
sudo chown $USER:$USER "$DATABASE_DIR"

# Initialize database
echo "🗄️  Initializing database..."
cd backend
npx prisma db push
npx prisma db seed
cd ..

# Create systemd service
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/pharmastock.service > /dev/null <<EOF
[Unit]
Description=PharmaStock Backend
After=network.target
RequiresMountsFor=/mnt/thumbdrive

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "🚀 Starting PharmaStock service..."
sudo systemctl daemon-reload
sudo systemctl enable pharmastock.service
sudo systemctl start pharmastock.service

# Check service status
echo "📊 Service status:"
sudo systemctl status pharmastock.service --no-pager

echo ""
echo "✅ Copy and run completed!"
echo "🌐 Your application should be running at: http://localhost:3001"
echo "📊 Check status with: sudo systemctl status pharmastock.service"
echo "📝 View logs with: sudo journalctl -u pharmastock.service -f"
echo ""
echo "🔄 To update from USB drive in the future, run:"
echo "   ./copy-and-run.sh --update"
echo ""
if [ "$UPDATE_MODE" = false ]; then
    echo "💾 Previous installation backed up at: $BACKUP_DIR"
fi
