#!/bin/bash

# Raspberry Pi Deployment Script
# This script downloads the repository from GitHub and deploys PharmaStock

set -e

echo "🍓 Deploying PharmaStock to Raspberry Pi..."

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
    GITHUB_REPO="xytyx/pharmastock"  # Update this with your GitHub repo
    GITHUB_BRANCH="main"  # Update this if you use a different branch
    INSTALL_DIR="/home/$USER/pharmastock"
    BACKUP_DIR="/home/$USER/pharmastock-backup"
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "📦 Installing git..."
    sudo apt update
    sudo apt install -y git
fi

# Create backup of existing installation if it exists
if [ -d "$INSTALL_DIR" ]; then
    echo "💾 Creating backup of existing installation..."
    rm -rf "$BACKUP_DIR"
    mv "$INSTALL_DIR" "$BACKUP_DIR"
    echo "✅ Backup created at: $BACKUP_DIR"
fi

# Download repository from GitHub
echo "📥 Downloading repository from GitHub..."
echo "Repository: https://github.com/$GITHUB_REPO"
echo "Branch: $GITHUB_BRANCH"

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    echo "🔄 Updating existing repository..."
    cd "$INSTALL_DIR"
    git fetch origin
    git reset --hard origin/$GITHUB_BRANCH
    git clean -fd
else
    echo "📥 Cloning repository..."
    git clone -b $GITHUB_BRANCH https://github.com/$GITHUB_REPO.git "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Check if setup script has been run
if [ ! -d "/mnt/thumbdrive" ]; then
    echo "❌ Raspberry Pi setup not completed"
    echo "Please run the setup script first:"
    echo "sudo ./setup-raspberry-pi.sh"
    exit 1
fi

THUMBDRIVE_PATH="/mnt/thumbdrive"

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
echo "✅ Deployment completed!"
echo "🌐 Your application should be running at: http://localhost:3001"
echo "📊 Check status with: sudo systemctl status pharmastock.service"
echo "📝 View logs with: sudo journalctl -u pharmastock.service -f"
echo ""
echo "🔄 To update in the future, simply run this script again:"
echo "   ./deploy-to-pi.sh"
echo ""
echo "💾 Previous installation backed up at: $BACKUP_DIR"
