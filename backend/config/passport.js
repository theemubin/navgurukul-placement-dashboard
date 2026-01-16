const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');
const jwt = require('jsonwebtoken');

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const firstName = profile.name.givenName;
      const lastName = profile.name.familyName;
      const avatar = profile.photos[0]?.value;

      // Check if user already exists
      let user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Update existing user info
        user.firstName = firstName;
        user.lastName = lastName;
        if (avatar) user.avatar = avatar;
        user.lastLogin = new Date();
        await user.save();

        return done(null, user);
      }

      // Determine role based on email and approval requirements
      let role = 'student'; // Default role
      let isActive = true;
      let needsApproval = false;

      // Check if it's the manager email
      if (email.toLowerCase() === process.env.MANAGER_EMAIL?.toLowerCase()) {
        role = 'manager';
        isActive = true;
        needsApproval = false;
      }
      // Check if it's a NavGurukul domain email
      else if (email.toLowerCase().includes('@navgurukul.org')) {
        // NavGurukul staff need manager approval for role assignment
        role = 'coordinator'; // Default for staff, can be changed by manager
        isActive = false; // Inactive until approved
        needsApproval = true;
      }
      // External emails default to student
      else {
        role = 'student';
        isActive = true; // Students are auto-approved
        needsApproval = false;
      }

      // Create new user
      const newUser = new User({
        email: email.toLowerCase(),
        firstName,
        lastName,
        avatar,
        role,
        isActive,
        lastLogin: new Date(),
        // Set a default password (they'll use Google Auth)
        password: Math.random().toString(36).substring(2, 15),
        // Mark as Google Auth user
        googleId: profile.id,
        authProvider: 'google'
      });

      await newUser.save();

      // If needs approval, create notification for manager
      if (needsApproval) {
        const Notification = require('../models/Notification');
        const manager = await User.findOne({
          email: process.env.MANAGER_EMAIL?.toLowerCase(),
          role: 'manager'
        });

        if (manager) {
          await Notification.create({
            user: manager._id,
            type: 'user_approval_required',
            title: 'New User Registration Requires Approval',
            message: `${firstName} ${lastName} (${email}) has registered and needs role approval.`,
            data: {
              userId: newUser._id,
              userEmail: email,
              userName: `${firstName} ${lastName}`,
              requestedRole: role
            }
          });
        }
      }

      return done(null, { ...newUser.toObject(), needsApproval });
    } catch (error) {
      console.error('Google OAuth Error:', error);
      return done(error, null);
    }
  }));
} else {
  console.error('CRITICAL: Google OAuth credentials missing in environment variables!');
  console.error('Google OAuth login will not be available.');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;