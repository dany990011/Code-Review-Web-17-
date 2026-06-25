/**
 * Chat routes — the Socratic tutoring conversation for a project.
 *
 *  - GET  /:projectId/messages  -> full history
 *  - POST /:projectId/messages  -> persist a single message (e.g. the welcome msg)
 *  - POST /:projectId/chat      -> save the user turn, ask Gemini, save the reply
 *
 * Mounted at /api/projects.
 */
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Message = require('../models/Message');
const { executeWithFallback } = require('../services/ai');
const { getRepoContext, toRawUrl, githubFetch } = require('../services/github');
const rateLimit = require('../middleware/rateLimit');

// Chat is an AI call too, so it's throttled — but more generously than the
// analysis routes since a normal tutoring session is many short turns.
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  message: 'Too many chat messages from this network. Please wait a moment and try again.'
});

/** GET /:projectId/messages — conversation history, oldest first. */
router.get('/:projectId/messages', async (req, res) => {
  try {
    const messages = await Message.find({ projectId: req.params.projectId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/** POST /:projectId/messages — persist one message directly (used for the seed welcome message). */
router.post('/:projectId/messages', express.json(), async (req, res) => {
  try {
    const message = new Message({
      projectId: req.params.projectId,
      role: req.body.role,
      content: req.body.content,
      contextLine: req.body.contextLine || null
    });
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

/**
 * POST /:projectId/chat
 * Saves the student's message, replays the conversation to Gemini (optionally
 * with the currently-open file injected as context), saves the reply, and
 * returns both turns.
 */
router.post('/:projectId/chat', chatLimiter, express.json(), async (req, res) => {
  try {
    const { text, contextLine, activeFile } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required.' });
    }

    // 1. Persist the user's message.
    const userMessage = new Message({
      projectId: req.params.projectId,
      role: 'user',
      content: text,
      contextLine: contextLine || null,
    });
    await userMessage.save();

    // 2. Build the history Gemini expects (its roles are 'user' / 'model').
    const history = await Message.find({ projectId: req.params.projectId }).sort({ timestamp: 1 });
    const geminiHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.contextLine ? `[Line ${msg.contextLine}] ${msg.content}` : msg.content }]
    }));
    // The turn we just saved is sent separately via sendMessage(), so drop it here.
    geminiHistory.pop();

    // Gemini requires history to start with a 'user' turn, but our first stored
    // message is the assistant's welcome. Prepend a synthetic user turn if so.
    if (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
      geminiHistory.unshift({
        role: 'user',
        parts: [{ text: 'Hello, I am ready to start my code review session.' }]
      });
    }

    // 3. Optionally inject the open file so the tutor can reason about real code.
    //    Best-effort: any failure here just means we send the message without it.
    let fileContentStr = '';
    if (activeFile) {
      try {
        const project = await Project.findById(req.params.projectId);
        const ctx = project ? await getRepoContext(project.githubUrl) : null;
        if (ctx) {
          const fileRes = await githubFetch(toRawUrl(ctx, activeFile));
          if (fileRes.ok) {
            const rawCode = await fileRes.text();
            const numberedCode = rawCode.split('\n').map((line, i) => `${i + 1}: ${line}`).join('\n');
            fileContentStr = `[System Context: The user is currently viewing the file '${activeFile}'. Here is the code:]\n\`\`\`\n${numberedCode}\n\`\`\`\n\n`;
          }
        }
      } catch (err) {
        console.error('Failed to fetch active file context:', err);
      }
    }

    const promptText = fileContentStr + (contextLine ? `[User Message for Line ${contextLine}]: ${text}` : `[User Message]: ${text}`);

    // 4. Ask Gemini, keeping it in "Socratic tutor" mode via the system instruction.
    const result = await executeWithFallback(async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: "You are a Socratic Code Review tutor. Never give direct answers. Ask guiding questions to help the student find bugs and improve code quality. If the user asks a general coding question but hasn't selected a file or line of code (which will be indicated in the System Context), politely ask them to click on a specific file or line number in the workspace so you can discuss it together.",
      });
      const chat = model.startChat({ history: geminiHistory });
      return await chat.sendMessage(promptText);
    });

    const botResponseText = result.response.text();

    // 5. Persist the assistant's reply.
    const botMessage = new Message({
      projectId: req.params.projectId,
      role: 'assistant',
      content: botResponseText,
    });
    await botMessage.save();

    res.json({ userMessage, botMessage });
  } catch (error) {
    console.error('Error in chat generation:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

module.exports = router;
