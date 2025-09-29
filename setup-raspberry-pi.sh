#!/bin/bash

# Raspberry Pi Setup Script
# This script sets up the Raspberry Pi for PharmaStock deployment
# Includes thumbdrive mounting, log2ram installation, and system optimization

set -e

echo "🍓 Setting up Raspberry Pi for PharmaStock..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

THUMBDRIVE_PATH="/mnt/thumbdrive"
THUMBDRIVE_LABEL="PHARMASTOCK_DB"

# Create mount point
echo "📁 Creating mount point..."
mkdir -p "$THUMBDRIVE_PATH"

# Find thumbdrive device
echo "🔍 Looking for thumbdrive..."
DEVICE=""
for dev in /dev/sd*; do
    if [ -b "$dev" ]; then
        LABEL=$(blkid -s LABEL -o value "$dev" 2>/dev/null || echo "")
        if [ "$LABEL" = "$THUMBDRIVE_LABEL" ]; then
            DEVICE="$dev"
            break
        fi
    fi
done

if [ -z "$DEVICE" ]; then
    echo "❌ Thumbdrive with label '$THUMBDRIVE_LABEL' not found"
    echo "Please format your thumbdrive with the label '$THUMBDRIVE_LABEL'"
    echo "You can do this with: sudo mkfs.ext4 -L $THUMBDRIVE_LABEL /dev/sdX"
    exit 1
fi

echo "✅ Found thumbdrive at: $DEVICE"

# Mount the thumbdrive temporarily to check structure
echo "🔗 Mounting thumbdrive temporarily..."
mount "$DEVICE" "$THUMBDRIVE_PATH"

# Check if boot folder exists (indicating this is also the boot drive)
if [ -d "$THUMBDRIVE_PATH/boot" ]; then
    echo "⚠️  Boot folder detected on thumbdrive - this is also the boot drive"
    echo "📁 Creating separate directory for database storage..."
    DATABASE_DIR="$THUMBDRIVE_PATH/pharmastock"
else
    echo "📁 Using root directory for database storage..."
    DATABASE_DIR="$THUMBDRIVE_PATH"
fi

# Create database directory
echo "📁 Creating database directory..."
mkdir -p "$DATABASE_DIR"
chown $SUDO_USER:$SUDO_USER "$DATABASE_DIR"

# Create source code directory on USB drive
echo "📁 Creating source code directory on USB drive..."
SOURCE_DIR="$THUMBDRIVE_PATH/pharmastock-source"
mkdir -p "$SOURCE_DIR"
chown $SUDO_USER:$SUDO_USER "$SOURCE_DIR"

# Unmount temporarily
umount "$THUMBDRIVE_PATH"

# Create fstab entry for automatic mounting
echo "⚙️  Setting up automatic mounting..."
FSTAB_ENTRY="$DEVICE $THUMBDRIVE_PATH ext4 defaults,noatime 0 2"

# Check if entry already exists
if ! grep -q "$THUMBDRIVE_PATH" /etc/fstab; then
    echo "$FSTAB_ENTRY" >> /etc/fstab
    echo "✅ Added fstab entry for automatic mounting"
else
    echo "⚠️  fstab entry already exists"
fi

# Mount the thumbdrive
echo "🔗 Mounting thumbdrive..."
mount "$THUMBDRIVE_PATH"

# Set permissions
echo "🔐 Setting permissions..."
chown -R $SUDO_USER:$SUDO_USER "$THUMBDRIVE_PATH"

# Install log2ram to reduce SD card writes
echo "📝 Installing log2ram to reduce SD card writes..."
apt update
apt install -y log2ram

# Configure log2ram
echo "⚙️  Configuring log2ram..."
cat > /etc/log2ram.conf <<EOF
# Log2ram configuration for PharmaStock
# This reduces SD card wear by keeping logs in RAM

# Size of the ramdisk in MB
SIZE=128M

# Use rsync instead of cp for better performance
USE_RSYNC=false

# Mail log if there's an error
MAIL=false

# Path to log directory
LOG_DIR=/var/log

# Path to ramdisk
RAM_DIR=/var/log.ram

# Path to backup directory
BACKUP_DIR=/var/log.backup

# Compression level (0-9, 0=no compression)
COMPRESSION=0

# Auto cleanup old logs
AUTO_CLEANUP=true

# Cleanup threshold (days)
CLEANUP_THRESHOLD=7
EOF

# Enable log2ram service
systemctl enable log2ram
systemctl start log2ram

# Optimize system for reduced writes
echo "🔧 Optimizing system for reduced writes..."

# Disable swap to reduce writes
swapoff -a
sed -i '/swap/d' /etc/fstab

# Optimize filesystem mount options
echo "⚙️  Optimizing filesystem mount options..."
sed -i 's/defaults/defaults,noatime,nodiratime/' /etc/fstab

# Configure tmpfs for temporary files
echo "📁 Setting up tmpfs for temporary files..."
cat >> /etc/fstab <<EOF
tmpfs /tmp tmpfs defaults,noatime,nosuid,size=100m 0 0
tmpfs /var/tmp tmpfs defaults,noatime,nosuid,size=50m 0 0
EOF

# Optimize SQLite for reduced writes
echo "🗄️  Optimizing SQLite configuration..."
mkdir -p /etc/sqlite3
cat > /etc/sqlite3/sqlite3.conf <<EOF
-- SQLite optimization for Raspberry Pi
-- Reduces writes and improves performance

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
EOF

# Set up log rotation to prevent log files from growing too large
echo "📝 Setting up log rotation..."
cat > /etc/logrotate.d/pharmastock <<EOF
/var/log/pharmastock.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $SUDO_USER $SUDO_USER
    postrotate
        systemctl reload pharmastock.service
    endscript
}
EOF

# Create system optimization script
echo "📝 Creating system optimization script..."
cat > /usr/local/bin/optimize-pi.sh <<'EOF'
#!/bin/bash
# System optimization script for Raspberry Pi

# Clear package cache
apt clean

# Clear temporary files
rm -rf /tmp/*
rm -rf /var/tmp/*

# Clear log files (except current ones)
find /var/log -name "*.log" -type f -mtime +7 -delete
find /var/log -name "*.gz" -type f -mtime +30 -delete

# Clear APT cache
apt autoremove -y
apt autoclean

echo "✅ System optimization completed"
EOF

chmod +x /usr/local/bin/optimize-pi.sh

# Set up weekly optimization cron job
echo "⏰ Setting up weekly optimization..."
(crontab -l 2>/dev/null; echo "0 2 * * 0 /usr/local/bin/optimize-pi.sh") | crontab -

echo ""
echo "✅ Raspberry Pi setup completed!"
echo "💾 Database will be stored at: $DATABASE_DIR/pharmastock.db"
echo "📁 Source code directory created at: $SOURCE_DIR"
echo "🔄 Thumbdrive will automatically mount on boot"
echo "📝 log2ram installed to reduce SD card writes"
echo "🔧 System optimized for reduced writes"
echo ""
echo "Next steps:"
echo "1. Copy your PharmaStock source code to: $SOURCE_DIR"
echo "2. Run ./copy-and-run.sh to copy and deploy the application"
echo "3. The database will be automatically created on the thumbdrive"
echo "4. System will automatically optimize itself weekly"
