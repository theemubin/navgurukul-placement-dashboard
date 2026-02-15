require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const skillRoutes = require('./routes/skills');
const notificationRoutes = require('./routes/notifications');
const statsRoutes = require('./routes/stats');
const settingsRoutes = require('./routes/settings');
const placementCycleRoutes = require('./routes/placementCycles');
const campusRoutes = require('./routes/campuses');
const selfApplicationRoutes = require('./routes/selfApplications');
const jobReadinessRoutes = require('./routes/jobReadiness');
const bulkUploadRoutes = require('./routes/bulkUpload');
const utilsRoutes = require('./routes/utils');
const questionRoutes = require('./routes/questions');
const discordRoutes = require('./routes/discord');
const publicRoutes = require('./routes/public');
const featuredPlacementRoutes = require('./routes/featuredPlacements');
const leadRoutes = require('./routes/leads');

const app = express();
// trust proxy so secure cookies work behind proxies (Render, Heroku, etc.)
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
// Allow known production frontend by default so deployed site works even if env not set
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push('https://navgurukul-placement-frontend.onrender.com');
}
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
console.log('NODE_ENV:', process.env.NODE_ENV, 'FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('CORS allowed origins:', allowedOrigins);
// Use a custom origin checker so we can log and allow the deployed frontend even if env isn't set properly
app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser tools or same-origin requests that don't set Origin
    if (!origin) {
      console.log('CORS: no origin (non-browser or same-origin request)');
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('CORS: allowing origin', origin);
      return callback(null, true);
    }
    // Extra safety: accept origin with the expected hostname even if scheme/port differs
    try {
      const url = new URL(origin);
      if (url.hostname === 'navgurukul-placement-frontend.onrender.com') {
        console.log('CORS: allowing origin by hostname fallback', origin);
        return callback(null, true);
      }
    } catch (err) {
      console.log('CORS: origin parse error', origin, err && err.message);
    }
    console.log('CORS: rejecting origin', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/placement-cycles', placementCycleRoutes);
app.use('/api/campuses', campusRoutes);
app.use('/api/self-applications', selfApplicationRoutes);
app.use('/api/job-readiness', jobReadinessRoutes);
app.use('/api/bulk-upload', bulkUploadRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/featured-placements', featuredPlacementRoutes);
app.use('/api/leads', leadRoutes);

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check with detailed status
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();

  // Check MongoDB connection
  let dbStatus = 'disconnected';
  let dbLatency = null;
  let dbName = null;

  try {
    const dbStart = Date.now();
    await mongoose.connection.db.admin().ping();
    dbLatency = Date.now() - dbStart;
    dbStatus = 'connected';
    dbName = mongoose.connection.name;
  } catch (err) {
    dbStatus = 'error: ' + err.message;
  }

  const isProduction = process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb+srv');

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    server: {
      uptime: process.uptime(),
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
    },
    database: {
      status: dbStatus,
      name: dbName,
      type: isProduction ? 'cloud (MongoDB Atlas)' : 'local',
      latency: dbLatency ? dbLatency + ' ms' : null
    },
    responseTime: (Date.now() - startTime) + ' ms'
  });
});

// Sync endpoint - triggers data sync from production (for development only)
app.post('/api/sync-from-production', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Sync not allowed in production' });
  }

  const { productionUri } = req.body;
  if (!productionUri) {
    return res.status(400).json({ message: 'Production MongoDB URI required' });
  }

  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // Run mongodump and mongorestore
    const localUri = 'mongodb://localhost:27017/placement_dashboard';
    const command = `mongodump --uri="${productionUri}" --archive | mongorestore --uri="${localUri}" --archive --drop`;

    await execPromise(command);
    res.json({ message: 'Sync completed successfully!' });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Sync failed: ' + error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Connect to Database
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected');
    // Initialize Discord Bot
    const discordService = require('./services/discordService');
    discordService.initialize();
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
  });

const PORT = process.env.PORT || 5001;

// Start server and attach helpful error handling
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Failed to start server: port ${PORT} is already in use (EADDRINUSE).`);
    console.error('Troubleshooting tips:');
    console.error(`  - Find the process using the port: lsof -ti TCP:${PORT} -sTCP:LISTEN`);
    console.error('  - Kill it: kill <PID> (or `lsof -ti TCP:5001 -sTCP:LISTEN | xargs kill -9`)');
    console.error('  - Or change the PORT env var to use a different port: PORT=5002 npm run dev');
    // In dev we prefer to exit and let the process manager (nodemon) restart
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});

// Global handlers for unexpected errors to give clearer messages during development
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Recommended: dump and exit to allow process managers to restart
  setTimeout(() => process.exit(1), 1000);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 1000);
});

module.exports = app;
