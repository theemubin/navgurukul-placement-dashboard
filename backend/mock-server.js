#!/usr/bin/env node
/**
 * Mock Backend Server
 * Provides mock API endpoints for testing when MongoDB is not available
 * Useful for testing frontend + Discord integration without database setup
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
app.use(cors({
  origin: ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Mock data
const mockUsers = {
  'student@navgurukul.org': {
    id: '1',
    email: 'student@navgurukul.org',
    firstName: 'Test',
    lastName: 'Student',
    role: 'student',
    password: 'password123'
  },
  'coordinator@navgurukul.org': {
    id: '2',
    email: 'coordinator@navgurukul.org',
    firstName: 'Test',
    lastName: 'Coordinator',
    role: 'coordinator',
    password: 'password123'
  },
  'manager@navgurukul.org': {
    id: '3',
    email: 'manager@navgurukul.org',
    firstName: 'Test',
    lastName: 'Manager',
    role: 'manager',
    password: 'password123'
  }
};

// Mock login backgrounds
const loginBackgrounds = [
  '/login-backgrounds/bg-1.jpg',
  '/login-backgrounds/bg-2.jpg',
  '/login-backgrounds/bg-3.jpg',
  '/login-backgrounds/bg-4.jpg',
  '/login-backgrounds/bg-5.jpg'
];

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: 'development',
    database: {
      status: 'mock (not using real database)',
      type: 'in-memory for testing'
    },
    note: 'This is a MOCK backend for testing. Set up MongoDB Atlas for production use.'
  });
});

// Mock login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  console.log(`🔑 Login attempt: ${email}`);

  const user = mockUsers[email];
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = 'mock_jwt_token_' + Date.now();

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  console.log(`✅ Login successful for ${email}`);

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  });
});

// Mock logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out' });
});

// Mock get current user
app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Return test user
  res.json({
    user: mockUsers['student@navgurukul.org']
  });
});

// Mock login backgrounds
app.get('/api/login-backgrounds', (req, res) => {
  res.json(loginBackgrounds);
});

// Mock jobs endpoint (for Discord testing)
app.get('/api/jobs', (req, res) => {
  res.json({
    jobs: [
      {
        _id: '1',
        title: 'Full Stack Developer',
        company: { name: 'Test Company', logo: '' },
        location: 'Bangalore',
        salary: { min: 400000, max: 800000 },
        description: 'We are looking for an experienced full stack developer...',
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        jobType: 'full_time',
        eligibility: {
          campuses: [{ name: 'Pune', discordChannelId: null }]
        }
      }
    ]
  });
});

// Mock portfolio endpoint
app.get('/api/public/portfolios', (req, res) => {
  res.json({
    portfolios: [
      {
        _id: '1',
        studentName: 'Test Student',
        role: 'student',
        skills: ['React', 'Node.js', 'MongoDB']
      }
    ]
  });
});

// Mock placements
app.get('/api/public/placements', (req, res) => {
  res.json({
    placements: []
  });
});

// Mock hiring partners
app.get('/api/public/hiring-partners', (req, res) => {
  res.json({
    partners: []
  });
});

// Catch-all for other endpoints
app.use((req, res) => {
  console.log(`📍 ${req.method} ${req.path} - Not implemented in mock server`);
  res.status(501).json({
    message: 'Endpoint not implemented in mock server',
    path: req.path,
    method: req.method,
    note: 'This is a MOCK backend. Set up MongoDB Atlas for full functionality.'
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  🎭 MOCK BACKEND SERVER - FOR TESTING ONLY             ║
║  Running on: http://localhost:${PORT}                    ║
║  Status: ✅ Ready for frontend testing                 ║
╚════════════════════════════════════════════════════════╝

📌 Test Credentials:
  Email: student@navgurukul.org
  Email: coordinator@navgurukul.org
  Email: manager@navgurukul.org
  Password: password123 (for all)

⚠️  Important:
  - This is a MOCK server with in-memory data only
  - Data will NOT persist after restart
  - Use ONLY for frontend/Discord integration testing
  - Set up MongoDB Atlas for production: https://www.mongodb.com/cloud/atlas

💡 Next Steps:
  1. Set up MongoDB Atlas (free tier)
  2. Get your connection string
  3. Update backend/.env with MONGODB_URI
  4. Restart backend with: npm run server
  5. Run seed script: npm run seed

📚 For detailed setup: See LOCAL_SETUP_GUIDE.md
  `);
});
