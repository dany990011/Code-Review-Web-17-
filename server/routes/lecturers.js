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

// Add a new lecturer to the allowlist (must be authenticated as an existing lecturer)
router.post('/', protectLecturerRoute, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const newLecturer = new Lecturer({ email: email.toLowerCase() });
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
