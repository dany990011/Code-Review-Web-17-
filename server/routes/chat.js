const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Message = require('../models/Message');
const { genAI } = require('../services/ai');
const { parseGithubUrl, githubFetch } = require('../services/github');

// API Endpoint to get chat messages
router.get('/:projectId/messages', async (req, res) => {
  try {
    const messages = await Message.find({ projectId: req.params.projectId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// API Endpoint to manually save a message (e.g., initial system message)
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

// API Endpoint for generating AI response and saving chat
router.post('/:projectId/chat', express.json(), async (req, res) => {
  try {
    const { text, contextLine, activeFile } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required.' });
    }

    // 1. Save User Message
    const userMessage = new Message({
      projectId: req.params.projectId,
      role: 'user',
      content: text,
      contextLine: contextLine || null,
    });
    await userMessage.save();

    // 2. Fetch Chat History for context
    const history = await Message.find({ projectId: req.params.projectId }).sort({ timestamp: 1 });
    
    // Map history to Gemini format (user or model)
    const geminiHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.contextLine ? `[Line ${msg.contextLine}] ${msg.content}` : msg.content }]
    }));
    // Remove the very last message (the one we just saved) as it will be passed to sendMessage
    geminiHistory.pop();

    // Gemini strictly requires the first message in history to be from the 'user'.
    // Since our DB saves the bot's "Welcome" message first, we prepend a dummy user message.
    if (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
      geminiHistory.unshift({
        role: 'user',
        parts: [{ text: "Hello, I am ready to start my code review session." }]
      });
    }

    // 3. Initialize Gemini Chat Session
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "You are a Socratic Code Review tutor. Never give direct answers. Ask guiding questions to help the student find bugs and improve code quality. If the user asks a general coding question but hasn't selected a file or line of code (which will be indicated in the System Context), politely ask them to click on a specific file or line number in the workspace so you can discuss it together.",
    });

    const chat = model.startChat({
      history: geminiHistory,
    });

    // 4. Inject Active File Context & Send Message to Gemini
    let fileContentStr = "";
    if (activeFile) {
      try {
        const project = await Project.findById(req.params.projectId);
        if (project) {
          const repoInfo = parseGithubUrl(project.githubUrl);
          const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
          const repoData = await repoRes.json();
          const branch = repoData.default_branch || 'main';
          const fileRes = await githubFetch(`https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}/${activeFile}`);
          if (fileRes.ok) {
            const rawCode = await fileRes.text();
            const numberedCode = rawCode.split('\n').map((line, i) => `${i + 1}: ${line}`).join('\n');
            fileContentStr = `[System Context: The user is currently viewing the file '${activeFile}'. Here is the code:]\n\`\`\`\n${numberedCode}\n\`\`\`\n\n`;
          }
        }
      } catch (err) {
        console.error("Failed to fetch active file context:", err);
      }
    }

    const promptText = fileContentStr + (contextLine ? `[User Message for Line ${contextLine}]: ${text}` : `[User Message]: ${text}`);
    const result = await chat.sendMessage(promptText);
    const botResponseText = result.response.text();

    // 5. Save Bot Message
    const botMessage = new Message({
      projectId: req.params.projectId,
      role: 'assistant',
      content: botResponseText,
    });
    await botMessage.save();

    res.json({
      userMessage,
      botMessage
    });
  } catch (error) {
    console.error('Error in chat generation:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

module.exports = router;
