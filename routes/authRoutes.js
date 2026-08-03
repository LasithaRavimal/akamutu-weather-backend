/**
 * routes/authRoutes.js — Authentication routes
 */

const express = require('express');
const router = express.Router();
const { login, getMe, register } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');


// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/register
router.post('/register', register);

// GET /api/auth/me (protected)
router.get('/me', protect, getMe);

module.exports = router;
