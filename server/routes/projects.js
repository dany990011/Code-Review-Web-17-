const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Project = require('../models/Project');
const Message = require('../models/Message');

// Set up Multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// API Endpoint to handle project upload
router.post('/upload', upload.single('requirementsDoc'), async (req, res) => {
  try {
    const { githubUrl } = req.body;
    const file = req.file;

    if (!githubUrl || !file) {
      return res.status(400).json({ error: 'GitHub URL and Requirements Document are required.' });
    }

    const newProject = new Project({
      githubUrl,
      requirementsFileName: file.originalname,
      requirementsFilePath: file.path,
    });

    const savedProject = await newProject.save();

    res.status(201).json({
      message: 'Project uploaded successfully',
      projectId: savedProject._id,
    });
  } catch (error) {
    console.error('Error uploading project:', error);
    res.status(500).json({ error: 'Failed to upload project' });
  }
});

// API Endpoint to get all projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ uploadedAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching all projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// API Endpoint to get project details
router.get('/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// API Endpoint to delete a project
router.delete('/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // Delete associated messages
    await Message.deleteMany({ projectId: req.params.projectId });
    
    // Delete the project
    await Project.findByIdAndDelete(req.params.projectId);
    
    // Optionally delete the physical file
    if (project.requirementsFilePath && fs.existsSync(project.requirementsFilePath)) {
      fs.unlinkSync(project.requirementsFilePath);
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
    const { checkedChecklistIds, studentOverrides } = req.body;
    
    const updateData = {};
    if (checkedChecklistIds !== undefined) {
      updateData.checkedChecklistIds = checkedChecklistIds;
    }
    if (studentOverrides !== undefined) {
      updateData.studentOverrides = studentOverrides;
    }

    const project = await Project.findByIdAndUpdate(
      req.params.projectId, 
      { $set: updateData }, 
      { returnDocument: 'after' } // Returns the updated document
    );

    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

module.exports = router;
