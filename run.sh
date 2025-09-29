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

# PID files
BACKEND_PID_FILE="$SCRIPT_DIR/backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/frontend.pid"

# Log files
BACKEND_LOG="$SCRIPT_DIR/backend.log"
FRONTEND_LOG="$SCRIPT_DIR/frontend.log"

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

# Function to check if PM2 is installed (for development)
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        if [ "$ENVIRONMENT" = "development" ]; then
            log "Installing PM2 for development..."
            npm install -g pm2
            log "PM2 installed: $(pm2 --version)"
        else
            log "PM2 not available for production mode"
        fi
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
    fi
}

# Function to setup USB drive for production database
setup_usb_database() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Setting up USB drive for production database..."
        
        # Create USB mount point
        mkdir -p /mnt/usb
        
        # Check if USB is already mounted
        if ! mountpoint -q /mnt/usb; then
            # Find USB device (look for common USB device patterns)
            USB_DEVICE=""
            for device in /dev/sd*[1-9] /dev/sd*[a-z][1-9]; do
                if [ -b "$device" ]; then
                    # Check if it's a USB device
                    if udevadm info --query=property --name="$device" | grep -q "ID_BUS=usb"; then
                        USB_DEVICE="$device"
                        break
                    fi
                fi
            done
            
            if [ -n "$USB_DEVICE" ]; then
                log "Found USB device: $USB_DEVICE"
                # Mount USB drive
                mount "$USB_DEVICE" /mnt/usb
                log "USB drive mounted at /mnt/usb"
            else
                log "WARNING: No USB device found. Creating local production database directory."
                mkdir -p /mnt/usb/pharmastock
            fi
        else
            log "USB drive already mounted at /mnt/usb"
        fi
        
        # Create pharmastock directory on USB
        mkdir -p /mnt/usb/pharmastock
        log "Database directory created: /mnt/usb/pharmastock"
    fi
}

