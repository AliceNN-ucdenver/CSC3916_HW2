// Express REST API server with JWT/Basic auth and OWASP security controls
// Load environment variables FIRST before any other module
require('dotenv').config();

// Validate required environment variables at startup
if (!process.env.SECRET_KEY || !process.env.UNIQUE_KEY) {
  console.error('FATAL: Missing required environment variables');
  console.error('Required: SECRET_KEY (≥32 chars), UNIQUE_KEY');
  console.error('See .env.example for configuration template');
  process.exit(1);
}

if (process.env.SECRET_KEY.length < 32) {
  console.error('FATAL: SECRET_KEY must be at least 32 characters');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const passport = require('passport');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Configure Passport strategies
require('./auth_jwt');
require('./auth_basic');

// Mount routes
const signupRouter = require('./routes/signup');
const signinRouter = require('./routes/signin');
const moviesRouter = require('./routes/movies');

app.use('/', signupRouter);
app.use('/', signinRouter);
app.use('/', moviesRouter);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log('Environment configuration loaded successfully');
  // Do NOT log SECRET_KEY or other sensitive values
});

// Export for testing
module.exports = app;
