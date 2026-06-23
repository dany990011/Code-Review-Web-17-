const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./db');

// Connect to MongoDB
connectDB();

const app = express();
const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(url => url.trim().replace(/\/$/, '')) 
  : ['http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in our allowed list, or if it's a Vercel preview domain
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Import Routes
const projectRoutes = require('./routes/projects');
const githubRoutes = require('./routes/github');
const chatRoutes = require('./routes/chat');
const analysisRoutes = require('./routes/analysis');

// Use Routes
app.use('/api/projects', projectRoutes);
app.use('/api/projects', githubRoutes);
app.use('/api/projects', chatRoutes);
app.use('/api/projects', analysisRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
