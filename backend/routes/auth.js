const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const passport = require('../config/passport');
const { createTokenEntry, consumeTokenEntry } = require('../utils/tokenStore');
const gharApiService = require('../services/gharApiService');

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
// Use SameSite=None for cross-site cookie delivery (required for SPA exchange flow).
// Modern browsers require `Secure` when `SameSite=None` — ensure we set it in development when using localhost
// or when explicitly forcing secure cookies via environment.
const cookieOptionsForToken = (ttlMs = 7 * 24 * 60 * 60 * 1000) => {
  const isProd = process.env.NODE_ENV === 'production';
  const forceSecure = process.env.FORCE_SECURE_COOKIES === 'true';

  // Requirement: sameSite: 'None' requires Secure: true.
  // In development (non-SSL), we should use Lax or Strict to allow cookies over http.
  const secure = isProd || forceSecure;
  const sameSite = secure ? 'None' : 'Lax';

  return {
    httpOnly: true,
    secure: secure,
    sameSite: sameSite,
    maxAge: ttlMs,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined
  };
};

// Exchange short-lived code for a JWT token (single-use) and set an HttpOnly cookie
router.post('/google/exchange', async (req, res) => {
  try {
    const { code } = req.body;
    console.debug('Exchange route - received code:', code);
    if (!code) return res.status(400).json({ message: 'Code is required' });

    const payload = consumeTokenEntry(code);
    if (!payload) {
      // Extra debug output to help diagnose why a code was rejected
      try {
        const { debugListKeys, debugStoreSize, debugHasCode } = require('../utils/tokenStore');
        console.warn('Exchange route - invalid or expired code:', code);
        console.debug('Exchange route - tokenStore size:', debugStoreSize());
        console.debug('Exchange route - sample keys:', debugListKeys());
        console.debug('Exchange route - code present before consume?', debugHasCode(code));
      } catch (dbgErr) {
        console.debug('Exchange route - debug helpers not available:', dbgErr.message);
      }
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

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

    // Only return token in response body when explicitly enabled for debugging.
    if (process.env.DEBUG_RETURN_TOKEN === 'true') {
      console.warn('DEBUG: Returning JWT in exchange response because DEBUG_RETURN_TOKEN is enabled.');
      return res.json({ user, token });
    }

    // Default (safer): do not return token in response body. Browser will hold HttpOnly cookie.
    // Trigger Ghar Sync in background if student
    if (user.role === 'student') {
      gharApiService.syncStudentData(user.email).catch(err => console.error('Background Ghar sync error (exchange):', err.message));
    }

    return res.json({ user });
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
    // If passport rejected the user (e.g., non-navgurukul email), redirect to frontend with error
    if (!req.user) {
      const frontendBase = getFrontendBase();
      return res.redirect(`${frontendBase}/login?error=domain_not_allowed`);
    }

    const user = req.user;
    const frontendBase = getFrontendBase();

    // If the account is not active, treat it as pending approval and redirect accordingly
    if (!user.isActive) {
      return res.redirect(`${frontendBase}/auth/pending-approval?email=${encodeURIComponent(user.email)}`);
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

    // Trigger Ghar Sync in background if student
    if (user.role === 'student') {
      gharApiService.syncStudentData(user.email).catch(err => console.error('Background Ghar sync error (callback):', err.message));
    }

    const redirectUrl = `${frontendBase}/auth/callback?code=${code}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Google callback error:', error);
    const frontendBase = getFrontendBase();
    // Redirect to the canonical frontend login path
    res.redirect(`${frontendBase}/login?error=authentication_failed`);
  }
}
);

// Logout (clear cookie)
router.post('/logout', (req, res) => {
  try {
    const opts = cookieOptionsForToken();
    // Primary clear: with same options used when setting the cookie
    res.clearCookie('auth_token', opts);
    // Secondary clear: attempt to clear host-only cookie variant
    res.clearCookie('auth_token');
    // Overwrite cookie with empty value and immediate expiry to be extra safe
    res.cookie('auth_token', '', { ...opts, maxAge: 0, expires: new Date(0) });

    console.info('Logout - cleared auth_token cookie (attempted multiple variants)');
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

    // Normalize approvedRole to accept both underscore and hyphen variants (frontend may send campus_poc)
    const normalizedRole = approvedRole ? String(approvedRole).replace('_', '-').trim() : undefined;

    // Update user status
    user.isActive = true;
    if (normalizedRole && ['student', 'coordinator', 'campus-poc', 'manager'].includes(normalizedRole)) {
      user.role = normalizedRole;
    } else if (approvedRole && ['student', 'coordinator', 'campus_poc', 'manager'].includes(approvedRole)) {
      // Fallback: accept underscore variant for campus_poc
      user.role = approvedRole === 'campus_poc' ? 'campus-poc' : approvedRole;
    }
    await user.save();

    // Create notification for approved user
    const Notification = require('../models/Notification');
    await Notification.create({
      recipient: user._id,
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

    // Enforce navgurukul-only platform policy
    if (!String(email || '').toLowerCase().endsWith('@navgurukul.org')) {
      return res.status(403).json({ message: 'Only @navgurukul.org email addresses are allowed to register.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Determine activation: students auto-active; elevated roles require manager approval
    let isActive = true;
    const normalizedRole = role === 'campus_poc' ? 'campus_poc' : role;
    if (['coordinator', 'campus_poc', 'manager'].includes(normalizedRole) && normalizedRole !== 'student') {
      isActive = false;
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role: normalizedRole || 'student',
      phone,
      campus,
      isActive,
      studentProfile: (normalizedRole || 'student') === 'student' ? {} : undefined
    });

    await user.save();

    // If user requires approval, notify manager
    if (!user.isActive) {
      try {
        const Notification = require('../models/Notification');
        const manager = await User.findOne({ email: process.env.MANAGER_EMAIL?.toLowerCase(), role: 'manager' });
        if (manager) {
          await Notification.create({
            user: manager._id,
            type: 'user_approval_required',
            title: 'New User Registration Requires Approval',
            message: `${firstName} ${lastName} (${email}) has registered and needs role approval.`,
            data: { userId: user._id, userEmail: email, userName: `${firstName} ${lastName}`, requestedRole: user.role }
          });
        }
      } catch (notifyErr) {
        console.error('Failed to create manager notification for approval:', notifyErr);
      }
    }

    // Only issue a token immediately for active accounts (students and manager)
    if (user.isActive) {
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive
        }
      });
    }

    // For inactive users (requires manager approval), do not return a token.
    return res.status(201).json({
      message: 'User registered successfully and is pending manager approval',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive
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

    // Trigger Ghar Sync in background if student
    if (user.role === 'student') {
      gharApiService.syncStudentData(user.email).catch(err => console.error('Background Ghar sync error (login):', err.message));
    }

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

    // Trigger background sync if student to keep dynamic data fresh
    if (userObj.role === 'student' && userObj.email) {
      // Optional: throttle sync to once every 4 hours via timestamp check
      const lastSync = userObj.studentProfile?.externalData?.ghar?.lastSyncedAt;
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

      if (!lastSync || new Date(lastSync) < fourHoursAgo) {
        gharApiService.syncStudentData(userObj.email).catch(err => console.error('Background Ghar sync error (/me):', err.message));
      }
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
