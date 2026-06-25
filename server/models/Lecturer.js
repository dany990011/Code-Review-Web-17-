const mongoose = require('mongoose');

/**
 * Allowlist of lecturer emails permitted to access the dashboard and admin
 * routes. Auth works by matching the Clerk-authenticated user's email against
 * this collection (see middleware/auth.js). The bootstrap ADMIN_EMAIL bypasses
 * this list so the very first lecturer can be added.
 */
const lecturerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Lecturer', lecturerSchema);
