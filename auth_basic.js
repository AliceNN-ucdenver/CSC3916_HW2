// Passport HTTP Basic strategy configuration for username/password authentication
const passport = require('passport');
const BasicStrategy = require('passport-http').BasicStrategy;
const bcrypt = require('bcrypt');
const db = require('./db');

/**
 * Basic auth verify callback with timing-attack resistance
 * Uses bcrypt.compare for constant-time password verification
 * Runs dummy bcrypt operation when user not found to prevent timing attacks
 */
passport.use('basic', new BasicStrategy(
  async function(username, password, done) {
    const user = db.findOne('username', username);

    if (!user) {
      // Dummy bcrypt operation to prevent user enumeration via timing
      await bcrypt.hash(password, 12);
      return done(null, false);
    }

    // Constant-time password comparison
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return done(null, false);
    }

    // Authentication successful
    return done(null, user);
  }
));

module.exports = passport;
