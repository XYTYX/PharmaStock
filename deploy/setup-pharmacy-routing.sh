#!/bin/bash

# setup-pharmacy-routing.sh
# Idempotent script to set up new-sight.local/pharmacy routing
# This script can be run multiple times safely

set -e  # Exit on any error

# Configuration
NGINX_SITE_FILE="/etc/nginx/sites-available/pharmastock"
NGINX_ENABLED_FILE="/etc/nginx/sites-enabled/pharmastock"
NGINX_DEFAULT_FILE="/etc/nginx/sites-enabled/default"
HOSTS_FILE="/etc/hosts"
APP_DIR="/opt/pharmastock"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT=3001
BACKEND_PORT=3000

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

# Function to install nginx if not present
install_nginx() {
    log "Checking if Nginx is installed..."
    
    if command -v nginx &> /dev/null; then
        log "Nginx is already installed: $(nginx -v 2>&1)"
    else
        log "Installing Nginx..."
        apt update
        apt install nginx -y
        log "Nginx installed successfully"
    fi
}

# Function to create nginx configuration
create_nginx_config() {
    log "Creating Nginx configuration..."
    
    # Create the site configuration
    cat > "$NGINX_SITE_FILE" << 'EOF'
server {
    listen 80;
    server_name new-sight.local;

    # Frontend - serve the built React app
    location /pharmacy/ {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Handle client-side routing
        try_files $uri $uri/ @pharmacy;
    }

    # Backend API
    location /pharmacy/api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fallback for client-side routing
    location @pharmacy {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Root redirect to pharmacy
    location / {
        return 301 /pharmacy/;
    }
}
EOF

    log "Nginx configuration created at $NGINX_SITE_FILE"
}

# Function to enable nginx site
enable_nginx_site() {
    log "Enabling Nginx site..."
    
    # Remove default site if it exists
    if [ -L "$NGINX_DEFAULT_FILE" ]; then
        log "Removing default Nginx site..."
        rm -f "$NGINX_DEFAULT_FILE"
    fi
    
    # Enable pharmastock site
    if [ ! -L "$NGINX_ENABLED_FILE" ]; then
        log "Enabling pharmastock site..."
        ln -s "$NGINX_SITE_FILE" "$NGINX_ENABLED_FILE"
    else
        log "Pharmastock site is already enabled"
    fi
}

# Function to test nginx configuration
test_nginx_config() {
    log "Testing Nginx configuration..."
    
    if nginx -t; then
        log "Nginx configuration test passed"
    else
        log "ERROR: Nginx configuration test failed"
        exit 1
    fi
}

# Function to configure hosts file
configure_hosts() {
    log "Configuring hosts file..."
    
    # Check if new-sight.local is already in hosts file
    if grep -q "new-sight.local" "$HOSTS_FILE"; then
        log "new-sight.local already configured in hosts file"
    else
        log "Adding new-sight.local to hosts file..."
        echo "127.0.0.1 new-sight.local" >> "$HOSTS_FILE"
        log "Hosts file updated"
    fi
}

# Function to update frontend configuration
update_frontend_config() {
    log "Updating frontend Vite configuration..."
    
    local frontend_config="$APP_DIR/frontend/vite.config.ts"
    
    if [ ! -f "$frontend_config" ]; then
        log "WARNING: Frontend config not found at $frontend_config"
        return
    fi
    
    # Backup original config
    cp "$frontend_config" "${frontend_config}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Update the config
    cat > "$frontend_config" << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/pharmacy/',
  server: {
    port: 3001,
    host: '0.0.0.0'
  },
  preview: {
    port: 3001,
    host: '0.0.0.0'
  }
})
EOF

    log "Frontend configuration updated"
}

# Function to update backend configuration
update_backend_config() {
    log "Updating backend configuration..."
    
    local backend_index="$APP_DIR/backend/src/index.ts"
    
    if [ ! -f "$backend_index" ]; then
        log "WARNING: Backend index not found at $backend_index"
        return
    fi
    
    # Check if pharmacy prefix handling is already added
    if grep -q "pharmacy.*prefix" "$backend_index"; then
        log "Backend already configured for pharmacy prefix"
        return
    fi
    
    # Backup original file
    cp "$backend_index" "${backend_index}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Add pharmacy prefix handling after express app creation
    sed -i '/const app = express();/a\\n// Handle /pharmacy prefix\napp.use(\"/pharmacy\", (req, res, next) => {\n  // Remove /pharmacy prefix from the request\n  req.url = req.url.replace(\"/pharmacy\", \"\");\n  next();\n});' "$backend_index"
    
    log "Backend configuration updated"
}

