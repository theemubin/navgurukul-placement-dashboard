const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const passport = require('../config/passport');
const { createTokenEntry, consumeTokenEntry } = require('../utils/tokenStore');

// Helper to normalize FRONTEND_URL (trim trailing slash)
const getFrontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$|\/$/g, '').replace(/\/+$/, '');

// Google OAuth routes
const isGoogleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

router.get('/google', (req, res, next) => {
  if (!isGoogleConfigured()) {
    return res.status(503).json({ message: 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment.' });
  }
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/config', (req, res) => {
  res.json({
    configured: isGoogleConfigured(),
    managerEmail: process.env.MANAGER_EMAIL || null,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '/api/auth/google/callback'
  });
});

// Helper for cookie options
const cookieOptionsForToken = (ttlMs = 7 * 24 * 60 * 60 * 1000) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  maxAge: ttlMs,
  path: '/'
});

// Exchange short-lived code for a JWT token (single-use) and set an HttpOnly cookie
router.post('/google/exchange', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code is required' });
    const payload = consumeTokenEntry(code);
    if (!payload) return res.status(400).json({ message: 'Invalid or expired code' });

    // Debug: log incoming cookies and response (helps validate browser behavior)
    console.debug('Exchange route - incoming req.cookies:', req.cookies);

    // Set the JWT as an HttpOnly cookie and return minimal user info
    const token = payload.token;
    const user = payload.user;

    res.cookie('auth_token', token, cookieOptionsForToken());

    // Debug: confirm cookie was set on server side and inspect header
    console.info('Exchange route - set auth_token cookie for user:', user.email || user.id);
    try {
      const sc = res.getHeader('Set-Cookie');
      console.debug('Exchange route - Set-Cookie header:', sc);
    } catch (err) {
      console.debug('Exchange route - unable to read Set-Cookie header:', err.message);
    }

    // WARNING: Temporary debug - return token in response body so we can validate token independently
    // Remove this before leaving debug mode / production
    console.warn('DEBUG: Returning JWT in exchange response for debugging. REMOVE THIS IN PRODUCTION.');

    return res.json({ user, token });
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ message: 'Server error during token exchange' });
  }
});

router.get('/google/callback', (req, res, next) => {
  // Guard: avoid calling passport when OAuth is not configured
  if (!isGoogleConfigured()) {
    console.error('Google callback hit but OAuth not configured. Returning 503.');
    return res.status(503).json({ message: 'Google OAuth is not configured on the server.' });
  }
  // Delegate to passport
  passport.authenticate('google', { session: false })(req, res, next);
}, async (req, res) => {
    try {
      const user = req.user;
      const frontendBase = getFrontendBase();

      // Check if user needs approval
      if (user.needsApproval && !user.isActive) {
        return res.redirect(`${frontendBase}/auth/pending-approval?email=${encodeURIComponent(user.email)}`);
      }

      // Check if user is inactive (needs manager approval)
      if (!user.isActive) {
        return res.redirect(`${frontendBase}/auth/account-inactive`);
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user._id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Create a short-lived, single-use code and redirect the user with the code
      const code = createTokenEntry({ token, user: { id: user._id, email: user.email, role: user.role } }, 2 * 60 * 1000);
      const redirectUrl = `${frontendBase}/auth/callback?code=${code}`;
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('Google callback error:', error);
      const frontendBase = getFrontendBase();
      res.redirect(`${frontendBase}/auth/login?error=authentication_failed`);
    }
  }
);

// Logout (clear cookie)
router.post('/logout', (req, res) => {
  try {
    res.clearCookie('auth_token', cookieOptionsForToken());
    return res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Server error during logout' });
  }
});

// Temporary debug endpoint to verify a JWT token with the server's secret
// WARNING: This is for debugging only; remove or protect before leaving in production
router.post('/debug/verify-token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ decoded });
  } catch (err) {
    console.error('Debug verify-token error:', err.message);
    return res.status(400).json({ message: 'Invalid token', error: err.message });
  }
});

// Manager approval endpoint
router.post('/approve-user', auth, async (req, res) => {
  try {
    const { userId, approvedRole } = req.body;
    
    // Check if current user is manager
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Only managers can approve users' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user status
    user.isActive = true;
    if (approvedRole && ['student', 'coordinator', 'campus-poc', 'manager'].includes(approvedRole)) {
      user.role = approvedRole;
    }
    await user.save();
    
    // Create notification for approved user
    const Notification = require('../models/Notification');
    await Notification.create({
      user: user._id,
      type: 'account_approved',
      title: 'Account Approved',
      message: `Your account has been approved with ${user.role} role. You can now access the platform.`,
    });
    
    res.json({ 
      message: 'User approved successfully', 
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
    
  } catch (error) {
    console.error('User approval error:', error);
    res.status(500).json({ message: 'Server error during user approval' });
  }
});

// Get pending approvals (for manager)
router.get('/pending-approvals', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Only managers can view pending approvals' });
    }
    
    const pendingUsers = await User.find({ 
      isActive: false,
      authProvider: 'google'
    }).select('firstName lastName email role createdAt');
    
    res.json(pendingUsers);
    
  } catch (error) {
    console.error('Fetch pending approvals error:', error);
    res.status(500).json({ message: 'Server error fetching pending approvals' });
  }
});

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').isIn(['student', 'campus_poc', 'coordinator', 'manager'])
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Register new user
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, role, phone, campus } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
      campus,
      studentProfile: role === 'student' ? {} : undefined
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        campus: user.campus
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    // Debug: log cookie header to see if browser sent auth_token
    console.debug('/me route - incoming cookies:', req.cookies);

    const user = await User.findById(req.userId)
      .select('-password')
      .populate('campus')
      .populate('managedCampuses', 'name code')
      .populate('studentProfile.skills.skill')
      .populate('studentProfile.skills.approvedBy', 'firstName lastName');

    // Normalize softSkills for frontend convenience (return as object map key->rating)
    const userObj = user.toObject ? user.toObject() : user;
    if (Array.isArray(userObj.studentProfile?.softSkills)) {
      const toKey = (name) => {
        if (!name) return '';
        return name.split(/\s+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join('');
      };
      const map = {};
      userObj.studentProfile.softSkills.forEach(s => {
        if (!s) return;
        const key = s.skillName ? toKey(s.skillName) : (s.skillId ? s.skillId.toString() : '');
        if (key) map[key] = s.selfRating || 0;
      });
      // Expose both representations: array stays on userObj.studentProfile.softSkillsArray, and map on softSkills
      userObj.studentProfile.softSkillsArray = userObj.studentProfile.softSkills;
      userObj.studentProfile.softSkills = map;
    }

    res.json(userObj);
  } catch (error) {
    console.error('Get user error:', error);
    if (res.headersSent) {
      console.error('Headers already sent for /me, cannot send error response');
      return;
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', auth, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
