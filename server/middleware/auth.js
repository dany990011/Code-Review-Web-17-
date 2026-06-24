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
