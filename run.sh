#!/bin/bash

# run.sh
# Simple script to run PharmaStock application
# No service management, just runs the app directly

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
FRONTEND_PORT=3001
BACKEND_PORT=3000
ENVIRONMENT="${1:-development}"

# Log files
if [ "$ENVIRONMENT" = "production" ]; then
    BACKEND_LOG="/var/log/pharmastock/backend.log"
    FRONTEND_LOG="/var/log/pharmastock/frontend.log"
else
    BACKEND_LOG="$SCRIPT_DIR/backend.log"
    FRONTEND_LOG="$SCRIPT_DIR/frontend.log"
fi

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if running as root (for production setup)
check_root() {
    if [ "$EUID" -ne 0 ] && [ "$ENVIRONMENT" = "production" ]; then
        log "ERROR: Production mode requires root privileges"
        log "Please run: sudo $0 production"
        exit 1
    fi
}

# Function to check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        if [ "$ENVIRONMENT" = "production" ]; then
            log "Installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
            apt-get install -y nodejs
            log "Node.js installed: $(node --version)"
        else
            log "ERROR: Node.js is not installed"
            log "Please install Node.js first: https://nodejs.org/"
            exit 1
        fi
    else
        log "Node.js version: $(node --version)"
    fi
    
    if ! command -v npm &> /dev/null; then
        log "ERROR: npm is not installed"
        exit 1
    fi
    
    log "npm version: $(npm --version)"
}

# Function to check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        log "Installing PM2..."
        npm install -g pm2
        log "PM2 installed: $(pm2 --version)"
    else
        log "PM2 version: $(pm2 --version)"
    fi
}

# Function to install system dependencies (production only)
install_system_dependencies() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Installing system dependencies..."
        apt update
        apt install -y git curl wget util-linux
        log "System dependencies installed"
        
        # Create log directories for production
        log "Creating log directories..."
        mkdir -p /var/log/pharmastock
        chmod 755 /var/log/pharmastock
        log "Log directories created"
    fi
}

# Function to install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install root dependencies
    if [ -f "$SCRIPT_DIR/package.json" ]; then
        cd "$SCRIPT_DIR"
        log "Installing root dependencies..."
        npm install
    fi
    
    # Install backend dependencies
    if [ -f "$BACKEND_DIR/package.json" ]; then
        cd "$BACKEND_DIR"
        log "Installing backend dependencies..."
        npm install
    fi
    
    # Install frontend dependencies
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        cd "$FRONTEND_DIR"
        log "Installing frontend dependencies..."
        npm install
    fi
    
    log "Dependencies installed"
}

# Function to build the application
build_application() {
    log "Building application..."
    
    # Build backend
    if [ -f "$BACKEND_DIR/package.json" ]; then
        cd "$BACKEND_DIR"
        log "Building backend..."
        npm run build
    fi
    
    # Build frontend
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        cd "$FRONTEND_DIR"
        log "Building frontend..."
        npm run build
    fi
    
    log "Application built successfully"
}

# Function to setup configuration files from examples
setup_config_files() {
    log "Setting up configuration files..."
    
    # Setup ecosystem.config.js from example
    if [ -f "$SCRIPT_DIR/ecosystem.config.js.example" ] && [ ! -f "$SCRIPT_DIR/ecosystem.config.js" ]; then
        log "Creating ecosystem.config.js from example..."
        cp "$SCRIPT_DIR/ecosystem.config.js.example" "$SCRIPT_DIR/ecosystem.config.js"
        
        # Replace placeholders with actual values
        sed -i "s|{PROJECT_ROOT}|$SCRIPT_DIR|g" "$SCRIPT_DIR/ecosystem.config.js"
        
        log "ecosystem.config.js created from example"
    fi
    
    log "Configuration files setup complete"
}

# Function to validate PM2 ecosystem file
validate_pm2_ecosystem() {
    log "Validating PM2 ecosystem file..."
    
    if [ ! -f "$SCRIPT_DIR/ecosystem.config.js" ]; then
        log "ERROR: ecosystem.config.js not found"
        log "Please ensure ecosystem.config.js exists in the project root"
        exit 1
    fi
    
    # Test if the ecosystem file is valid JavaScript
    if ! node -c "$SCRIPT_DIR/ecosystem.config.js" 2>/dev/null; then
        log "ERROR: ecosystem.config.js contains invalid JavaScript"
        exit 1
    fi
    
    log "PM2 ecosystem file validated"
}

# Function to start backend
start_backend() {
    log "Starting backend on port $BACKEND_PORT..."
    
    if command -v pm2 &> /dev/null; then
        log "Starting backend with PM2..."
        if [ "$ENVIRONMENT" = "production" ]; then
            pm2 start "$SCRIPT_DIR/ecosystem.config.js" --only pharmastock-backend --env production
        else
            pm2 start "$SCRIPT_DIR/ecosystem.config.js" --only pharmastock-backend
        fi
        log "Backend started with PM2"
    else
        log "ERROR: PM2 not available"
        exit 1
    fi
}

