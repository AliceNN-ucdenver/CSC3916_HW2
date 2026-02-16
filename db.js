// In-memory user database with crypto.randomBytes IDs and bcrypt pre-seeding
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Module-scoped array for storing users
const users = [];

// Pre-seed default user at module load time
const DEFAULT_USER = {
  id: crypto.randomBytes(16).toString('hex'),
  username: process.env.DEFAULT_USER || 'defaultUser',
  passwordHash: bcrypt.hashSync(process.env.DEFAULT_PASSWORD || 'defaultPassword123!', 12)
};
users.push(DEFAULT_USER);

/**
 * Save a new user to the database
 * @param {Object} user - User object with username and passwordHash
 * @returns {Object} Saved user with generated ID
 */
function save(user) {
  const newUser = {
    id: crypto.randomBytes(16).toString('hex'),
    ...user
  };
  users.push(newUser);
  // Return shallow copy to prevent mutation
  return { ...newUser };
}

/**
 * Find all users
 * @returns {Array} Array of user objects (shallow copies)
 */
function find() {
  return users.map(user => ({ ...user }));
}

/**
 * Find one user by field value
 * @param {string} field - Field name to search
 * @param {*} value - Value to match
 * @returns {Object|null} User object (shallow copy) or null
 */
function findOne(field, value) {
  const user = users.find(u => u[field] === value);
  // Return shallow copy to prevent direct mutation of internal store
  return user ? { ...user } : null;
}

/**
 * Remove user by ID
 * @param {string} id - User ID
 * @returns {boolean} True if removed, false if not found
 */
function remove(id) {
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return false;
  users.splice(index, 1);
  return true;
}

/**
 * Update user by ID
 * @param {string} id - User ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated user (shallow copy) or null
 */
function update(id, updates) {
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    ...updates,
    id: users[index].id // Prevent ID modification
  };

  return { ...users[index] };
}

module.exports = {
  save,
  find,
  findOne,
  remove,
  update
};
