const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const connectDB = require('./db');
const Project = require('./models/Project');
const Message = require('./models/Message');

// Connect to MongoDB
connectDB();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

function parseGithubUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1].replace('.git', '') };
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Wrapper for GitHub API requests to optionally include PAT for higher rate limits
async function githubFetch(url, options = {}) {
  const headers = { ...options.headers };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(url, { ...options, headers });
}

const app = express();
app.use(cors());
app.use(express.json());

// Set up Multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
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
app.post('/api/projects/upload', upload.single('requirementsDoc'), async (req, res) => {
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

// API Endpoint to get project details
app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// API Endpoint to get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ uploadedAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching all projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// API Endpoint to delete a project
app.delete('/api/projects/:projectId', async (req, res) => {
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

// API Endpoint to get chat messages
app.get('/api/projects/:projectId/messages', async (req, res) => {
  try {
    const messages = await Message.find({ projectId: req.params.projectId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// API Endpoint for generating AI response and saving chat
app.post('/api/projects/:projectId/chat', async (req, res) => {
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
      systemInstruction: "You are a Socratic Code Review tutor. Never give direct answers. Ask guiding questions to help the student find bugs and improve code quality.",
    });

    const chat = model.startChat({
      history: geminiHistory,
    });

    // 4. Inject Active File Context & Send Message to Gemini
    let fileContentStr = "";
    if (activeFile) {
      try {
        const project = await Project.findById(req.params.projectId);
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
      contextLine: contextLine || null,
    });
    await botMessage.save();

    res.status(201).json({ userMessage, botMessage });
  } catch (error) {
    console.error('Error generating chat response:', error);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
});

// API Endpoint for automated codebase analysis
app.post('/api/projects/:projectId/analyze', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // 1. Fetch Repository Tree
    const repoInfo = parseGithubUrl(project.githubUrl);
    if (!repoInfo) return res.status(400).json({ error: 'Invalid GitHub URL' });

    const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
    if (!repoRes.ok) {
      console.error("GitHub API Error (Repo):", await repoRes.text());
      return res.status(500).json({ error: 'Failed to fetch repository from GitHub. (Rate limit exceeded or invalid URL)' });
    }
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';

    const treeRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branch}?recursive=1`);
    if (!treeRes.ok) {
      console.error("GitHub API Error (Tree):", await treeRes.text());
      return res.status(500).json({ error: 'Failed to fetch repository tree from GitHub.' });
    }
    const treeData = await treeRes.json();
    
    if (!treeData.tree) {
      return res.status(500).json({ error: 'GitHub API returned an invalid tree structure.' });
    }

    // 2. Filter for relevant code files (limit to 15 to avoid massive payloads)
    const validExtensions = /\.(js|jsx|ts|tsx|css|html|py|java|cpp|c|cs|go|rb|php|swift|kt|rs)$/i;
    const ignorePaths = /node_modules|package-lock\.json|\bdist\b|\bbuild\b|\.min\./i;
    
    const validFiles = treeData.tree
      .filter(item => item.type === 'blob' && validExtensions.test(item.path) && !ignorePaths.test(item.path))
      .slice(0, 15);

    console.log(`[Analysis] Found ${validFiles.length} valid code files out of ${treeData.tree.length} total items in tree.`);

    if (validFiles.length === 0) {
      console.log(`[Analysis] Filtered out all files! Here are the first few paths found:`, treeData.tree.slice(0, 5).map(f => f.path));
      return res.status(400).json({ error: 'No relevant source code files found in this repository. Ensure it contains standard code files and is not empty.' });
    }

    // 3. Fetch Raw Code for all valid files
    const fileContents = await Promise.all(validFiles.map(async file => {
      console.log(`[Analysis] Fetching raw code for: ${file.path}`);
      const res = await githubFetch(`https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}/${file.path}`);
      if (!res.ok) {
        console.log(`[Analysis] FAILED to fetch ${file.path} - Status: ${res.status}`);
        return '';
      }
      const code = await res.text();
      return `--- FILE: ${file.path} ---\n${code}\n`;
    }));

    const fullCodebaseStr = fileContents.filter(Boolean).join('\n');
    console.log(`[Analysis] Successfully fetched ${fullCodebaseStr.length} bytes of raw code.`);
    
    if (!fullCodebaseStr.trim()) {
      return res.status(400).json({ error: 'Could not fetch code content from GitHub. The repository might be empty or you are rate-limited.' });
    }
    
    const validPaths = validFiles.map(f => f.path);

    // 4. Construct Prompt & Call Gemini
    const systemPrompt = `You are an expert AI Code Reviewer. Analyze the provided codebase and evaluate it against exactly these 12 categories: Security, Performance, Readability, Architecture, Testing, Error Handling, State Management, Accessibility, Documentation, Scalability, Best Practices, Reusability.
    
    For EACH category, assign a score from 0 to 10 (10 being perfect). Provide a 1-sentence reasoning. Identify the single worst offending file path, and the specific line number where the issue exists (if applicable, else null).
    
    CRITICAL: The 'offendingFile' MUST perfectly match one of the exact file paths provided below. Do NOT make up paths. If the issue is general or you cannot identify a specific file, set 'offendingFile' to null.
    
    VALID FILE PATHS:
    ${validPaths.join('\n')}
    
    IMPORTANT: You MUST return the result EXACTLY as a JSON array of objects. Do not include markdown formatting or backticks.
    Format: [{"category": "Security", "rating": 5, "reasoning": "Missing sanitization", "offendingFile": "${validPaths[0] || 'src/app.js'}", "offendingLine": 45}, ...]`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(`${systemPrompt}\n\n[CODEBASE]\n${fullCodebaseStr}`);
    const responseText = result.response.text();
    
    const analysisJson = JSON.parse(responseText);

    // Sanitize output to absolutely prevent UI crashes from AI hallucinations
    analysisJson.forEach(item => {
      if (item.offendingFile && !validPaths.includes(item.offendingFile)) {
        // Try to find a loose match (e.g. AI returned 'App.jsx' instead of 'src/App.jsx')
        const looseMatch = validPaths.find(p => p.toLowerCase().endsWith(item.offendingFile.toLowerCase().replace(/^\/+/, '')));
        item.offendingFile = looseMatch || null;
        if (!item.offendingFile) item.offendingLine = null;
      }
    });

    // 5. Save to Database
    project.analysisResults = analysisJson;
    await project.save();

    res.json(analysisJson);
  } catch (error) {
    console.error('Error during analysis:', error);
    res.status(500).json({ error: 'Failed to analyze codebase' });
  }
});

// API Endpoint for requirements checking
app.post('/api/projects/:projectId/check-requirements', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (!fs.existsSync(project.requirementsFilePath)) {
      return res.status(400).json({ error: 'Requirements document not found on server.' });
    }

    const ext = path.extname(project.requirementsFileName).toLowerCase();
    
    // Convert doc to inlineData format
    const docBuffer = fs.readFileSync(project.requirementsFilePath);
    const base64Doc = docBuffer.toString('base64');
    
    let mimeType = 'text/plain';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.docx') return res.status(400).json({ error: 'DOCX files are not directly supported by the Gemini vision engine via this method. Please recreate the project and upload a PDF or text file.' });
    
    const documentPart = {
      inlineData: {
        data: base64Doc,
        mimeType
      }
    };

    // Fetch Repository Tree
    const repoInfo = parseGithubUrl(project.githubUrl);
    if (!repoInfo) return res.status(400).json({ error: 'Invalid GitHub URL' });

    const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
    if (!repoRes.ok) return res.status(500).json({ error: 'Failed to fetch repository from GitHub.' });
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';

    const treeRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branch}?recursive=1`);
    if (!treeRes.ok) return res.status(500).json({ error: 'Failed to fetch repository tree from GitHub.' });
    const treeData = await treeRes.json();
    
    if (!treeData.tree) return res.status(500).json({ error: 'GitHub API returned an invalid tree structure.' });

    // Filter for relevant code files (limit to 15)
    const validExtensions = /\.(js|jsx|ts|tsx|css|html|py|java|cpp|c|cs|go|rb|php|swift|kt|rs)$/i;
    const ignorePaths = /node_modules|package-lock\.json|\bdist\b|\bbuild\b|\.min\./i;
    
    const validFiles = treeData.tree
      .filter(item => item.type === 'blob' && validExtensions.test(item.path) && !ignorePaths.test(item.path))
      .slice(0, 15);

    if (validFiles.length === 0) {
      return res.status(400).json({ error: 'No relevant source code files found in this repository.' });
    }

    // Fetch Raw Code
    const fileContents = await Promise.all(validFiles.map(async file => {
      const res = await githubFetch(`https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}/${file.path}`);
      if (!res.ok) return '';
      const code = await res.text();
      return `--- FILE: ${file.path} ---\n${code}\n`;
    }));

    const fullCodebaseStr = fileContents.filter(Boolean).join('\n');
    if (!fullCodebaseStr.trim()) {
      return res.status(400).json({ error: 'Could not fetch code content from GitHub.' });
    }

    const systemPrompt = `You are an expert AI software auditor. You have been provided with two things:
1. A Requirements Document (attached as a file)
2. A Codebase (attached as text below)

Analyze the codebase strictly against the provided requirements document. 
Determine what features have been implemented correctly, what features are missing, and provide an overall compliance status.

IMPORTANT: You MUST return the result EXACTLY as a JSON object with the following structure. Do not include markdown formatting or backticks.
{
  "overallStatus": "Pass" | "Partial" | "Fail",
  "score": 85,
  "summary": "The application meets most requirements, but lacks X and Y.",
  "implementedFeatures": ["feature 1", "feature 2"],
  "missingFeatures": ["missing feature 1", "missing feature 2"],
  "criticalIssues": ["critical issue 1", "critical issue 2"]
}`;

    // Note: use gemini-2.5-flash since we are passing multimodal inlineData
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent([
      systemPrompt + `\n\n[CODEBASE]\n${fullCodebaseStr}`,
      documentPart
    ]);
    
    const responseText = result.response.text();
    const analysisJson = JSON.parse(responseText);

    project.requirementsCheckResults = analysisJson;
    await project.save();

    res.json(analysisJson);
  } catch (error) {
    console.error('Error during requirements check:', error);
    res.status(500).json({ error: `Failed to perform requirements check: ${error.message}` });
  }
});

// GitHub API Proxy: Get Repository Tree
app.get('/api/projects/:projectId/github/tree', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const repoInfo = parseGithubUrl(project.githubUrl);
    if (!repoInfo) return res.status(400).json({ error: 'Invalid GitHub URL' });

    const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
    if (!repoRes.ok) return res.status(repoRes.status).json({ error: 'Failed to fetch repo info' });
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';

    const treeRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branch}?recursive=1`);
    if (!treeRes.ok) return res.status(treeRes.status).json({ error: 'Failed to fetch repo tree' });
    const treeData = await treeRes.json();

    const root = [];
    const map = {};

    treeData.tree.forEach(item => {
      const parts = item.path.split('/');
      const name = parts.pop();
      const isFolder = item.type === 'tree';
      
      const node = { name, type: isFolder ? 'folder' : 'file', path: item.path };
      if (isFolder) node.children = [];

      map[item.path] = node;

      if (parts.length === 0) {
        root.push(node);
      } else {
        const parentPath = parts.join('/');
        if (map[parentPath]) {
          map[parentPath].children.push(node);
        }
      }
    });

    res.json(root);
  } catch (error) {
    console.error('GitHub API error:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub tree' });
  }
});

// GitHub API Proxy: Get File Content
app.get('/api/projects/:projectId/github/file', async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: 'File path required' });

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const repoInfo = parseGithubUrl(project.githubUrl);
    if (!repoInfo) return res.status(400).json({ error: 'Invalid GitHub URL' });

    const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';

    const fileRes = await githubFetch(`https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}/${path}`);
    if (!fileRes.ok) return res.status(fileRes.status).json({ error: 'Failed to fetch file content' });
    
    const contentType = fileRes.headers.get('content-type');
    if (contentType) {
      res.set('Content-Type', contentType);
    }
    
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error('GitHub API error:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub file' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
