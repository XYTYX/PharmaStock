#!/bin/bash

# init-database.sh
# Database initialization script for PharmaStock
# Handles both development and production database setup

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
ENVIRONMENT="${1:-development}"

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
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

# Function to setup production database directory
setup_production_directory() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Setting up production database directory..."
        
        # Create USB mount point if it doesn't exist
        mkdir -p /mnt/usb
        
        # Check if USB is already mounted
        if ! mountpoint -q /mnt/usb; then
            log "WARNING: USB drive not mounted at /mnt/usb"
            log "Please ensure USB drive is connected and mounted before running in production mode"
            log "You can mount it manually with: sudo mount /dev/sdX1 /mnt/usb"
        fi
        
        # Create pharmastock directory
        mkdir -p /mnt/usb/pharmastock
        log "Production database directory ready: /mnt/usb/pharmastock"
    fi
}

# Function to initialize database
init_database() {
    log "Initializing database for $ENVIRONMENT environment..."
    log "Database URL: $DATABASE_URL"
    
    cd "$BACKEND_DIR"
    
    # Generate Prisma client
    log "Generating Prisma client..."
    npm run db:generate
    
    # Push database schema
    log "Pushing database schema..."
    npm run db:push
    
    # Seed database if it's empty
    log "Seeding database..."
    npm run db:seed
    
    log "Database initialization complete!"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environments:"
    echo "  development  - Development mode (default)"
    echo "  production   - Production mode"
    echo ""
    echo "Examples:"
    echo "  $0                    # Initialize development database"
    echo "  $0 development        # Initialize development database"
    echo "  $0 production         # Initialize production database"
    echo ""
    echo "Note: For production mode, ensure USB drive is connected and mounted at /mnt/usb"
}

# Main execution
main() {
    case "$1" in
        -h|--help|help)
            show_usage
            exit 0
            ;;
        *)
            log "=== Database Initialization ($ENVIRONMENT) ==="
            load_environment_config
            setup_production_directory
            init_database
            log "=== Database Initialization Complete ==="
            ;;
    esac
}

# Run main function with all arguments
main "$@"