# Function to load environment configuration
load_environment_config() {
    # Set NODE_ENV based on environment parameter
    export NODE_ENV="$ENVIRONMENT"
    
    # Load base configuration first
    local base_config="$BACKEND_DIR/config.base"
    if [ -f "$base_config" ]; then
        log "Loading base configuration from $base_config"
        set -a  # automatically export all variables
        source "$base_config"
        set +a  # stop automatically exporting
    else
        log "WARNING: No base config file found at $base_config, using defaults"
        export PORT=3000
        export FRONTEND_URL="http://localhost:3001"
    fi
    
    # Load environment-specific overrides
    local env_config="$BACKEND_DIR/config.$ENVIRONMENT"
    if [ -f "$env_config" ]; then
        log "Loading environment overrides from $env_config"
        set -a  # automatically export all variables
        source "$env_config"
        set +a  # stop automatically exporting
        log "Environment configuration loaded"
    else
        log "WARNING: No environment config file found at $env_config"
        # Set default database URL based on environment
        if [ "$ENVIRONMENT" = "development" ]; then
            export DATABASE_URL="file:./prisma/dev.db"
        else
            export DATABASE_URL="file:/mnt/usb/pharmastock/production.db"
        fi
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

# Function to create PM2 ecosystem file
create_pm2_ecosystem() {
    log "Creating PM2 ecosystem file..."
    
    # Load environment config for PM2 ecosystem creation
    load_environment_config
    
    cat > "$SCRIPT_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [
    {
      name: 'pharmastock-backend',
      script: './backend/dist/index.js',
      cwd: process.cwd(),
      env: {
        NODE_ENV: '$NODE_ENV',
        PORT: $PORT,
        DATABASE_URL: '$DATABASE_URL',
        FRONTEND_URL: '$FRONTEND_URL'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      log_file: './backend.log',
      out_file: './backend.log',
      error_file: './backend.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'pharmastock-frontend',
      script: 'npm',
      args: 'run dev -- --port 3001 --host 0.0.0.0',
      cwd: './frontend',
      env: {
        NODE_ENV: '$NODE_ENV'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      log_file: './frontend.log',
      out_file: './frontend.log',
      error_file: './frontend.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF

    log "PM2 ecosystem file created"
}

# Function to create systemd services
create_systemd_services() {
    log "Creating systemd services..."
    
    # Load environment config for systemd service creation
    load_environment_config
    
    # Backend service
    cat > /etc/systemd/system/pharmastock-backend.service << EOF
[Unit]
Description=PharmaStock Backend
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$SCRIPT_DIR/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pharmastock-backend

# Environment variables
Environment=NODE_ENV=$NODE_ENV
Environment=PORT=$PORT
Environment=DATABASE_URL=$DATABASE_URL
Environment=FRONTEND_URL=$FRONTEND_URL

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$SCRIPT_DIR /mnt/usb

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service
    cat > /etc/systemd/system/pharmastock-frontend.service << EOF
[Unit]
Description=PharmaStock Frontend
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$SCRIPT_DIR/frontend
ExecStart=/usr/bin/npm run preview -- --port 3001 --host 0.0.0.0
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pharmastock-frontend

# Environment variables
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$SCRIPT_DIR

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    systemctl daemon-reload
    
    log "Systemd services created"
}

# Function to start backend
start_backend() {
    log "Starting backend on port $BACKEND_PORT..."
    
    if [ "$ENVIRONMENT" = "development" ]; then
        # Development: use PM2
        if command -v pm2 &> /dev/null; then
            log "Starting backend with PM2..."
            pm2 start ecosystem.config.js --only pharmastock-backend
            log "Backend started with PM2"
        else
            log "ERROR: PM2 not available for development mode"
            exit 1
        fi
    else
        # Production: use systemd
        log "Starting backend with systemd..."
        systemctl start pharmastock-backend
        systemctl enable pharmastock-backend
        log "Backend started with systemd"
    fi
}

# Function to start frontend
start_frontend() {
    log "Starting frontend on port $FRONTEND_PORT..."
    
    if [ "$ENVIRONMENT" = "development" ]; then
        # Development: use PM2
        if command -v pm2 &> /dev/null; then
            log "Starting frontend with PM2..."
            pm2 start ecosystem.config.js --only pharmastock-frontend
            log "Frontend started with PM2"
        else
            log "ERROR: PM2 not available for development mode"
            exit 1
        fi
    else
        # Production: use systemd
        log "Starting frontend with systemd..."
        systemctl start pharmastock-frontend
        systemctl enable pharmastock-frontend
        log "Frontend started with systemd"
    fi
}

# Function to stop services
stop_services() {
    log "Stopping services..."
    
    if [ "$ENVIRONMENT" = "development" ]; then
        # Development: use PM2
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
    else
        # Production: use systemd
        log "Stopping services with systemd..."
        systemctl stop pharmastock-backend pharmastock-frontend 2>/dev/null || true
        systemctl disable pharmastock-backend pharmastock-frontend 2>/dev/null || true
        log "Services stopped with systemd"
    fi
    
    # Clean up PID files
    rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
    
    log "Services stopped"
}

# Function to show status
show_status() {
    log "=== PharmaStock Status ($ENVIRONMENT) ==="
    
    if [ "$ENVIRONMENT" = "development" ]; then
        # Development: check PM2
        if command -v pm2 &> /dev/null; then
            log "PM2 Status:"
            pm2 status
        else
            log "PM2 not available"
        fi
    else
        # Production: check systemd
        log "Systemd Status:"
        systemctl status pharmastock-backend --no-pager -l || true
        echo ""
        systemctl status pharmastock-frontend --no-pager -l || true
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
    echo "  logs         - Follow logs (PM2 for dev, systemd for prod)"
    echo "  cleanup      - Stop and clean up"
    echo "  pm2          - PM2 management (dev only)"
    echo "  systemd      - Systemd management (prod only)"
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
            setup_usb_database
            load_environment_config
            install_dependencies
            build_application
            create_pm2_ecosystem
            create_systemd_services
            start_backend
            start_frontend
            log "=== Setup Complete ==="
            log "Backend: http://localhost:$BACKEND_PORT"
            log "Frontend: http://localhost:$FRONTEND_PORT"
            log "Database: $DATABASE_URL"
            if [ "$ENVIRONMENT" = "development" ]; then
                log "PM2 Logs: pm2 logs"
                log "PM2 Status: pm2 status"
            else
                log "Systemd Logs: journalctl -u pharmastock-backend -f"
                log "Systemd Status: systemctl status pharmastock-backend"
            fi
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
            setup_usb_database
            load_environment_config
            install_dependencies
            build_application
            start_backend
            start_frontend
            log "=== PharmaStock Started ==="
            log "Backend: http://localhost:$BACKEND_PORT"
            log "Frontend: http://localhost:$FRONTEND_PORT"
            log "Database: $DATABASE_URL"
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
            if [ "$ENVIRONMENT" = "development" ]; then
                log "=== PM2 Logs ==="
                pm2 logs
            else
                log "=== Systemd Logs ==="
                journalctl -u pharmastock-backend -u pharmastock-frontend -f
            fi
            ;;
        pm2)
            log "=== PM2 Management ==="
            pm2 $3 $4 $5
            ;;
        systemd)
            log "=== Systemd Management ==="
            systemctl $3 pharmastock-backend pharmastock-frontend
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
