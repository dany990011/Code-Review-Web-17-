/**
 * Lecturer allowlist routes (mounted at /api/lecturers).
 *
 * Both endpoints are lecturer-only: you must already be an allowed lecturer to
 * see or grow the list. This is the "invite" mechanism — existing lecturers add
 * new ones; the very first lecturer is bootstrapped via the ADMIN_EMAIL env var
 * (see middleware/auth.js).
 */
const express = require('express');
const router = express.Router();
const Lecturer = require('../models/Lecturer');
const { protectLecturerRoute } = require('../middleware/auth');
const { clerkClient } = require('@clerk/express');

// Add a new lecturer to the allowlist (must be authenticated as an existing lecturer)
router.post('/', protectLecturerRoute, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.toLowerCase();

    try {
      await clerkClient.users.createUser({
        emailAddress: [normalizedEmail],
        skipPasswordRequirement: true // They will use Google Auth, Email OTP, or "Forgot Password" to log in
      });
    } catch (clerkErr) {
      // Ignore if the user already exists in Clerk
      const isDuplicate = clerkErr.errors && clerkErr.errors.some(e => e.code === 'form_identifier_exists');
      if (!isDuplicate) {
        console.error('Error creating Clerk user:', clerkErr);
        return res.status(500).json({ error: 'Failed to create account in authentication provider' });
      }
    }

    // 2. Add to our local database
    const newLecturer = new Lecturer({ email: normalizedEmail });
    await newLecturer.save();

    res.status(201).json({ message: 'Lecturer added successfully', email: newLecturer.email });
  } catch (error) {
    // 11000 = MongoDB duplicate-key error (the email's unique index).
    if (error.code === 11000) {
      return res.status(400).json({ error: 'This email is already in the allowlist.' });
    }
    console.error('Error adding lecturer:', error);
    res.status(500).json({ error: 'Failed to add lecturer' });
  }
});

// Get all allowed lecturers
router.get('/', protectLecturerRoute, async (req, res) => {
  try {
    const lecturers = await Lecturer.find({}, 'email addedAt').sort({ addedAt: -1 });
    res.json(lecturers);
  } catch (error) {
    console.error('Error fetching lecturers:', error);
    res.status(500).json({ error: 'Failed to fetch lecturers' });
  }
});

module.exports = router;
