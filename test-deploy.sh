#!/bin/bash

# test-deploy.sh
# Simple test deployment script that serves a Hello World HTML page
# This is for testing the deployment procedure without affecting the main app

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_PORT=3001
ENVIRONMENT="${1:-development}"

# PID file
TEST_PID_FILE="$SCRIPT_DIR/test-server.pid"
TEST_LOG="$SCRIPT_DIR/test-server.log"

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

# Function to start test server
start_test_server() {
    log "Starting test server on port $TEST_PORT..."
    
    # Create a simple HTTP server using Node.js
    cat > "$SCRIPT_DIR/test-server.js" << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const ENV = process.env.NODE_ENV || 'development';

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Serve the test HTML file
    if (req.url === '/' || req.url === '/test.html') {
        const filePath = path.join(__dirname, 'test.html');
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading test page');
                return;
            }
            
            // Replace environment placeholder
            const html = data.replace('Loading...', ENV);
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        });
    } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'OK', 
            environment: ENV,
            timestamp: new Date().toISOString(),
            port: PORT
        }));
    } else if (req.url === '/api/test') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            message: 'Hello from PharmaStock test API!',
            environment: ENV,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Test server running on port ${PORT}`);
    console.log(`📊 Environment: ${ENV}`);
    console.log(`🌐 Access: http://localhost:${PORT}`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log(`🔧 API: http://localhost:${PORT}/api/test`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});
EOF

    # Start the test server
    cd "$SCRIPT_DIR"
    export PORT=$TEST_PORT
    export NODE_ENV=$ENVIRONMENT
    
    nohup node test-server.js > "$TEST_LOG" 2>&1 &
    TEST_PID=$!
    echo "$TEST_PID" > "$TEST_PID_FILE"
    
    # Wait a moment and check if it started
    sleep 2
    if ps -p "$TEST_PID" > /dev/null 2>&1; then
        log "Test server started with PID $TEST_PID"
    else
        log "ERROR: Failed to start test server"
        exit 1
    fi
}

# Function to stop test server
stop_test_server() {
    log "Stopping test server..."
    
    if [ -f "$TEST_PID_FILE" ]; then
        TEST_PID=$(cat "$TEST_PID_FILE")
        if ps -p "$TEST_PID" > /dev/null 2>&1; then
            log "Stopping test server (PID: $TEST_PID)"
            kill "$TEST_PID"
        fi
        rm -f "$TEST_PID_FILE"
    fi
    
    # Clean up the test server file
    rm -f "$SCRIPT_DIR/test-server.js"
    
    log "Test server stopped"
}

# Function to show status
show_status() {
    log "=== Test Server Status ($ENVIRONMENT) ==="
    
    if [ -f "$TEST_PID_FILE" ]; then
        TEST_PID=$(cat "$TEST_PID_FILE")
        if ps -p "$TEST_PID" > /dev/null 2>&1; then
            log "Test server is running (PID: $TEST_PID, Port: $TEST_PORT)"
            log "Access: http://localhost:$TEST_PORT"
            log "Health: http://localhost:$TEST_PORT/health"
            log "API: http://localhost:$TEST_PORT/api/test"
        else
            log "Test server is not running"
        fi
    else
        log "Test server is not running"
    fi
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
    echo "  setup        - Complete setup and start test server (idempotent)"
    echo "  start        - Start test server"
    echo "  stop         - Stop test server"
    echo "  restart      - Restart test server"
    echo "  status       - Show status"
    echo "  cleanup      - Stop and clean up"
    echo ""
    echo "Examples:"
    echo "  $0 development setup         # Development mode, complete setup"
    echo "  sudo $0 production setup     # Production mode, complete setup"
    echo "  $0 development start         # Development mode, start"
    echo "  $0 production stop           # Production mode, stop"
}

# Main execution
main() {
    local command="${2:-start}"
    
    case "$command" in
        setup)
            log "=== Test Deployment Setup ($ENVIRONMENT) ==="
            check_root
            check_nodejs
            install_system_dependencies
            start_test_server
            log "=== Test Setup Complete ==="
            log "Test server: http://localhost:$TEST_PORT"
            log "Health check: http://localhost:$TEST_PORT/health"
            log "API test: http://localhost:$TEST_PORT/api/test"
            log "Use '$0 $ENVIRONMENT stop' to stop the test server"
            ;;
        start)
            log "=== Starting Test Server ($ENVIRONMENT) ==="
            check_root
            check_nodejs
            install_system_dependencies
            start_test_server
            log "=== Test Server Started ==="
            log "Test server: http://localhost:$TEST_PORT"
            log "Health check: http://localhost:$TEST_PORT/health"
            ;;
        stop)
            log "=== Stopping Test Server ==="
            stop_test_server
            log "=== Test Server Stopped ==="
            ;;
        restart)
            log "=== Restarting Test Server ==="
            stop_test_server
            sleep 2
            main "$@"
            ;;
        status)
            show_status
            ;;
        cleanup)
            log "=== Cleaning up Test Server ==="
            stop_test_server
            rm -f "$TEST_LOG"
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
