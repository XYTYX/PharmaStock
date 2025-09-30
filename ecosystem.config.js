const path = require('path');

module.exports = {
  apps: [
    {
      name: 'pharmastock-backend',
      script: path.join(__dirname, 'backend/dist/index.js'),
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: 'file:/home/aidan/new_sight/PharmaStock/backend/prisma/dev.db',
        FRONTEND_URL: 'http://localhost:3001',
        JWT_SECRET: 'your-super-secret-jwt-key-change-this-in-production'
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
      cwd: path.join(__dirname, 'frontend'),
      env: {
        NODE_ENV: 'development'
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
