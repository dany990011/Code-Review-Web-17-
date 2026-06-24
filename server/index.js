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
  ? process.env.CLIENT_URL.split(',').map(url => url.trim().replace(/\/$/, '')) //if multiple domains are provided, this splits them and cleans them up, removes slashes at the end
  : ['http://localhost:5173'];  // lets us run this locally if no url is provided

app.use(cors({
  origin: function (origin, callback) {  //origin is the origin of the request, callback is what we do with it
    if (!origin) return callback(new Error('Blocked non-browser request')); // browsers only !
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) { //letting anything ending with vercel.app to pass
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true //allow passing tokens and cookies 
}));

const server = http.createServer(app);  //instead of letting express listen only, we are building ther server ourselfs, letting nodeJS decide where to send it 
const io = new Server(server, {   //"Server" is imported from Socket.io, listening for the websocket upgrade in a request, if no upgrade , nodeJS sends it to express
  cors: {   //cors protection for web sockets! (ws:// instead of http://)
    origin: function (origin, callback) {
      if (!origin) return callback(new Error('Blocked non-browser request'));
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
app.set('io', io);    //any route file can use io now

io.on('connection', (socket) => {   //listenening to a connection to socket 
  console.log(`Socket connected: ${socket.id}`);

  socket.on('joinProject', (projectId) => {   //listeningt to a user joining a project (e.g. "project_5" ,or room in other words)
    socket.join(`project_${projectId}`);  //adding that user to that room 
    console.log(`Socket ${socket.id} joined project_${projectId}`);
  });

  socket.on('leaveProject', (projectId) => {  //leaving a room (pressing back in a project)
    socket.leave(`project_${projectId}`);
    console.log(`Socket ${socket.id} left project_${projectId}`);
  });

  socket.on('joinLecturers', () => {  //lecturer opens the dashboard
    socket.join('lecturers');
    console.log(`Socket ${socket.id} joined lecturers room`);
  });

  socket.on('leaveLecturers', () => {  //lecturer leaves the dashboard
    socket.leave('lecturers');
    console.log(`Socket ${socket.id} left lecturers room`);
  });

  socket.on('disconnect', () => {   //user leaving compleatly
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.use(clerkMiddleware());  //first, clerk cheks for token, if no token, continue without adding userID to req.auth (par of the request)
app.use(express.json());  //turns data into JS object 

// Import Routes
const projectRoutes = require('./routes/projects'); //importing JS files (routs)
const githubRoutes = require('./routes/github');
const chatRoutes = require('./routes/chat');
const analysisRoutes = require('./routes/analysis');
const lecturerRoutes = require('./routes/lecturers');

// Use Routes
app.use('/api/projects', projectRoutes);  //checking these routs one by one (waterfall) if they have a match for the request (e.g. /123/analyze)
app.use('/api/projects', githubRoutes);
app.use('/api/projects', chatRoutes);
app.use('/api/projects', analysisRoutes);
app.use('/api/lecturers', lecturerRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {   //staring the setver, listening on port 5000, senging log if started
  console.log(`Server is running on port ${PORT}`);
});
