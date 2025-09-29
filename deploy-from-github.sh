#!/bin/bash

# Quick Deploy Script for Raspberry Pi
# This script downloads and runs the deployment from GitHub
# Usage: curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/pharmastock-pro/main/deploy-from-github.sh | bash

set -e

echo "🍓 Quick Deploy PharmaStock to Raspberry Pi..."

# Configuration - Update these for your repository
GITHUB_REPO="your-username/pharmastock-pro"
GITHUB_BRANCH="main"
TEMP_DIR="/tmp/pharmastock-deploy"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Run as regular user."
    exit 1
fi

# Install git if not present
if ! command -v git &> /dev/null; then
    echo "📦 Installing git..."
    sudo apt update
    sudo apt install -y git
fi

# Download deployment script from GitHub
echo "📥 Downloading deployment script from GitHub..."
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download the copy-and-run.sh script
curl -sSL "https://raw.githubusercontent.com/$GITHUB_REPO/$GITHUB_BRANCH/copy-and-run.sh" -o copy-and-run.sh
chmod +x copy-and-run.sh

# Download the setup script
curl -sSL "https://raw.githubusercontent.com/$GITHUB_REPO/$GITHUB_BRANCH/setup-raspberry-pi.sh" -o setup-raspberry-pi.sh
chmod +x setup-raspberry-pi.sh

# Check if setup has been run
if [ ! -d "/mnt/thumbdrive" ]; then
    echo "⚙️  Running Raspberry Pi setup..."
    sudo ./setup-raspberry-pi.sh
fi

# Run deployment
echo "🚀 Running deployment..."
./copy-and-run.sh

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo "✅ Quick deployment completed!"
