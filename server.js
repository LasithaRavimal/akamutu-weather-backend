/**
 * server.js — Main entry point for Data Akamutu Weather Data Platform API
 * Configures Express, security middleware, routes, and starts the HTTP server.
 */

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Load environment variables
dotenv.config();
console.log("MONGO_URI:", process.env.MONGO_URI);
// Connect to MongoDB
const connectDB = require('./config/db');
connectDB();

const app = express();

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:3000','https://akamutu-weather-frontend.vercel.app'
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── HTTP Logger (dev only) ────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Rate Limiter ──────────────────────────────────────────────────────────────
const { globalLimiter } = require('./middleware/rateLimiter');
app.use('/api/', globalLimiter);

// ── Static uploads folder (not exposed for raw download) ─────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/weather', require('./routes/weatherRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Data Akamutu Weather API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global Error:', err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🌦  Data Akamutu Weather API`);
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
