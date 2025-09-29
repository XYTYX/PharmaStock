#!/bin/bash

# Copy to USB Script for PharmaStock
# This script copies the current source code to the USB drive
# Usage: ./copy-to-usb.sh

set -e

echo "🍓 Copying PharmaStock source code to USB drive..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Run as regular user."
    exit 1
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
    echo "Please run the setup script first:"
    echo "sudo ./setup-raspberry-pi.sh"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📁 Copying source code to USB drive..."
echo "Source: $(pwd)"
echo "Destination: $SOURCE_DIR"

# Create a temporary directory for the copy
TEMP_DIR="/tmp/pharmastock-copy-$$"
mkdir -p "$TEMP_DIR"

# Copy current directory to temp, excluding unnecessary files
echo "📦 Preparing source code..."
rsync -av --exclude='node_modules' \
         --exclude='.git' \
         --exclude='dist' \
         --exclude='*.log' \
         --exclude='.env' \
         --exclude='pharmastock.db' \
         --exclude='pharmastock.db-journal' \
         --exclude='pharmastock.db-wal' \
         --exclude='pharmastock.db-shm' \
         --exclude='backup' \
         --exclude='*.backup' \
         . "$TEMP_DIR/"

# Remove existing source on USB drive
echo "🗑️  Removing existing source on USB drive..."
rm -rf "$SOURCE_DIR"

# Copy to USB drive
echo "📁 Copying to USB drive..."
mv "$TEMP_DIR" "$SOURCE_DIR"

# Set proper ownership
chown -R $USER:$USER "$SOURCE_DIR"

echo "✅ Source code copied successfully to USB drive!"
echo "📁 Location: $SOURCE_DIR"
echo ""
echo "Next steps:"
echo "1. On your Raspberry Pi, run: ./copy-and-run.sh"
echo "2. Or to update existing installation: ./copy-and-run.sh --update"