# Function to start frontend
start_frontend() {
    log "Starting frontend on port $FRONTEND_PORT..."
    
    if command -v pm2 &> /dev/null; then
        log "Starting frontend with PM2..."
        if [ "$ENVIRONMENT" = "production" ]; then
            pm2 start "$SCRIPT_DIR/ecosystem.config.js" --only pharmastock-frontend --env production
        else
            pm2 start "$SCRIPT_DIR/ecosystem.config.js" --only pharmastock-frontend
        fi
        log "Frontend started with PM2"
    else
        log "ERROR: PM2 not available"
        exit 1
    fi
}

# Function to stop services
stop_services() {
    log "Stopping services..."
    
    if command -v pm2 &> /dev/null; then
        log "Stopping services with PM2..."
        pm2 stop pharmastock-backend pharmastock-frontend 2>/dev/null || true
        pm2 delete pharmastock-backend pharmastock-frontend 2>/dev/null || true
        log "Services stopped with PM2"
    else
        log "PM2 not available, trying to kill processes manually..."
        pkill -f "pharmastock-backend" 2>/dev/null || true
        pkill -f "pharmastock-frontend" 2>/dev/null || true
    fi
    
    log "Services stopped"
}

# Function to show status
show_status() {
    log "=== PharmaStock Status ($ENVIRONMENT) ==="
    
    if command -v pm2 &> /dev/null; then
        log "PM2 Status:"
        pm2 status
    else
        log "PM2 not available"
    fi
}

# Function to cleanup
cleanup() {
    log "Cleaning up..."
    stop_services
    rm -f "$BACKEND_LOG" "$FRONTEND_LOG"
    log "Cleanup complete"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [environment] [command]"
    echo ""
    echo "Environments:"
    echo "  development  - Development mode (default)"
    echo "  production   - Production mode"
    echo ""
    echo "Commands:"
    echo "  setup        - Complete setup and start (idempotent)"
    echo "  install      - Install dependencies only"
    echo "  build        - Build the application"
    echo "  start        - Start the application"
    echo "  stop         - Stop the application"
    echo "  restart      - Restart the application"
    echo "  status       - Show status"
    echo "  logs         - Follow PM2 logs"
    echo "  cleanup      - Stop and clean up"
    echo "  pm2          - PM2 management"
    echo "  pm2-save     - Save PM2 configuration"
    echo ""
    echo "Examples:"
    echo "  $0                           # Development mode, start"
    echo "  $0 development setup         # Development mode, complete setup"
    echo "  $0 production setup          # Production mode, complete setup"
    echo "  $0 development start         # Development mode, start"
    echo "  $0 production start          # Production mode, start"
    echo "  $0 development stop          # Development mode, stop"
    echo "  $0 production status         # Production mode, status"
    echo ""
    echo "Idempotent Setup Commands:"
    echo "  $0 development setup         # Complete dev setup (can run multiple times)"
    echo "  sudo $0 production setup     # Complete prod setup (can run multiple times)"
}

# Main execution
main() {
    local command="${2:-start}"
    
    case "$command" in
        setup)
            log "=== Complete Setup ($ENVIRONMENT) ==="
            check_root
            check_nodejs
            check_pm2
            install_system_dependencies
            setup_config_files
            install_dependencies
            build_application
            validate_pm2_ecosystem
            start_backend
            start_frontend
            log "=== Setup Complete ==="
            log "Backend: http://localhost:$BACKEND_PORT"
            log "Frontend: http://localhost:$FRONTEND_PORT"
            log "PM2 Logs: pm2 logs"
            log "PM2 Status: pm2 status"
            log "Use '$0 $ENVIRONMENT stop' to stop the application"
            ;;
        install)
            log "=== Installing Dependencies ==="
            check_root
            check_nodejs
            install_system_dependencies
            install_dependencies
            log "=== Installation Complete ==="
            ;;
        build)
            log "=== Building Application ==="
            check_root
            check_nodejs
            install_dependencies
            build_application
            log "=== Build Complete ==="
            ;;
        start)
            log "=== Starting PharmaStock ($ENVIRONMENT) ==="
            check_root
            check_nodejs
            install_system_dependencies
            setup_config_files
            install_dependencies
            build_application
            start_backend
            start_frontend
            log "=== PharmaStock Started ==="
            log "Backend: http://localhost:$BACKEND_PORT"
            log "Frontend: http://localhost:$FRONTEND_PORT"
            log "Logs: $BACKEND_LOG and $FRONTEND_LOG"
            ;;
        stop)
            log "=== Stopping PharmaStock ==="
            stop_services
            log "=== PharmaStock Stopped ==="
            ;;
        restart)
            log "=== Restarting PharmaStock ==="
            stop_services
            sleep 2
            main "$@"
            ;;
        status)
            show_status
            ;;
        cleanup)
            log "=== Cleaning up PharmaStock ==="
            cleanup
            log "=== Cleanup Complete ==="
            ;;
        logs)
            log "=== PM2 Logs ==="
            pm2 logs
            ;;
        pm2)
            log "=== PM2 Management ==="
            pm2 $3 $4 $5
            ;;
        pm2-save)
            log "=== Saving PM2 Configuration ==="
            pm2 save
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
