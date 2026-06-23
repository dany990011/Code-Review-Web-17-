const { requireAuth, clerkClient } = require('@clerk/express');
const Lecturer = require('../models/Lecturer');

const checkAllowlist = async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch user details from Clerk to get the email
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;

    if (!email) {
      return res.status(401).json({ error: 'No email associated with this account' });
    }

    // Check if the email is the ADMIN_EMAIL (bootstrap override)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
      return next();
    }

    // Check if the email exists in our Lecturer MongoDB collection
    const lecturer = await Lecturer.findOne({ email: email.toLowerCase() });
    if (!lecturer) {
      return res.status(403).json({ error: 'Access forbidden: Your email is not on the lecturer allowlist.' });
    }

    // Store email on request for later use if needed
    req.userEmail = email;
    next();
  } catch (error) {
    console.error('Error in auth middleware:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const protectLecturerRoute = [
  requireAuth(),
  checkAllowlist
];

module.exports = { protectLecturerRoute };
