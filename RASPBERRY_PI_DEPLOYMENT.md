# Raspberry Pi Deployment Guide for PharmaStock

This guide will help you deploy your PharmaStock application on a Raspberry Pi with the database stored on a thumbdrive. The deployment can be done entirely over the network by downloading from GitHub.

## Prerequisites

- Raspberry Pi (any model with at least 1GB RAM)
- USB thumbdrive (8GB or larger recommended)
- MicroSD card with Raspberry Pi OS
- Network connection
- GitHub account (for hosting the repository)

## Step 1: Prepare Your Thumbdrive

1. **Format the thumbdrive** with a specific label:
   ```bash
   sudo mkfs.ext4 -L PHARMASTOCK_DB /dev/sdX
   ```
   Replace `/dev/sdX` with your actual thumbdrive device (check with `lsblk`)

2. **Important**: If your thumbdrive also contains the Raspberry Pi boot folder, the setup script will automatically detect this and create a separate `pharmastock` directory for the database to avoid conflicts.

3. **Mount the thumbdrive** temporarily to verify:
   ```bash
   sudo mkdir -p /mnt/thumbdrive
   sudo mount /dev/sdX /mnt/thumbdrive
   ```

## Step 2: Prepare GitHub Repository

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit for Raspberry Pi deployment"
   git push origin main
   ```

2. **Update repository configuration**:
   Edit `github-config.sh` with your GitHub repository details:
   ```bash
   GITHUB_REPO="your-username/pharmastock-pro"
   GITHUB_BRANCH="main"
   ```

## Step 3: Deploy on Raspberry Pi

### Option A: Quick Deploy (Recommended)

Run this single command on your Raspberry Pi:

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/pharmastock-pro/main/deploy-from-github.sh | bash
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Option B: Manual Deploy

SSH into your Raspberry Pi and run:

1. **Download and setup**:
   ```bash
   curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/pharmastock-pro/main/setup-raspberry-pi.sh | sudo bash
   ```

2. **Deploy the application**:
   ```bash
   curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/pharmastock-pro/main/deploy-to-pi.sh | bash
   ```

## Step 4: Configure Environment

The deployment script automatically creates the environment file with the correct database path. You only need to:

1. **Set your JWT secret**:
   ```bash
   nano /home/pi/pharmastock-pro/backend/.env
   ```
   
   Generate a secure JWT secret:
   ```bash
   openssl rand -base64 32
   ```

2. **Important settings**:
   - `JWT_SECRET`: Your generated secret key
   - `DATABASE_URL`: Automatically set based on thumbdrive structure
   - `PORT`: Default is 3001
   - `FRONTEND_URL`: Set to your Pi's IP address if needed

## Step 5: Access Your Application

- **Backend API**: `http://your-pi-ip:3001`
- **Health Check**: `http://your-pi-ip:3001/health`

## GitHub Repository Setup

Before deploying, make sure to:

1. **Create a public GitHub repository**
2. **Update the repository configuration** in your local `github-config.sh`:
   ```bash
   GITHUB_REPO="your-username/pharmastock-pro"
   GITHUB_BRANCH="main"
   ```
3. **Push your code to GitHub**:
   ```bash
   git remote add origin https://github.com/your-username/pharmastock-pro.git
   git push -u origin main
   ```

## Management Commands

### Service Management
```bash
# Check service status
sudo systemctl status pharmastock.service

# Start/stop/restart service
sudo systemctl start pharmastock.service
sudo systemctl stop pharmastock.service
sudo systemctl restart pharmastock.service

# View logs
sudo journalctl -u pharmastock.service -f

# Check log2ram status
sudo systemctl status log2ram

# Manual system optimization
sudo /usr/local/bin/optimize-pi.sh
```

### Database Management
```bash
cd backend

# Reset database
npx prisma db push --force-reset

# Seed database
npx prisma db seed

# View database in Prisma Studio
npx prisma studio
```

## Troubleshooting

### Service Won't Start
1. Check logs: `sudo journalctl -u pharmastock.service -f`
2. Verify thumbdrive is mounted: `mount | grep thumbdrive`
3. Check file permissions: `ls -la /mnt/thumbdrive/`

### Database Issues
1. Verify database path in `.env` file
2. Check thumbdrive permissions: `ls -la /mnt/thumbdrive/`
3. Ensure thumbdrive is mounted: `df -h | grep thumbdrive`

### Network Issues
1. Check if port 3001 is open: `sudo netstat -tlnp | grep 3001`
2. Verify firewall settings: `sudo ufw status`
3. Test local connection: `curl http://localhost:3001/health`

## Security Considerations

1. **Change default passwords** and JWT secrets
2. **Enable firewall**:
   ```bash
   sudo ufw enable
   sudo ufw allow 3001
   ```
3. **Use HTTPS** in production (consider using nginx as reverse proxy)
4. **Regular backups** of the thumbdrive database

## Backup and Recovery

### Backup Database
```bash
cp /mnt/thumbdrive/pharmastock.db /home/pi/backup-$(date +%Y%m%d).db
```

### Restore Database
```bash
cp /home/pi/backup-YYYYMMDD.db /mnt/thumbdrive/pharmastock.db
sudo systemctl restart pharmastock.service
```

## Performance Optimization

The setup script automatically configures several optimizations:

1. **log2ram**: Installed and configured to keep logs in RAM, reducing SD card writes
2. **Swap disabled**: Reduces SD card wear
3. **tmpfs for temporary files**: `/tmp` and `/var/tmp` are mounted in RAM
4. **SQLite optimizations**: WAL mode, reduced sync, increased cache
5. **Weekly cleanup**: Automatic system optimization runs every Sunday at 2 AM

### Manual Optimizations

1. **Enable swap** if needed (not recommended for SD card longevity):
   ```bash
   sudo dphys-swapfile swapoff
   sudo nano /etc/dphys-swapfile
   # Set CONF_SWAPSIZE=1024
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

2. **Optimize SQLite** by adding these to your `.env`:
   ```
   DATABASE_URL="file:/mnt/thumbdrive/pharmastock.db?journal_mode=WAL&synchronous=NORMAL&cache_size=10000"
   ```

3. **Check log2ram status**:
   ```bash
   sudo systemctl status log2ram
   ```

## Updates

### Automatic Updates

To update your application:

1. **Push changes to GitHub**:
   ```bash
   git add .
   git commit -m "Update description"
   git push origin main
   ```

2. **Deploy on Raspberry Pi**:
   ```bash
   # Quick update
   curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/pharmastock-pro/main/deploy-from-github.sh | bash
   
   # Or if already deployed
   cd /home/pi/pharmastock-pro
   ./deploy-to-pi.sh
   ```

The service will automatically restart with the new version, and the previous version will be backed up.

### Manual Updates

If you prefer manual updates:

1. SSH into your Raspberry Pi
2. Navigate to the installation directory
3. Run the deployment script:
   ```bash
   cd /home/pi/pharmastock-pro
   ./deploy-to-pi.sh
   ```
