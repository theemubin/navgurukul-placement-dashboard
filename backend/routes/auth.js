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
  if (!isGoogleConfigured()) {
    console.error('Google callback hit but OAuth not configured. Returning 503.');
    return res.status(503).json({ message: 'Google OAuth is not configured on the server.' });
  }

  const frontendBase = getFrontendBase();
  const googleStrategy = passport._strategy && passport._strategy('google');
  if (!googleStrategy) {
    console.error('Google callback cannot proceed because Passport Google strategy is not registered.');
    return res.redirect(`${frontendBase}/login?error=oauth_not_configured`);
  }

  const debugEnv = {
    NODE_ENV: process.env.NODE_ENV,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasGoogleRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasFrontendUrl: !!process.env.FRONTEND_URL,
    frontendBase,
    requestHost: req.get('host'),
    referer: req.get('referer')
  };
  console.info('Google callback environment and request metadata:', debugEnv);

  console.info('Google callback request query:', req.query);

  passport.authenticate('google', { session: false }, async (err, user, info) => {
    if (err) {
      console.error('Google callback passport error:', err);
      return res.redirect(`${frontendBase}/login?error=oauth_failed&details=${encodeURIComponent(err.message)}`);
    }

    if (!user) {
      console.warn('Google callback passport returned no user:', info);
      const errorCode = info?.message?.includes('@navgurukul.org') ? 'domain_not_allowed' : 'oauth_failed';
      return res.redirect(`${frontendBase}/login?error=${errorCode}`);
    }

    try {
      if (!user.isActive) {
        return res.redirect(`${frontendBase}/auth/pending-approval?email=${encodeURIComponent(user.email)}`);
      }

      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const code = createTokenEntry({ token, user: { id: user._id, email: user.email, role: user.role } }, 2 * 60 * 1000);

      if (user.role === 'student') {
        gharApiService.syncStudentData(user.email).catch(err => console.error('Background Ghar sync error (callback):', err.message));
      }

      const redirectUrl = `${frontendBase}/auth/callback?code=${code}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google callback processing error:', error);
      return res.redirect(`${frontendBase}/login?error=authentication_failed&details=${encodeURIComponent(error.message)}`);
    }
  })(req, res, next);
});

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

// Role Request endpoint (for users to request role change from profile)
router.post('/request-role', auth, async (req, res) => {
  try {
    const { role, reason } = req.body;
    if (!['student', 'coordinator', 'campus_poc', 'manager'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role requested' });
    }

    if (req.user.role === role) {
      return res.status(400).json({ message: 'You already have this role' });
    }

    const user = await User.findById(req.userId);
    
    // Auto-approve student role request
    if (role === 'student') {
      user.role = 'student';
      user.roleRequest = {
        role: 'student',
        status: 'approved',
        reason: reason || 'Auto-approved student role request',
        requestedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: req.userId
      };
      await user.save();
      return res.json({ message: 'Role changed to student successfully' });
    }

    user.roleRequest = {
      role: role,
      status: 'pending',
      reason: reason || '',
      requestedAt: new Date()
    };
    await user.save();

    // Notify manager
    const Notification = require('../models/Notification');
    const manager = await User.findOne({ email: process.env.MANAGER_EMAIL?.toLowerCase(), role: 'manager' });
    if (manager) {
      await Notification.create({
        recipient: manager._id,
        type: 'role_request',
        title: 'Role Change Requested',
        message: `${user.firstName} ${user.lastName} has requested a role change to ${role.replace('_', ' ')}.`,
        link: '/manager/approvals',
        relatedEntity: { type: 'user', id: user._id }
      });
    }

    res.json({ message: 'Role change request submitted successfully' });
  } catch (error) {
    console.error('Role request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Manager approval endpoint (Handles both user activation and role requests)
router.post('/approve-user', auth, async (req, res) => {
  try {
    const { userId, approvedRole, action = 'approve' } = req.body;

    // Check if current user is manager
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Only managers can approve users' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const Notification = require('../models/Notification');

    if (action === 'reject') {
        if (user.roleRequest) {
          user.roleRequest.status = 'rejected';
          user.roleRequest.reviewedAt = new Date();
          user.roleRequest.reviewedBy = req.userId;
        }
        await user.save();
        
        await Notification.create({
          recipient: user._id,
          type: 'role_request_rejected',
          title: 'Role Request Rejected',
          message: `Your request for the ${approvedRole || 'new'} role has been rejected.`,
        });

        return res.json({ message: 'Request rejected' });
    }

    // Normalize approvedRole
    const normalizedRole = approvedRole ? String(approvedRole).replace('_', '-').replace('campus-poc', 'campus_poc').trim() : undefined;

    // Update user status
    user.isActive = true; // Always active when manager acts on them
    if (normalizedRole && ['student', 'coordinator', 'campus_poc', 'manager'].includes(normalizedRole)) {
      user.role = normalizedRole;
    }

    // If there was a pending request, mark it as approved
    if (user.roleRequest && user.roleRequest.status === 'pending') {
       user.roleRequest.status = 'approved';
       user.roleRequest.reviewedAt = new Date();
       user.roleRequest.reviewedBy = req.userId;
    }
    
    await user.save();

    // Create notification for approved user
    await Notification.create({
      recipient: user._id,
      type: 'account_approved',
      title: 'Account Role Updated',
      message: `Your account role has been updated to ${user.role.replace('_', ' ')}.`,
    });

    res.json({
      message: 'User approved/updated successfully',
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

// Get pending role requests (for manager)
router.get('/pending-approvals', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Only managers can view pending approvals' });
    }

    const pendingUsers = await User.find({
      'roleRequest.status': 'pending',
      'roleRequest.role': { $ne: 'student' }
    }).select('firstName lastName email role roleRequest createdAt');

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

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and registration
 */

// Register new user
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 example: student@navgurukul.org
 *               password:
 *                 type: string
 *                 example: password123
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [student, campus_poc, coordinator, manager]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 *       403:
 *         description: Domain not allowed
 */
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

    // Determine activation: everyone is student by default and auto-active
    // This removes the mandatory approval for everyone
    const normalizedRole = 'student';
    const isActive = true;

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role: normalizedRole,
      phone,
      campus,
      isActive,
      studentProfile: {}
    });

    // If they provided a desired role in registration body, set it as a request
    if (role && role !== 'student' && ['coordinator', 'campus_poc', 'manager'].includes(role)) {
       user.roleRequest = {
          role: role,
          status: 'pending',
          requestedAt: new Date(),
          reason: 'Initial registration request'
       };
    }

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
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: student@navgurukul.org
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials or account deactivated
 */
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
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get details of currently logged in user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Not authorized
 */
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
      // Live fetch: Trigger sync on every profile access (no throttle)
      gharApiService.syncStudentData(userObj.email).catch(err =>
        console.error('Background Ghar sync error (/me):', err.message)
      );
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
