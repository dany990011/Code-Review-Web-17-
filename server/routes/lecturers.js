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
