#!/bin/bash

# install-service.sh
# Script to install PharmaStock as a systemd service
# This script sets up the service to run on system boot

set -e  # Exit on any error

# Configuration
SERVICE_NAME="pharmastock"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
APP_DIR="/opt/pharmastock"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log "ERROR: This script must be run as root"
        log "Please run: sudo $0"
        exit 1
    fi
}

# Function to check if systemd is available
check_systemd() {
    if ! command -v systemctl &> /dev/null; then
        log "ERROR: systemd is not available on this system"
        exit 1
    fi
    
    log "systemd is available: $(systemctl --version | head -n1)"
}

# Function to stop existing service if running
stop_existing_service() {
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        log "Stopping existing $SERVICE_NAME service..."
        systemctl stop "$SERVICE_NAME"
    fi
    
    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        log "Disabling existing $SERVICE_NAME service..."
        systemctl disable "$SERVICE_NAME"
    fi
}

# Function to copy application files
copy_application_files() {
    log "Copying application files to $APP_DIR..."
    
    # Create application directory
    mkdir -p "$APP_DIR"
    
    # Copy all application files
    cp -r "$SCRIPT_DIR"/* "$APP_DIR/"
    
    # Set proper permissions
    chown -R root:root "$APP_DIR"
    chmod +x "$APP_DIR/pharmastock-run.sh"
    
    log "Application files copied successfully"
}

# Function to install systemd service
install_systemd_service() {
    log "Installing systemd service..."
    
    # Copy service file
    cp "$APP_DIR/pharmastock.service" "$SERVICE_FILE"
    
    # Reload systemd daemon
    systemctl daemon-reload
    
    # Enable the service
    systemctl enable "$SERVICE_NAME"
    
    log "Systemd service installed and enabled"
}

# Function to create log rotation configuration
setup_log_rotation() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/pharmastock << 'EOF'
/var/log/pharmastock/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        systemctl reload pharmastock > /dev/null 2>&1 || true
    endscript
}
EOF

    log "Log rotation configured"
}

# Function to start the service
start_service() {
    log "Starting $SERVICE_NAME service..."
    
    systemctl start "$SERVICE_NAME"
    
    # Wait a moment for the service to start
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "$SERVICE_NAME service started successfully"
    else
        log "ERROR: Failed to start $SERVICE_NAME service"
        log "Check service status with: systemctl status $SERVICE_NAME"
        log "Check logs with: journalctl -u $SERVICE_NAME -f"
        exit 1
    fi
}

# Function to show service information
show_service_info() {
    log "=== Service Installation Complete ==="
    log ""
    log "Service Name: $SERVICE_NAME"
    log "Service File: $SERVICE_FILE"
    log "Application Directory: $APP_DIR"
    log "Log Directory: /var/log/pharmastock"
    log ""
    log "Useful commands:"
    log "  Check status:    systemctl status $SERVICE_NAME"
    log "  Start service:   systemctl start $SERVICE_NAME"
    log "  Stop service:    systemctl stop $SERVICE_NAME"
    log "  Restart service: systemctl restart $SERVICE_NAME"
    log "  View logs:       journalctl -u $SERVICE_NAME -f"
    log "  View app logs:   tail -f /var/log/pharmastock/pharmastock.log"
    log ""
    log "The service will automatically start on system boot"
}

# Function to uninstall the service
uninstall_service() {
    log "Uninstalling $SERVICE_NAME service..."
    
    # Stop and disable service
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl stop "$SERVICE_NAME"
    fi
    
    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl disable "$SERVICE_NAME"
    fi
    
    # Remove service file
    if [ -f "$SERVICE_FILE" ]; then
        rm -f "$SERVICE_FILE"
        systemctl daemon-reload
    fi
    
    # Remove log rotation config
    if [ -f "/etc/logrotate.d/pharmastock" ]; then
        rm -f "/etc/logrotate.d/pharmastock"
    fi
    
    log "Service uninstalled successfully"
    log "Note: Application files in $APP_DIR were not removed"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 {install|uninstall|status}"
    echo "  install   - Install PharmaStock as a systemd service"
    echo "  uninstall - Remove the systemd service"
    echo "  status    - Show service status"
}

# Main execution
main() {
    case "${1:-install}" in
        install)
            log "=== Installing PharmaStock Service ==="
            check_root
            check_systemd
            stop_existing_service
            copy_application_files
            install_systemd_service
            setup_log_rotation
            start_service
            show_service_info
            ;;
        uninstall)
            log "=== Uninstalling PharmaStock Service ==="
            check_root
            uninstall_service
            ;;
        status)
            if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
                log "$SERVICE_NAME service is running"
                systemctl status "$SERVICE_NAME" --no-pager
            else
                log "$SERVICE_NAME service is not running"
            fi
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
