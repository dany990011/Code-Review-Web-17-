const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { clerkMiddleware } = require('@clerk/express');
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
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }
});

// Attach io to the app so routes can use it
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('joinProject', (projectId) => {
    socket.join(`project_${projectId}`);
    console.log(`Socket ${socket.id} joined project_${projectId}`);
  });

  socket.on('leaveProject', (projectId) => {
    socket.leave(`project_${projectId}`);
    console.log(`Socket ${socket.id} left project_${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.use(clerkMiddleware());
app.use(express.json());

// Import Routes
const projectRoutes = require('./routes/projects');
const githubRoutes = require('./routes/github');
const chatRoutes = require('./routes/chat');
const analysisRoutes = require('./routes/analysis');
const lecturerRoutes = require('./routes/lecturers');

// Use Routes
app.use('/api/projects', projectRoutes);
app.use('/api/projects', githubRoutes);
app.use('/api/projects', chatRoutes);
app.use('/api/projects', analysisRoutes);
app.use('/api/lecturers', lecturerRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
