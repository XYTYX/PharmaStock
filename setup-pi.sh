#!/bin/bash

# setup-pi.sh
# Main setup script for PharmaStock on Raspberry Pi
# This script handles the complete deployment and configuration

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$SCRIPT_DIR/deploy"
SERVICE_NAME="pharmastock"

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

# Function to check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        log "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        log "Node.js installed: $(node --version)"
    else
        log "Node.js is already installed: $(node --version)"
    fi
}

# Function to install dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    apt update
    
    # Install required packages
    apt install -y git curl wget nginx
    
    log "System dependencies installed"
}

# Function to setup the application
setup_application() {
    log "Setting up PharmaStock application..."
    
    # Install root dependencies
    if [ -f "$SCRIPT_DIR/package.json" ]; then
        cd "$SCRIPT_DIR"
        log "Installing root dependencies..."
        npm install
    fi
    
    # Install backend dependencies
    if [ -f "$SCRIPT_DIR/backend/package.json" ]; then
        cd "$SCRIPT_DIR/backend"
        log "Installing backend dependencies..."
        npm install
    fi
    
    # Install frontend dependencies
    if [ -f "$SCRIPT_DIR/frontend/package.json" ]; then
        cd "$SCRIPT_DIR/frontend"
        log "Installing frontend dependencies..."
        npm install
    fi
    
    log "Application dependencies installed"
}

# Function to build the application
build_application() {
    log "Building PharmaStock application..."
    
    # Build backend
    if [ -f "$SCRIPT_DIR/backend/package.json" ]; then
        cd "$SCRIPT_DIR/backend"
        log "Building backend..."
        npm run build
    fi
    
    # Build frontend
    if [ -f "$SCRIPT_DIR/frontend/package.json" ]; then
        cd "$SCRIPT_DIR/frontend"
        log "Building frontend..."
        npm run build
    fi
    
    log "Application built successfully"
}

# Function to setup pharmacy routing
setup_routing() {
    log "Setting up pharmacy routing..."
    
    if [ -f "$DEPLOY_DIR/setup-pharmacy-routing.sh" ]; then
        chmod +x "$DEPLOY_DIR/setup-pharmacy-routing.sh"
        "$DEPLOY_DIR/setup-pharmacy-routing.sh" setup
        log "Pharmacy routing setup completed"
    else
        log "ERROR: setup-pharmacy-routing.sh not found in deploy directory"
        exit 1
    fi
}

# Function to install the service
install_service() {
    log "Installing PharmaStock service..."
    
    if [ -f "$DEPLOY_DIR/install-service.sh" ]; then
        chmod +x "$DEPLOY_DIR/install-service.sh"
        "$DEPLOY_DIR/install-service.sh" install
        log "Service installed successfully"
    else
        log "ERROR: install-service.sh not found in deploy directory"
        exit 1
    fi
}

# Function to show service information
show_service_info() {
    log "=== PharmaStock Setup Complete ==="
    log ""
    log "Your PharmaStock application is now running!"
    log ""
    log "Access URLs:"
    log "  Main Application: http://new-sight.local/pharmacy/"
    log "  API Endpoint:     http://new-sight.local/pharmacy/api/"
    log "  Health Check:     http://new-sight.local/pharmacy/api/health"
    log ""
    log "Service Management:"
    log "  Check status:     systemctl status $SERVICE_NAME"
    log "  Start service:    systemctl start $SERVICE_NAME"
    log "  Stop service:     systemctl stop $SERVICE_NAME"
    log "  Restart service:  systemctl restart $SERVICE_NAME"
    log "  View logs:        journalctl -u $SERVICE_NAME -f"
    log ""
    log "Application Logs:"
    log "  Main log:         tail -f /var/log/pharmastock/pharmastock.log"
    log "  Backend log:      tail -f /var/log/pharmastock/backend.log"
    log "  Frontend log:     tail -f /var/log/pharmastock/frontend.log"
    log ""
    log "The service will automatically start on system boot"
}

# Function to uninstall everything
uninstall() {
    log "Uninstalling PharmaStock..."
    
    # Stop and remove service
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl stop "$SERVICE_NAME"
    fi
    
    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl disable "$SERVICE_NAME"
    fi
    
    # Remove service file
    if [ -f "/etc/systemd/system/$SERVICE_NAME.service" ]; then
        rm -f "/etc/systemd/system/$SERVICE_NAME.service"
        systemctl daemon-reload
    fi
    
    # Remove nginx configuration
    if [ -f "/etc/nginx/sites-enabled/pharmastock" ]; then
        rm -f "/etc/nginx/sites-enabled/pharmastock"
        systemctl restart nginx
    fi
    
    if [ -f "/etc/nginx/sites-available/pharmastock" ]; then
        rm -f "/etc/nginx/sites-available/pharmastock"
    fi
    
    # Remove log rotation
    if [ -f "/etc/logrotate.d/pharmastock" ]; then
        rm -f "/etc/logrotate.d/pharmastock"
    fi
    
    # Remove application directory
    if [ -d "/opt/pharmastock" ]; then
        rm -rf "/opt/pharmastock"
    fi
    
    # Remove logs
    if [ -d "/var/log/pharmastock" ]; then
        rm -rf "/var/log/pharmastock"
    fi
    
    log "PharmaStock uninstalled successfully"
}

# Function to show status
show_status() {
    log "=== PharmaStock Status ==="
    
    echo "Service Status:"
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        systemctl status "$SERVICE_NAME" --no-pager -l
    else
        echo "$SERVICE_NAME service is not running"
    fi
    
    echo ""
    echo "Nginx Status:"
    systemctl status nginx --no-pager -l || true
    
    echo ""
    echo "Nginx Configuration Test:"
    nginx -t || true
}

# Function to show usage
show_usage() {
    echo "Usage: $0 {setup|uninstall|status|routing|service}"
    echo ""
    echo "Commands:"
    echo "  setup     - Complete setup (install dependencies, build, configure, and start)"
    echo "  uninstall - Remove everything (service, nginx config, logs, etc.)"
    echo "  status    - Show current status of all components"
    echo "  routing   - Setup pharmacy routing only"
    echo "  service   - Install service only"
    echo ""
    echo "Examples:"
    echo "  sudo $0 setup      # Complete setup"
    echo "  sudo $0 status     # Check status"
    echo "  sudo $0 uninstall  # Remove everything"
}

# Main execution
main() {
    case "${1:-setup}" in
        setup)
            log "=== Starting PharmaStock Setup ==="
            check_root
            check_systemd
            install_dependencies
            check_nodejs
            setup_application
            build_application
            setup_routing
            install_service
            show_service_info
            log "=== Setup Complete ==="
            ;;
        uninstall)
            log "=== Uninstalling PharmaStock ==="
            check_root
            uninstall
            log "=== Uninstall Complete ==="
            ;;
        status)
            show_status
            ;;
        routing)
            log "=== Setting up Pharmacy Routing ==="
            check_root
            setup_routing
            log "=== Routing Setup Complete ==="
            ;;
        service)
            log "=== Installing Service ==="
            check_root
            install_service
            log "=== Service Installation Complete ==="
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
