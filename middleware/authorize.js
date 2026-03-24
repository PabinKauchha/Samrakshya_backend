const { ROLES } = require("../constants/roles");

/**
 * Authorization middleware factory
 * Creates middleware that checks if user has required role(s)
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware function
 *
 * @example
 * // Single role
 * router.get('/admin', auth, authorize(ROLES.ADMIN), adminHandler);
 *
 * // Multiple roles
 * router.get('/dashboard', auth, authorize(ROLES.USER, ROLES.ADMIN), dashboardHandler);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user exists (should be attached by auth middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

/**
 * Middleware to check if email is verified
 * Use this for routes that require verified email
 */
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: "Email verification required. Please verify your email to access this feature.",
    });
  }

  next();
};

/**
 * Middleware to check if user is admin
 * Shorthand for authorize(ROLES.ADMIN)
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }

  next();
};

module.exports = { authorize, requireVerifiedEmail, isAdmin };
