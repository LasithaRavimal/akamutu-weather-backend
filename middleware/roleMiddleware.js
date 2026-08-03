/**
 * middleware/roleMiddleware.js — Role-based access control middleware
 * Must be used AFTER the protect middleware.
 */

/**
 * Restrict route to specific roles.
 * Usage: router.use(protect, restrictTo('admin'))
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }

    next();
  };
};

module.exports = { restrictTo };
