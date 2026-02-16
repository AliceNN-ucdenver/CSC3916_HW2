// POST /signin route with JWT token issuance and timing-attack prevention
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Allowlist regex for username (same as signup)
const usernameRegex = /^[a-zA-Z0-9_-]+$/;

/**
 * POST /signin
 * Authenticate user and issue JWT token
 * Returns 200 with token on success, 401 on invalid credentials, 400 on validation error
 * Implements timing-attack prevention via dummy bcrypt operation
 */
router.post('/signin', async (req, res) => {
  const { username, password } = req.body;

  // Validate input fields
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Validation error'
    });
  }

  // Apply same validation as signup (injection prevention)
  if (username.length < 3 || username.length > 50 || !usernameRegex.test(username)) {
    return res.status(400).json({
      success: false,
      message: 'Validation error'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Validation error'
    });
  }

  try {
    // Look up user
    const user = db.findOne('username', username);

    if (!user) {
      // User not found - run dummy bcrypt to prevent timing attacks
      await bcrypt.hash(password, 12);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Constant-time password comparison
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      // Wrong password - return same generic error
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Authentication successful - sign JWT
    // Payload contains ONLY id and username (no password hash)
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.SECRET_KEY,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      success: true,
      token: token
    });
  } catch (error) {
    // Generic error
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
