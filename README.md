# Hospital Pharmacy Management System

A comprehensive hospital pharmacy inventory management system built with React and Node.js.

## Features

- **Inventory Management**: Track medications, supplies, and equipment
- **Medicine Type Tracking**: Categorize medicines by type (tablet, gel capsule, gel liquid)
- **Expiration Tracking**: Monitor medication expiration dates
- **Supplier Management**: Manage vendor relationships and contacts
- **Dispensations**: Record and track medicine dispensations to patients
- **User Management**: Role-based access control with username authentication
- **Reporting**: Comprehensive analytics and reports
- **Barcode Support**: Scan and track items by barcode
- **Multilingual Support**: English and French language support

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT tokens
- **State Management**: React Query, Zustand

## Quick Start

1. Install dependencies:
   ```bash
   npm run setup
   ```

2. Start development servers:
   ```bash
   npm run dev
   ```

3. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Project Structure

```
pharmastock-pro/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Custom middleware
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utility functions
│   ├── prisma/              # Database schema and migrations
│   └── package.json
├── frontend/                # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API services
│   │   ├── store/           # State management
│   │   └── types/           # TypeScript type definitions
│   └── package.json
└── package.json             # Root package.json
```

## Default Login

- **Admin**: admin / admin123
- **Pharmacist**: pharmacist / pharmacist123
- **Technician**: tech / tech123
