import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './routes/auth';
import inventoryRoutes from './routes/inventory';
import userRoutes from './routes/users';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;


// Initialize Prisma client
export const prisma = new PrismaClient();
console.log('Prisma client initialized with database URL:', process.env.DATABASE_URL);
console.log('Current working directory:', process.cwd());

// Test Prisma connection to the database
prisma.$connect()
  .then(() => {
    console.log('✅ Successfully connected to the database.');
  })
  .catch((err) => {
    console.error('❌ Failed to connect to the database:', err);
    process.exit(1);
  });


// Middleware
app.use(helmet());
// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'http://new-sight.local', 'http://new-sight.local', 'https://new-sight.local']
    : ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

console.log('CORS Configuration:', corsOptions);

// Debug CORS middleware - MUST be before cors() middleware
// app.use((req, res, next) => {
//   if (req.method === 'OPTIONS') {
//     console.log('🔍 CORS Preflight Request Detected:');
//     console.log('  Origin:', req.headers.origin);
//     console.log('  Request Method:', req.headers['access-control-request-method']);
//     console.log('  Request Headers:', req.headers['access-control-request-headers']);
//     console.log('  Allowed Origins:', corsOptions.origin);
//     console.log('  Origin Allowed:', corsOptions.origin.includes(req.headers.origin || ''));
//   }
//   next();
// });

app.use(cors(corsOptions));

// Debug middleware to log ALL requests
// app.use((req, res, next) => {
//   console.log(`📥 Incoming request: ${req.method} ${req.url}`);
//   console.log('  Origin:', req.headers.origin);
//   console.log('  User-Agent:', req.headers['user-agent']);
//   console.log('  Headers:', JSON.stringify(req.headers, null, 2));
//   next();
// });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// CORS test endpoint
app.options('/test-cors', (req, res) => {
  console.log('🧪 CORS Test Endpoint Hit');
  console.log('Request Origin:', req.headers.origin);
  res.status(200).json({ message: 'CORS test successful' });
});

app.post('/test-cors', (req, res) => {
  res.json({ 
    message: 'POST request successful',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/inventory', authenticateToken, inventoryRoutes);
app.use('/users', authenticateToken, userRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
