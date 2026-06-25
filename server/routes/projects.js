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

// --- File upload setup (Multer) ---------------------------------------------
// Uploaded requirements docs are written to /uploads. We also read the file's
// text immediately on upload and persist it in the DB (see below), so the app
// no longer depends on this directory surviving a restart.
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // Prefix with a timestamp so concurrent uploads of the same filename don't collide.
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

/**
 * POST /api/projects/upload
 * Creates a project from a GitHub URL + a single requirements document.
 * `upload.single` runs first and saves the file before this handler executes.
 */
router.post('/upload', upload.single('requirementsDoc'), async (req, res) => {
  try {
    const { githubUrl } = req.body;
    const file = req.file; // populated by Multer

    if (!githubUrl || !file) {
      return res.status(400).json({ error: 'GitHub URL and Requirements Document are required.' });
    }

    // Capture the requirements text now and store it in the DB. Disk storage is
    // ephemeral on many hosts, so reading the file back later is unreliable.
    // (Plain-text/markdown read cleanly; binary formats like PDF degrade the
    // same way they did before — see the PDF-parsing note in the recommendations.)
    let requirementsText = '';
    try {
      requirementsText = fs.readFileSync(file.path, 'utf8');
    } catch (readErr) {
      console.warn('Could not read requirements file as text:', readErr.message);
    }

    const newProject = new Project({
      githubUrl,
      requirementsFileName: file.originalname,
      requirementsFilePath: file.path,
      requirementsText,
    });

    const savedProject = await newProject.save();

    // Notify any lecturers watching the dashboard that a new project arrived.
    const io = req.app.get('io');
    if (io) {
      io.to('lecturers').emit('projectCreated', savedProject);
    }

    res.status(201).json({
      message: 'Project uploaded successfully',
      projectId: savedProject._id,
    });
  } catch (error) {
    console.error('Error uploading project:', error);
    res.status(500).json({ error: 'Failed to upload project' });
  }
});

/**
 * GET /api/projects  (lecturer-only)
 * Lists every project, newest first, for the dashboard.
 */
router.get('/', protectLecturerRoute, async (req, res) => {
  try {
    const projects = await Project.find().sort({ uploadedAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching all projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/:projectId
 * Returns a single project. Open so the student workspace can load without auth.
 */
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

/**
 * DELETE /api/projects/:projectId  (lecturer-only)
 * Removes the project, its chat messages, and the requirements file on disk.
 */
router.delete('/:projectId', protectLecturerRoute, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Remove associated chat history first, then the project document.
    await Message.deleteMany({ projectId: req.params.projectId });
    await Project.findByIdAndDelete(req.params.projectId);

    // Best-effort cleanup of the uploaded file.
    if (project.requirementsFilePath && fs.existsSync(project.requirementsFilePath)) {
      fs.unlinkSync(project.requirementsFilePath);
    }

    const io = req.app.get('io');
    if (io) {
      io.to('lecturers').emit('projectDeleted', req.params.projectId);
    }

    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * PATCH /api/projects/:projectId
 * Updates review state: which checklist categories are ticked, and the per-
 * category overrides/comments. Only the fields present in the body are touched.
 * Broadcasts the new state to the project room (other viewers) and to lecturers.
 */
router.patch('/:projectId', express.json(), async (req, res) => {
  try {
    const { checkedChecklistIds, studentOverrides } = req.body;

    // Build a partial update so we never clobber a field the client didn't send.
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
      { returnDocument: 'after' } // return the updated doc, not the pre-update one
    );

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const io = req.app.get('io');
    if (io) {
      io.to(`project_${req.params.projectId}`).emit('projectUpdated', project);
      io.to('lecturers').emit('projectUpdated', project);
    }

    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

module.exports = router;
