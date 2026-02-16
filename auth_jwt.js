// Passport JWT strategy configuration for Bearer token authentication
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const db = require('./db');

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.SECRET_KEY
};

/**
 * JWT verify callback
 * Validates JWT payload structure and looks up user by ID
 * Returns user if found, otherwise fails authentication
 */
passport.use('jwt', new JwtStrategy(options, (jwtPayload, done) => {
  // Validate JWT payload structure (prevent token confusion attacks)
  if (!jwtPayload.id || !jwtPayload.username) {
    return done(null, false);
  }

  // Look up user by ID from decoded payload
  const user = db.findOne('id', jwtPayload.id);

  if (user) {
    // User exists - authentication successful
    return done(null, user);
  } else {
    // User deleted after token issued - fail authentication
    return done(null, false);
  }
}));

module.exports = passport;
