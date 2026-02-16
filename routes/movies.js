// Movies CRUD routes with JWT and Basic auth protection
const express = require('express');
const passport = require('passport');
const { getJSONObjectForMovieRequirement } = require('../utils');

const router = express.Router();

/**
 * GET /movies (public)
 * Returns 200 with message, headers, query, and env
 */
router.get('/movies', (req, res) => {
  res.status(200).json({
    status: 200,
    message: 'GET movies',
    ...getJSONObjectForMovieRequirement(req)
  });
});

/**
 * POST /movies (public)
 * Returns 200 with message, headers, query, and env
 */
router.post('/movies', (req, res) => {
  res.status(200).json({
    status: 200,
    message: 'movie saved',
    ...getJSONObjectForMovieRequirement(req)
  });
});

/**
 * PUT /movies (JWT auth required)
 * Protected by Passport JWT strategy
 * Returns 200 with message on successful authentication
 * Returns 401 on missing/invalid JWT token
 */
router.put('/movies',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.status(200).json({
      status: 200,
      message: 'movie updated',
      ...getJSONObjectForMovieRequirement(req)
    });
  }
);

/**
 * DELETE /movies (Basic auth required)
 * Protected by Passport Basic strategy
 * Returns 200 with message on successful authentication
 * Returns 401 on missing/incorrect credentials
 */
router.delete('/movies',
  passport.authenticate('basic', { session: false }),
  (req, res) => {
    res.status(200).json({
      status: 200,
      message: 'movie deleted',
      ...getJSONObjectForMovieRequirement(req)
    });
  }
);

/**
 * Unsupported HTTP methods (PATCH, OPTIONS, HEAD, etc.)
 * Returns 405 with Allow header listing supported methods
 */
router.all('/movies', (req, res) => {
  res.set('Allow', 'GET, POST, PUT, DELETE');
  res.status(405).json({
    message: 'HTTP method not supported'
  });
});

module.exports = router;
