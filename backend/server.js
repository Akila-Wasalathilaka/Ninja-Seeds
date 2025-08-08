const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const CleanupManager = require('./utils/cleanup');

// Import routes
const authRoutes = require('./routes/auth');
const torrentRoutes = require('./routes/torrents');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Enable CORS for all routes
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://129.154.253.68', 'https://129.154.253.68'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Request logging
app.use(morgan('combined'));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (for serving downloads)
app.use('/downloads', express.static('/mnt/ninjaseeds', {
  maxAge: '1d',
  etag: true
}));

// API Routes
app.use('/api', authRoutes);
app.use('/api/torrents', torrentRoutes);
app.use('/api', statsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large'
    });
  }
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server with auto-cleanup
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🥷 Ninja Seeds Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Server ready at http://0.0.0.0:${PORT}`);
  
  // Initialize cleanup manager
  const cleanup = new CleanupManager();
  
  // Run cleanup every 30 minutes
  setInterval(() => {
    cleanup.fullCleanup().catch(err => console.error('Scheduled cleanup failed:', err));
  }, 30 * 60 * 1000);
  
  // Initial cleanup on startup
  setTimeout(() => {
    cleanup.fullCleanup().catch(err => console.error('Initial cleanup failed:', err));
  }, 5000);
});

module.exports = app;
