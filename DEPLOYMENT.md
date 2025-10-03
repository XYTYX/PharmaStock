# PharmaStock Deployment Guide

This guide explains how to deploy your PharmaStock application to be accessible via `new-sight.local` domain.

## Architecture Overview

```
Internet → new-sight.local:80 → nginx → {
  / → localhost:3001 (Frontend)
  /api/* → localhost:3000 (Backend API)
}
```

## Prerequisites

1. **Nginx** installed and running
2. **PM2** installed globally (`npm install -g pm2`)
3. **Node.js** and **npm** installed
4. Domain `new-sight.local` configured in your hosts file

## Setup Steps

### 1. Configure Hosts File

Add the domain to your hosts file:

```bash
echo '127.0.0.1 new-sight.local' | sudo tee -a /etc/hosts
```

### 2. Install Dependencies

```bash
# Install nginx (if not already installed)
sudo apt update && sudo apt install nginx

# Install PM2 globally (if not already installed)
npm install -g pm2
```

### 3. Deploy Application

Run the deployment script:

```bash
./deploy.sh
```

This script will:
- Copy nginx configuration to `/etc/nginx/sites-available/pharmastock`
- Enable the site and disable default nginx site
- Test nginx configuration
- Build the frontend for production
- Start applications with PM2 in production mode
- Set up PM2 to start on boot

## Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Configure Nginx

```bash
# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/pharmastock

# Enable the site
sudo ln -sf /etc/nginx/sites-available/pharmastock /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 2. Build and Start Applications

```bash
# Build frontend
cd frontend
npm run build
cd ..

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Configuration Details

### Nginx Configuration

The nginx configuration (`nginx.conf`) sets up:

- **Frontend**: Serves React app on root path (`/`)
- **API**: Proxies `/api/*` requests to backend on port 3000
- **CORS**: Handles cross-origin requests properly
- **Client-side routing**: Supports React Router with fallback

### Environment Variables

#### Frontend (`frontend/src/services/api.ts`)
- **Development**: `http://localhost:3000`
- **Production**: `http://new-sight.local/api`

#### Backend (`ecosystem.config.js`)
- **Development**: `FRONTEND_URL: 'http://localhost:3001'`
- **Production**: `FRONTEND_URL: 'http://new-sight.local'`

### CORS Configuration

The backend is configured to accept requests from:
- **Development**: `http://localhost:3001`, `http://127.0.0.1:3001`
- **Production**: `http://new-sight.local`

## Access Points

After deployment, your application will be available at:

- **Main Application**: http://new-sight.local
- **API Endpoints**: http://new-sight.local/api/*
- **Health Check**: http://new-sight.local/health

## Management Commands

### PM2 Commands
```bash
pm2 status                    # Check application status
pm2 logs                      # View logs
pm2 restart all              # Restart all applications
pm2 stop all                 # Stop all applications
pm2 delete all               # Delete all applications
```

### Nginx Commands
```bash
sudo systemctl status nginx  # Check nginx status
sudo nginx -t                 # Test nginx configuration
sudo systemctl reload nginx   # Reload nginx configuration
sudo systemctl restart nginx  # Restart nginx
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check if backend is running: `pm2 status`
   - Check backend logs: `pm2 logs pharmastock-backend`

2. **CORS Errors**
   - Verify nginx CORS headers in configuration
   - Check backend CORS configuration in `backend/src/index.ts`

3. **Frontend Not Loading**
   - Check if frontend is running: `pm2 status`
   - Check frontend logs: `pm2 logs pharmastock-frontend`

4. **Domain Not Resolving**
   - Verify hosts file: `cat /etc/hosts | grep new-sight.local`
   - Add domain if missing: `echo '127.0.0.1 new-sight.local' | sudo tee -a /etc/hosts`

### Log Locations

- **PM2 Logs**: `~/.pm2/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **Application Logs**: `/var/log/pharmastock/` (production)

## Security Considerations

1. **HTTPS**: Consider setting up SSL certificates for production
2. **Firewall**: Ensure only necessary ports are open
3. **Authentication**: Verify JWT secret is properly configured
4. **Database**: Ensure database file permissions are secure

## Updates

To update your application:

1. Pull latest changes
2. Rebuild frontend: `cd frontend && npm run build`
3. Restart PM2: `pm2 restart all`

The nginx configuration doesn't need to be updated unless you change the architecture.
