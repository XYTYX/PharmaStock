#!/bin/bash

# pharmastock-run.sh
# Script to start PharmaStock application on system boot
# This script starts both backend and frontend services with pharmacy routing

set -e  # Exit on any error

# Configuration
APP_DIR="/opt/pharmastock"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
LOG_DIR="/var/log/pharmastock"
PID_DIR="/var/run/pharmastock"
FRONTEND_PORT=3001
BACKEND_PORT=3000

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/pharmastock.log"
}

# Function to create necessary directories
create_directories() {
    mkdir -p "$LOG_DIR"
    mkdir -p "$PID_DIR"
    mkdir -p "$APP_DIR"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log "ERROR: This script must be run as root"
        exit 1
    fi
}

# Function to check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        log "ERROR: Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log "ERROR: npm is not installed"
        exit 1
    fi
    
    log "Node.js version: $(node --version)"
    log "npm version: $(npm --version)"
}

# Function to install dependencies if needed
install_dependencies() {
    log "Checking and installing dependencies..."
    
    # Install root dependencies
    if [ -f "$APP_DIR/package.json" ]; then
        cd "$APP_DIR"
        if [ ! -d "node_modules" ]; then
            log "Installing root dependencies..."
            npm install --production
        fi
    fi
    
    # Install backend dependencies
    if [ -f "$BACKEND_DIR/package.json" ]; then
        cd "$BACKEND_DIR"
        if [ ! -d "node_modules" ]; then
            log "Installing backend dependencies..."
            npm install --production
        fi
    fi
    
    # Install frontend dependencies
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        cd "$FRONTEND_DIR"
        if [ ! -d "node_modules" ]; then
            log "Installing frontend dependencies..."
            npm install --production
        fi
    fi
}

# Function to build the application
build_application() {
    log "Building PharmaStock application..."
    
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
}

# Function to start backend service
start_backend() {
    log "Starting backend service on port $BACKEND_PORT..."
    
    cd "$BACKEND_DIR"
    
    # Check if backend is already running
    if [ -f "$PID_DIR/backend.pid" ]; then
        PID=$(cat "$PID_DIR/backend.pid")
        if ps -p "$PID" > /dev/null 2>&1; then
            log "Backend is already running with PID $PID"
            return 0
        else
            rm -f "$PID_DIR/backend.pid"
        fi
    fi
    
    # Set environment variables
    export PORT=$BACKEND_PORT
    export NODE_ENV=production
    
    # Start backend in background
    nohup npm start > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$PID_DIR/backend.pid"
    
    # Wait a moment and check if it started successfully
    sleep 3
    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        log "Backend started successfully with PID $BACKEND_PID on port $BACKEND_PORT"
    else
        log "ERROR: Failed to start backend service"
        exit 1
    fi
}

# Function to start frontend service
start_frontend() {
    log "Starting frontend service on port $FRONTEND_PORT..."
    
    cd "$FRONTEND_DIR"
    
    # Check if frontend is already running
    if [ -f "$PID_DIR/frontend.pid" ]; then
        PID=$(cat "$PID_DIR/frontend.pid")
        if ps -p "$PID" > /dev/null 2>&1; then
            log "Frontend is already running with PID $PID"
            return 0
        else
            rm -f "$PID_DIR/frontend.pid"
        fi
    fi
    
    # Start frontend in background using preview mode
    nohup npm run preview -- --port $FRONTEND_PORT --host 0.0.0.0 > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"
    
    # Wait a moment and check if it started successfully
    sleep 3
    if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
        log "Frontend started successfully with PID $FRONTEND_PID on port $FRONTEND_PORT"
    else
        log "ERROR: Failed to start frontend service"
        exit 1
    fi
}

# Function to check service health
check_services() {
    log "Checking service health..."
    
    # Check backend
    if [ -f "$PID_DIR/backend.pid" ]; then
        BACKEND_PID=$(cat "$PID_DIR/backend.pid")
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            log "Backend service is running (PID: $BACKEND_PID, Port: $BACKEND_PORT)"
        else
            log "WARNING: Backend service is not running"
        fi
    fi
    
    # Check frontend
    if [ -f "$PID_DIR/frontend.pid" ]; then
        FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
        if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
            log "Frontend service is running (PID: $FRONTEND_PID, Port: $FRONTEND_PORT)"
        else
            log "WARNING: Frontend service is not running"
        fi
    fi
    
    # Check nginx
    if systemctl is-active --quiet nginx; then
        log "Nginx is running"
    else
        log "WARNING: Nginx is not running"
    fi
}

# Function to stop services
stop_services() {
    log "Stopping PharmaStock services..."
    
    # Stop backend
    if [ -f "$PID_DIR/backend.pid" ]; then
        BACKEND_PID=$(cat "$PID_DIR/backend.pid")
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            log "Stopping backend service (PID: $BACKEND_PID)"
            kill "$BACKEND_PID"
            rm -f "$PID_DIR/backend.pid"
        fi
    fi
    
    # Stop frontend
    if [ -f "$PID_DIR/frontend.pid" ]; then
        FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
        if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
            log "Stopping frontend service (PID: $FRONTEND_PID)"
            kill "$FRONTEND_PID"
            rm -f "$PID_DIR/frontend.pid"
        fi
    fi
    
    log "All services stopped"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 {start|stop|restart|status|build}"
    echo "  start   - Start PharmaStock services"
    echo "  stop    - Stop PharmaStock services"
    echo "  restart - Restart PharmaStock services"
    echo "  status  - Show service status"
    echo "  build   - Build the application"
}

# Main execution
main() {
    case "${1:-start}" in
        start)
            log "=== Starting PharmaStock Application ==="
            check_root
            create_directories
            check_nodejs
            install_dependencies
            build_application
            start_backend
            start_frontend
            check_services
            log "=== PharmaStock Application Started Successfully ==="
            log "Access your application at: http://new-sight.local/pharmacy/"
            ;;
        stop)
            log "=== Stopping PharmaStock Application ==="
            stop_services
            log "=== PharmaStock Application Stopped ==="
            ;;
        restart)
            log "=== Restarting PharmaStock Application ==="
            stop_services
            sleep 2
            main start
            ;;
        status)
            check_services
            ;;
        build)
            log "=== Building PharmaStock Application ==="
            check_root
            create_directories
            check_nodejs
            install_dependencies
            build_application
            log "=== Build Completed ==="
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
