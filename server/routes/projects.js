/**
 * Project routes — create / read / delete / patch review sessions.
 *
 * Mounted at /api/projects. Note the deliberate auth split: students upload and
 * work on a project *without* logging in (open endpoints), while listing every
 * project and deleting one are lecturer-only (protectLecturerRoute).
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Project = require('../models/Project');
const Message = require('../models/Message');
const { protectLecturerRoute } = require('../middleware/auth');
const { extractRequirementsText } = require('../services/requirements');

// Set up Multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');  //a path for file uploads
if (!fs.existsSync(uploadDir)) {  //if it doesnt already exsist, create it (in the server)
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  //setting the destination useing a call back and the destination we set before
  destination: (req, file, cb) => cb(null, uploadDir),
  //setting the filename with the name using the currenttime (in ms) so that files wont get overwritten
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });   //feeding the rulebook to multer

// API Endpoint to handle project upload
router.post('/upload', upload.single('requirementsDoc'), async (req, res) => {
  try {
    const { githubUrl } = req.body;   //the github url
    const file = req.file;  // object that contains info about the file multer saved

    if (!githubUrl || !file) {
      return res.status(400).json({ error: 'GitHub URL and Requirements Document are required.' });
    }

    let requirementsText = '';
    try {
      requirementsText = await extractRequirementsText(file.path, file.originalname);
    } catch (readErr) {
      console.warn('Could not read requirements file as text:', readErr.message);
      return res.status(400).json({ error: readErr.message || 'Could not read requirements file.' });
    }

    const newProject = new Project({  //blueprint for mongoose for a projct
      githubUrl,
      requirementsFileName: file.originalname,
      requirementsFilePath: file.path,
      requirementsText,
    });

    const savedProject = await newProject.save();  //saving in DB

    const io = req.app.get('io'); //getting the app from req becasue req.app = app thatnks to Express
    if (io) {
      io.to('lecturers').emit('projectCreated', savedProject);  //sending to lecturers room that a project was created
    }

    res.status(201).json({  //sending to the client a response of succsess
      message: 'Project uploaded successfully',
      projectId: savedProject._id,
    });
  } catch (error) {
    console.error('Error uploading project:', error);
    res.status(500).json({ error: 'Failed to upload project' });
  }
});

// API Endpoint to get all projects
router.get('/', protectLecturerRoute, async (req, res) => {
  try {
    const projects = await Project.find().sort({ uploadedAt: -1 }); //find all prjects, sort them by newest (-1)
    res.json(projects); //send all projcts to client
  } catch (error) {
    console.error('Error fetching all projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// API Endpoint to get project details
router.get('/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);   //find the proejct with that ID in DB
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);  //send back to client
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// API Endpoint to delete a project
router.delete('/:projectId', protectLecturerRoute, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Delete associated messages
    await Message.deleteMany({ projectId: req.params.projectId });
    // Delete the project
    await Project.findByIdAndDelete(req.params.projectId);

    // Optionally delete the physical file
    if (project.requirementsFilePath && fs.existsSync(project.requirementsFilePath)) {  //check if file exists both in the object and on actual drive
      fs.unlinkSync(project.requirementsFilePath);    //delete it
    }

    const io = req.app.get('io');
    if (io) {
      io.to('lecturers').emit('projectDeleted', req.params.projectId);  //sent to lecturers room that we deleted a file
    }

    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// API Endpoint to update project (for checklist and overrides)
router.patch('/:projectId', express.json(), async (req, res) => {
  try {
    const { checkedChecklistIds, studentOverrides } = req.body; //we get these files from the body of the reques with is now a JS object

    const updateData = {};
    if (checkedChecklistIds !== undefined) {  //if this value was sent by the client
      updateData.checkedChecklistIds = checkedChecklistIds; //setting  the new values after change
    }
    if (studentOverrides !== undefined) {
      updateData.studentOverrides = studentOverrides;
    }

    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      { $set: updateData }, // MongoDB language : change only the fields that are inside  "updateData" (checkedChecklistIds,studentOverrides)
      { returnDocument: 'after' } // Returns the updated document, instead of before as it does in defult
    );

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const io = req.app.get('io');
    if (io) {
      io.to(`project_${req.params.projectId}`).emit('projectUpdated', project); // students viewing this project
      io.to('lecturers').emit('projectUpdated', project); // lecturers on the dashboardroom, they joined that room in index.js
    }

    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

module.exports = router;  //exporting the router object
