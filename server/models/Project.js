const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  githubUrl: {
    type: String,
    required: true,
  },
  requirementsFileName: {
    type: String,
    required: true,
  },
  requirementsFilePath: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  analysisResults: {
    type: Array,
    default: []
  },
  requirementsCheckResults: {
    type: Object,
    default: null
  }
});

module.exports = mongoose.model('Project', ProjectSchema);
