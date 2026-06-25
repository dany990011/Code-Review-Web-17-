/**
 * Lecturer authorization middleware.
 *
 * Strategy: Clerk (via clerkMiddleware in index.js) authenticates the request
 * and attaches the user id. Here we resolve that user's email and authorize it
 * by checking it against the Lecturer allowlist in MongoDB. The bootstrap
 * ADMIN_EMAIL is allowed through unconditionally so the first lecturer can be
 * created before the allowlist has any entries.
 *
 * Apply via `protectLecturerRoute` on any route that must be lecturer-only.
 */
const { requireAuth, clerkClient, getAuth } = require('@clerk/express');
const Lecturer = require('../models/Lecturer');

const checkAllowlist = async (req, res, next) => {
  try {
    const auth = getAuth(req);  //grabbs the id that was give to req in index.js, if it was given
    const userId = auth?.userId;
    if (!userId) {
      console.error('Clerk Auth Error Details:', auth);
      return res.status(401).json({ error: 'Unauthorized', details: auth });  //unauthorized, stop here
    }

    // Fetch user details from Clerk API to get the email
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;

    if (!email) { //no email found, not supposed to happen
      return res.status(401).json({ error: 'No email associated with this account' });
    }

    // Check if the email is the ADMIN_EMAIL (bootstrap override)
    const adminEmail = process.env.ADMIN_EMAIL;   //leting admin email skip the DB check, backdoor for first creation
    if (adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
      return next();  //next lets us skip remaining check
    }

    // Check if the email exists in our Lecturer MongoDB collection
    const lecturer = await Lecturer.findOne({ email: email.toLowerCase() });
    if (!lecturer) {
      return res.status(403).json({ error: 'Access forbidden: Your email is not on the lecturer allowlist.' });
    }

    // Store email on request for later use if needed
    req.userEmail = email;
    next(); //lecturer found! check is complete
  } catch (error) {
    console.error('Error in auth middleware:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const protectLecturerRoute = [  //when we apply this to express, we force the req to pass both functions
  //requireAuth(),  //not needed, we check auth at our custom function
  checkAllowlist
];

module.exports = { protectLecturerRoute };
