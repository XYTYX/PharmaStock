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

# Function to install system dependencies (production only)
install_system_dependencies() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Installing system dependencies..."
        apt update
        apt install -y git curl wget
        log "System dependencies installed"
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

# Function to start backend
start_backend() {
    log "Starting backend on port $BACKEND_PORT..."
    
    cd "$BACKEND_DIR"
    export PORT=$BACKEND_PORT
    export NODE_ENV=$ENVIRONMENT
    
    if [ "$ENVIRONMENT" = "development" ]; then
        # Development: use npm run dev
        nohup npm run dev > "$BACKEND_LOG" 2>&1 &
    else
        # Production: use npm start
        nohup npm start > "$BACKEND_LOG" 2>&1 &
    fi
    
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
    
    # Wait a moment and check if it started
    sleep 3
    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        log "Backend started with PID $BACKEND_PID"
    else
        log "ERROR: Failed to start backend"
        exit 1
    fi
}

# Function to start frontend
start_frontend() {
    log "Starting frontend on port $FRONTEND_PORT..."
    
    cd "$FRONTEND_DIR"
    
    if [ "$ENVIRONMENT" = "development" ]; then
        # Development: use npm run dev
        nohup npm run dev -- --port $FRONTEND_PORT --host 0.0.0.0 > "$FRONTEND_LOG" 2>&1 &
    else
        # Production: use npm run preview
        nohup npm run preview -- --port $FRONTEND_PORT --host 0.0.0.0 > "$FRONTEND_LOG" 2>&1 &
    fi
    
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
    
    # Wait a moment and check if it started
    sleep 3
    if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
        log "Frontend started with PID $FRONTEND_PID"
    else
        log "ERROR: Failed to start frontend"
        exit 1
    fi
}

# Function to stop services
stop_services() {
    log "Stopping services..."
    
    # Stop backend
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            log "Stopping backend (PID: $BACKEND_PID)"
            kill "$BACKEND_PID"
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # Stop frontend
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
            log "Stopping frontend (PID: $FRONTEND_PID)"
            kill "$FRONTEND_PID"
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    log "Services stopped"
}

# Function to show status
show_status() {
    log "=== PharmaStock Status ($ENVIRONMENT) ==="
    
    # Check backend
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            log "Backend is running (PID: $BACKEND_PID, Port: $BACKEND_PORT)"
        else
            log "Backend is not running"
        fi
    else
        log "Backend is not running"
    fi
    
    # Check frontend
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
            log "Frontend is running (PID: $FRONTEND_PID, Port: $FRONTEND_PORT)"
        else
            log "Frontend is not running"
        fi
    else
        log "Frontend is not running"
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
    echo "  cleanup      - Stop and clean up"
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
            install_system_dependencies
            install_dependencies
            build_application
            start_backend
            start_frontend
            log "=== Setup Complete ==="
            log "Backend: http://localhost:$BACKEND_PORT"
            log "Frontend: http://localhost:$FRONTEND_PORT"
            log "Logs: $BACKEND_LOG and $FRONTEND_LOG"
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
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
