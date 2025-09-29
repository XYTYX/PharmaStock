# USB Drive Deployment for PharmaStock

This document explains how to deploy PharmaStock on a Raspberry Pi using a USB drive for source code storage and database persistence.

## Overview

The deployment uses a hybrid approach:
- **Source code**: Stored on USB drive (`/mnt/thumbdrive/pharmastock-source/`)
- **Running application**: Copied to home directory (`/home/$USER/pharmastock/`)
- **Database**: Stored on USB drive (`/mnt/thumbdrive/pharmastock/pharmastock.db`)

## Benefits

- ✅ **Easy updates**: Source code on USB drive can be updated from any computer
- ✅ **Performance**: Application runs from fast SD card storage
- ✅ **Data safety**: Database and source code are on removable USB drive
- ✅ **Backup portability**: Easy to backup by removing USB drive
- ✅ **System reliability**: Core system remains on SD card

## Setup Process

### 1. Initial Raspberry Pi Setup

On your Raspberry Pi, run the setup script:

```bash
sudo ./setup-raspberry-pi.sh
```

This will:
- Mount your USB drive at `/mnt/thumbdrive`
- Create directories for source code and database
- Install system optimizations
- Set up automatic mounting

### 2. Copy Source Code to USB Drive

From your development machine, copy the source code to the USB drive:

```bash
./copy-to-usb.sh
```

This will:
- Copy all source files to `/mnt/thumbdrive/pharmastock-source/`
- Exclude unnecessary files (node_modules, logs, etc.)
- Set proper permissions

### 3. Deploy on Raspberry Pi

On your Raspberry Pi, copy and run the application:

```bash
./copy-and-run.sh
```

This will:
- Copy source code from USB drive to home directory
- Install dependencies
- Set up database
- Create systemd service
- Start the application

## Update Process

### Method 1: Update from Development Machine

1. Make your changes to the source code
2. Run `./copy-to-usb.sh` to copy updated code to USB drive
3. On Raspberry Pi, run `./copy-and-run.sh --update`

### Method 2: Direct Update on Raspberry Pi

1. Edit files directly in `/mnt/thumbdrive/pharmastock-source/`
2. Run `./copy-and-run.sh --update`

## File Structure

```
/mnt/thumbdrive/
├── pharmastock-source/          # Source code (from USB drive)
│   ├── backend/
│   ├── frontend/
│   └── ...
└── pharmastock/                 # Database directory
    └── pharmastock.db

/home/$USER/pharmastock/         # Running application (on SD card)
├── backend/
├── frontend/
└── ...
```

## Scripts

- `setup-raspberry-pi.sh`: Initial Pi setup and USB drive configuration
- `copy-to-usb.sh`: Copy source code from development machine to USB drive
- `copy-and-run.sh`: Copy from USB drive to Pi and run application
- `deploy-from-github.sh`: Quick deploy from GitHub (downloads and runs scripts)

## Troubleshooting

### USB Drive Not Mounted
```bash
sudo ./setup-raspberry-pi.sh
```

### Service Not Starting
```bash
sudo systemctl status pharmastock.service
sudo journalctl -u pharmastock.service -f
```

### Update Application
```bash
./copy-and-run.sh --update
```

### Check USB Drive Space
```bash
df -h /mnt/thumbdrive
```

## Notes

- The USB drive must be labeled `PHARMASTOCK_DB` for automatic mounting
- Source code is automatically excluded from git (node_modules, logs, etc.)
- Database is automatically backed up before updates
- System optimizations reduce SD card wear
