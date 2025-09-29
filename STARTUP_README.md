# PharmaStock Startup Scripts

This directory contains scripts to run PharmaStock as a system service that starts automatically on system boot.

## Files

- `pharmastock-run.sh` - Main script to start/stop/restart the PharmaStock application
- `pharmastock.service` - Systemd service configuration file
- `install-service.sh` - Installation script to set up the systemd service
- `pharmastock-pi-setup.sh` - Original Raspberry Pi setup script

## Quick Start

### 1. Install the Service

Run the installation script as root:

```bash
sudo ./install-service.sh
```

This will:
- Copy the application to `/opt/pharmastock`
- Install the systemd service
- Enable the service to start on boot
- Start the service immediately

### 2. Verify Installation

Check if the service is running:

```bash
sudo systemctl status pharmastock
```

View the application logs:

```bash
sudo journalctl -u pharmastock -f
```

Or view the application-specific logs:

```bash
tail -f /var/log/pharmastock/pharmastock.log
```

## Manual Service Management

### Using systemctl (Recommended)

```bash
# Start the service
sudo systemctl start pharmastock

# Stop the service
sudo systemctl stop pharmastock

# Restart the service
sudo systemctl restart pharmastock

# Check status
sudo systemctl status pharmastock

# View logs
sudo journalctl -u pharmastock -f

# Enable/disable auto-start on boot
sudo systemctl enable pharmastock
sudo systemctl disable pharmastock
```

### Using the Run Script Directly

```bash
# Start services
sudo /opt/pharmastock/pharmastock-run.sh start

# Stop services
sudo /opt/pharmastock/pharmastock-run.sh stop

# Restart services
sudo /opt/pharmastock/pharmastock-run.sh restart

# Check status
sudo /opt/pharmastock/pharmastock-run.sh status

# Build application
sudo /opt/pharmastock/pharmastock-run.sh build
```

## Service Details

### What the Service Does

The PharmaStock service runs both the backend and frontend components:

1. **Backend**: Node.js Express API server (runs on port 3000 by default)
2. **Frontend**: Built React application served via Vite preview server

### File Locations

- **Application**: `/opt/pharmastock/`
- **Service File**: `/etc/systemd/system/pharmastock.service`
- **Logs**: `/var/log/pharmastock/`
- **PID Files**: `/var/run/pharmastock/`

### Log Files

- `pharmastock.log` - Main application log
- `backend.log` - Backend service log
- `frontend.log` - Frontend service log

### Environment

The service runs with:
- **User**: root
- **Environment**: production
- **Working Directory**: `/opt/pharmastock`

## Troubleshooting

### Service Won't Start

1. Check the service status:
   ```bash
   sudo systemctl status pharmastock
   ```

2. Check the logs:
   ```bash
   sudo journalctl -u pharmastock -n 50
   ```

3. Check if Node.js is installed:
   ```bash
   node --version
   npm --version
   ```

4. Check if the application directory exists:
   ```bash
   ls -la /opt/pharmastock/
   ```

### Service Starts but Application Doesn't Work

1. Check the application logs:
   ```bash
   tail -f /var/log/pharmastock/pharmastock.log
   tail -f /var/log/pharmastock/backend.log
   tail -f /var/log/pharmastock/frontend.log
   ```

2. Check if ports are in use:
   ```bash
   sudo netstat -tlnp | grep :3000
   ```

3. Try rebuilding the application:
   ```bash
   sudo /opt/pharmastock/pharmastock-run.sh build
   sudo systemctl restart pharmastock
   ```

### Uninstalling the Service

To remove the systemd service (but keep the application files):

```bash
sudo ./install-service.sh uninstall
```

To completely remove everything:

```bash
sudo ./install-service.sh uninstall
sudo rm -rf /opt/pharmastock
sudo rm -rf /var/log/pharmastock
```

## Configuration

### Changing the Port

To change the backend port, edit the service file:

```bash
sudo nano /etc/systemd/system/pharmastock.service
```

Add or modify the Environment line:
```
Environment=PORT=8080
```

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart pharmastock
```

### Adding Environment Variables

Add environment variables to the service file in the `[Service]` section:

```
Environment=PORT=3000
Environment=NODE_ENV=production
Environment=DATABASE_URL=your_database_url
```

## Security Notes

- The service runs as root for simplicity
- Consider creating a dedicated user for production use
- The service has some security restrictions enabled (NoNewPrivileges, PrivateTmp, etc.)
- Logs are rotated daily and kept for 7 days

## Development vs Production

This setup is designed for production use. For development:

1. Use the original `pharmastock-pi-setup.sh` script
2. Or run manually with `npm run dev` in each directory
3. The systemd service builds the application before starting
