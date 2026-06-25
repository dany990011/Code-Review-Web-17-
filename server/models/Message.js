const mongoose = require('mongoose');

/**
 * A single chat turn in a project's Socratic review conversation. Persisted so
 * the conversation (and the AI's context) survives page reloads, and so history
 * can be replayed to Gemini on each new turn.
 */
const MessageSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  // 'user' = the student; 'assistant' = the Gemini tutor. (The transient 'error'
  // bubbles shown in the UI are client-only and are never persisted here.)
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  // If the message was asked about a specific line of code, that line number;
  // used to render the "Line N" badge and to give the AI positional context.
  contextLine: {
    type: Number,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Message', MessageSchema);
