const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. You do not have permission to perform this action.' 
      });
    }
    next();
  };
};

// Check if user is from same campus (for Campus POCs)
const sameCampus = async (req, res, next) => {
  try {
    if (req.user.role === 'manager' || req.user.role === 'coordinator') {
      return next(); // Managers and coordinators have access to all campuses
    }

    const targetUserId = req.params.studentId || req.params.userId;
    if (targetUserId) {
      const targetUser = await User.findById(targetUserId);
      if (targetUser) {
        // Check if target user's campus is in the POC's managed campuses
        const managedCampuses = req.user.managedCampuses?.length > 0 
          ? req.user.managedCampuses.map(c => c.toString())
          : (req.user.campus ? [req.user.campus.toString()] : []);
        
        const targetCampus = targetUser.campus?.toString();
        
        if (targetCampus && !managedCampuses.includes(targetCampus)) {
          return res.status(403).json({ 
            message: 'Access denied. You can only access students from your managed campuses.' 
          });
        }
      }
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { auth, authorize, sameCampus };
