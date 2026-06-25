const mongoose = require('mongoose');

/**
 * A review session: one student-submitted GitHub repo + the requirements doc it
 * is graded against, plus everything the review produces (AI analysis, the
 * requirements-compliance result, the lecturer/student checklist, and overrides).
 */
const ProjectSchema = new mongoose.Schema({
  // Repo under review. May be a deep URL (.../tree/<branch>/<subdir>) to target
  // a single folder; the GitHub service understands the branch/subpath form.
  githubUrl: {
    type: String,
    required: true,
  },
  // Original filename of the uploaded requirements document (for display only).
  requirementsFileName: {
    type: String,
    required: true,
  },
  // Where the uploaded file landed on disk. Kept for backwards compatibility and
  // as the source for `requirementsText`; see `requirementsText` for why we no
  // longer rely on the file being present at check time.
  requirementsFilePath: {
    type: String,
    required: true,
  },
  // The requirements text captured at upload time and stored *in the database*.
  // Disk storage is ephemeral on most hosts (a redeploy/restart wipes /uploads),
  // which previously made "check requirements" fail with "document not found".
  // Persisting the text here makes the check resilient to that.
  requirementsText: {
    type: String,
    default: ''
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  // AI scorecard: an array of 12 category results ({ category, rating, reasoning,
  // offendingFile, offendingLine }). Empty until "Run AI Analysis" is used.
  analysisResults: {
    type: Array,
    default: []
  },
  // Result of auditing the codebase against the requirements doc. Null until run.
  requirementsCheckResults: {
    type: Object,
    default: null
  },
  // Ids (1-12) of the scorecard categories the reviewer has ticked off.
  checkedChecklistIds: {
    type: [Number],
    default: []
  },
  // Per-category overrides, keyed by category name:
  //   { [category]: { isNonIssue?: boolean, comment?: string } }
  // `isNonIssue` marks an AI finding as a false positive; `comment` is a note.
  studentOverrides: {
    type: Object,
    default: {}
  }
}, { timestamps: true }); // adds createdAt / updatedAt

module.exports = mongoose.model('Project', ProjectSchema);
