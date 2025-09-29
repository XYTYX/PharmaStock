#!/bin/bash

# setup-pharmastock.sh
# Script to configure Raspberry Pi for PharmaStock application
# Run this script from /boot/firmware on startup

set -e  # Exit on any error

echo "Starting PharmaStock setup script..."

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log "ERROR: This script must be run as root"
        exit 1
    fi
}

# Function to configure journald for log rotation
configure_journald() {
    log "Configuring journald for log rotation..."
    
    # Backup original configuration
    cp /etc/systemd/journald.conf /etc/systemd/journald.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # Create minimal journald configuration for log rotation
    cat > /etc/systemd/journald.conf << 'EOF'
[Journal]
# Log rotation settings
SystemMaxUse=50M
SystemMaxFileSize=10M
MaxRetentionSec=14d
EOF

    log "Restarting journald service..."
    systemctl restart systemd-journald
    
    if systemctl is-active --quiet systemd-journald; then
        log "journald service restarted successfully"
    else
        log "ERROR: Failed to restart journald service"
        exit 1
    fi
}

# Function to install and configure log2ram
install_log2ram() {
    log "Checking if log2ram is installed..."
    
    if command -v log2ram &> /dev/null; then
        log "log2ram is already installed"
    else
        log "Installing log2ram..."
        
        # Update package list
        apt update
        
        # Install log2ram
        curl -Lo log2ram.tar.gz https://github.com/azlux/log2ram/archive/master.tar.gz
        tar xf log2ram.tar.gz
        cd log2ram-master
        chmod +x install.sh
        ./install.sh
        cd ..
        rm -rf log2ram-master log2ram.tar.gz
        
        log "log2ram installed successfully"
    fi
    
    # Enable log2ram service
    log "Enabling log2ram service..."
    systemctl enable log2ram
    systemctl start log2ram
    
    if systemctl is-active --quiet log2ram; then
        log "log2ram service started successfully"
    else
        log "WARNING: log2ram service may not have started properly"
    fi
}

# Function to download and setup PharmaStock repository
setup_pharmastock() {
    log "Setting up PharmaStock repository..."
    
    # Create directory for the application
    APP_DIR="/opt/pharmastock"
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    
    # Check if repository already exists
    if [ -d ".git" ]; then
        log "Repository exists, checking for updates..."
        
        # Get current local commit hash
        LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")
        
        # Fetch latest changes without merging
        git fetch origin main
        
        # Get remote commit hash
        REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "none")
        
        log "Local commit:  ${LOCAL_COMMIT:0:8}"
        log "Remote commit: ${REMOTE_COMMIT:0:8}"
        
        # Only update if commits are different
        if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
            log "New commits found, updating repository..."
            git pull origin main
            UPDATE_PERFORMED=true
        else
            log "Repository is up to date, no changes needed"
            UPDATE_PERFORMED=false
        fi
    else
        log "Cloning PharmaStock repository..."
        git clone https://github.com/XYTYX/PharmaStock.git .
        UPDATE_PERFORMED=true
    fi
    
    # Only run setup.sh if there was an update or first install
    if [ "$UPDATE_PERFORMED" = true ]; then
        # Check if setup.sh exists
        if [ -f "setup.sh" ]; then
            log "Running setup.sh script..."
            chmod +x setup.sh
            ./setup.sh
            log "PharmaStock setup completed successfully"
        else
            log "ERROR: setup.sh not found in repository"
            exit 1
        fi
    else
        log "Skipping setup.sh - no updates detected"
    fi
    
    # Run pharmastock-run.sh
    if [ -f "pharmastock-run.sh" ]; then
        log "Running pharmastock-run.sh..."
        chmod +x pharmastock-run.sh
        ./pharmastock-run.sh
        log "PharmaStock application started successfully"
    else
        log "ERROR: pharmastock-run.sh not found in repository"
        exit 1
    fi
}

# Function to create systemd service for this script
create_startup_service() {
    log "Creating systemd service for PharmaStock..."
    
    cat > /etc/systemd/system/pharmastock-setup.service << 'EOF'
[Unit]
Description=PharmaStock Setup Script
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/boot/firmware/setup-pharmastock.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Enable the service
    systemctl daemon-reload
    systemctl enable pharmastock-setup.service
    
    log "PharmaStock setup service created and enabled"
}

# Main execution
main() {
    log "=== PharmaStock Setup Script Started ==="
    
    # Check if running as root
    check_root
    
    # Step 1: Configure journald
    configure_journald
    
    # Step 2: Install and configure log2ram
    install_log2ram
    
    # Step 3: Setup PharmaStock repository
    setup_pharmastock
    
    # Create systemd service for future runs
    create_startup_service
    
    log "=== PharmaStock Setup Script Completed Successfully ==="
}

# Run main function
main "$@"