# Function to update startup script
update_startup_script() {
    log "Updating startup script..."
    
    local startup_script="$APP_DIR/pharmastock-run.sh"
    
    if [ ! -f "$startup_script" ]; then
        log "WARNING: Startup script not found at $startup_script"
        return
    fi
    
    # Update frontend port in startup script
    sed -i "s/npm run preview/npm run preview -- --port $FRONTEND_PORT/g" "$startup_script"
    
    log "Startup script updated"
}

# Function to update systemd service
update_systemd_service() {
    log "Updating systemd service..."
    
    local service_file="/etc/systemd/system/pharmastock.service"
    
    if [ ! -f "$service_file" ]; then
        log "WARNING: Systemd service not found at $service_file"
        return
    fi
    
    # Add nginx dependency
    if ! grep -q "After=.*nginx" "$service_file"; then
        sed -i '/After=network.target/a\After=nginx.service' "$service_file"
        sed -i '/Wants=network-online.target/a\Wants=nginx.service' "$service_file"
    fi
    
    log "Systemd service updated"
}

# Function to restart services
restart_services() {
    log "Restarting services..."
    
    # Restart nginx
    if systemctl is-active --quiet nginx; then
        log "Restarting Nginx..."
        systemctl restart nginx
    else
        log "Starting Nginx..."
        systemctl start nginx
    fi
    
    # Enable nginx to start on boot
    systemctl enable nginx
    
    # Restart pharmastock service if it exists
    if systemctl list-unit-files | grep -q "pharmastock.service"; then
        if systemctl is-active --quiet pharmastock; then
            log "Restarting PharmaStock service..."
            systemctl restart pharmastock
        else
            log "Starting PharmaStock service..."
            systemctl start pharmastock
        fi
    fi
    
    log "Services restarted"
}

# Function to verify setup
verify_setup() {
    log "Verifying setup..."
    
    # Check nginx status
    if systemctl is-active --quiet nginx; then
        log "✓ Nginx is running"
    else
        log "✗ Nginx is not running"
    fi
    
    # Check nginx configuration
    if nginx -t &> /dev/null; then
        log "✓ Nginx configuration is valid"
    else
        log "✗ Nginx configuration is invalid"
    fi
    
    # Check if site is enabled
    if [ -L "$NGINX_ENABLED_FILE" ]; then
        log "✓ Pharmastock site is enabled"
    else
        log "✗ Pharmastock site is not enabled"
    fi
    
    # Check hosts file
    if grep -q "new-sight.local" "$HOSTS_FILE"; then
        log "✓ Hosts file configured"
    else
        log "✗ Hosts file not configured"
    fi
    
    log "Setup verification complete"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 {setup|verify|status}"
    echo "  setup   - Set up pharmacy routing (idempotent)"
    echo "  verify  - Verify the current setup"
    echo "  status  - Show service status"
}

# Function to show status
show_status() {
    log "=== Service Status ==="
    
    echo "Nginx status:"
    systemctl status nginx --no-pager -l || true
    
    echo ""
    echo "PharmaStock status:"
    if systemctl list-unit-files | grep -q "pharmastock.service"; then
        systemctl status pharmastock --no-pager -l || true
    else
        echo "PharmaStock service not found"
    fi
    
    echo ""
    echo "Nginx configuration test:"
    nginx -t || true
}

# Main execution
main() {
    case "${1:-setup}" in
        setup)
            log "=== Setting up Pharmacy Routing ==="
            check_root
            install_nginx
            create_nginx_config
            enable_nginx_site
            test_nginx_config
            configure_hosts
            update_frontend_config
            update_backend_config
            update_startup_script
            update_systemd_service
            restart_services
            verify_setup
            log "=== Pharmacy Routing Setup Complete ==="
            log "Your site should now be accessible at: http://new-sight.local/pharmacy/"
            ;;
        verify)
            log "=== Verifying Pharmacy Routing Setup ==="
            verify_setup
            ;;
        status)
            show_status
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
