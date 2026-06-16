const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { genAI } = require('../services/ai');
const { parseGithubUrl, githubFetch } = require('../services/github');

// Helper to chunk text
function chunkText(text, maxChars = 30000) {
  const chunks = [];
  let currentChunk = "";
  const lines = text.split('\n');
  
  for (const line of lines) {
    if ((currentChunk.length + line.length) > maxChars) {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk);
  return chunks;
}

// API Endpoint to run deep analysis
router.post('/:projectId/analyze', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const repoInfo = parseGithubUrl(project.githubUrl);
    if (!repoInfo) return res.status(400).json({ error: 'Invalid GitHub URL' });

    // 1. Get default branch & tree
    const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
    if (!repoRes.ok) return res.status(repoRes.status).json({ error: 'Failed to fetch repo info' });
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';

    const treeRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branch}?recursive=1`);
    if (!treeRes.ok) return res.status(treeRes.status).json({ error: 'Failed to fetch repo tree' });
    const treeData = await treeRes.json();

    // Filter to code files only
    const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rb', '.php', '.html', '.css', '.json'];
    const files = treeData.tree.filter(item => 
      item.type === 'blob' && 
      validExtensions.some(ext => item.path.endsWith(ext)) &&
      !item.path.includes('node_modules') &&
      !item.path.includes('dist') &&
      !item.path.includes('build')
    );

    // Take top 15 files (arbitrary limit to avoid massive context)
    const filesToAnalyze = files.slice(0, 15);
    
    // 2. Fetch code for these files
    let fullCodebase = "";
    for (const file of filesToAnalyze) {
      const fileRes = await githubFetch(`https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}/${file.path}`);
      if (fileRes.ok) {
        const code = await fileRes.text();
        const numberedCode = code.split('\n').map((line, i) => `${i + 1}: ${line}`).join('\n');
        fullCodebase += `\n--- FILE: ${file.path} ---\n${numberedCode}\n`;
      }
    }

    // 3. Prepare AI Prompt
    const prompt = `You are a strict technical code reviewer grading a student project.
Analyze the following codebase and grade it strictly across exactly 12 categories:
Security, Performance, Readability, Architecture, Testing, Error Handling, State Management, Accessibility, Documentation, Scalability, Best Practices, Reusability.

For each category, provide:
1. rating: A score out of 10.
2. reasoning: A harsh but fair explanation of why they lost points.
3. offendingFile: The exact file path where the worst violation occurred. (Use null if no file applies).
4. offendingLine: The line number of the worst violation. (Use null if no specific line applies).

Return ONLY a valid JSON array of exactly 12 objects, each containing: category, rating, reasoning, offendingFile, offendingLine.

Codebase:
${fullCodebase.slice(0, 50000)} // Hard cap at 50k chars for safety
`;

    // 4. Run AI Analysis
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    let aiText = result.response.text();
    
    // Clean up markdown formatting if returned
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

    const analysisResults = JSON.parse(aiText);

    // 5. Save results to DB
    project.analysisResults = analysisResults;
    await project.save();

    res.json(analysisResults);
  } catch (error) {
    console.error('Error analyzing project:', error);
    if (error.message && error.message.includes('503')) {
      return res.status(503).json({ error: 'The AI model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few moments.' });
    }
    res.status(500).json({ error: 'Failed to analyze project' });
  }
});

// API Endpoint to check requirements against codebase
router.post('/:projectId/check-requirements', async (req, res) => {
  const fs = require('fs');
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    let requirementsText = "";
    if (project.requirementsFilePath && fs.existsSync(project.requirementsFilePath)) {
      requirementsText = fs.readFileSync(project.requirementsFilePath, 'utf8');
    } else {
      return res.status(400).json({ error: 'Requirements document not found on server.' });
    }

    const repoInfo = parseGithubUrl(project.githubUrl);
    if (!repoInfo) return res.status(400).json({ error: 'Invalid GitHub URL' });

    // 1. Get default branch & tree
    const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
    if (!repoRes.ok) return res.status(repoRes.status).json({ error: 'Failed to fetch repo info' });
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';

    const treeRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branch}?recursive=1`);
    if (!treeRes.ok) return res.status(treeRes.status).json({ error: 'Failed to fetch repo tree' });
    const treeData = await treeRes.json();

    // Filter to code files only
    const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rb', '.php', '.html', '.css', '.json'];
    const files = treeData.tree.filter(item => 
      item.type === 'blob' && 
      validExtensions.some(ext => item.path.endsWith(ext)) &&
      !item.path.includes('node_modules') &&
      !item.path.includes('dist') &&
      !item.path.includes('build')
    );

    // Take top 15 files to avoid massive context
    const filesToAnalyze = files.slice(0, 15);
    
    // 2. Fetch code for these files
    let fullCodebase = "";
    for (const file of filesToAnalyze) {
      const fileRes = await githubFetch(`https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}/${file.path}`);
      if (fileRes.ok) {
        const code = await fileRes.text();
        fullCodebase += `\n--- FILE: ${file.path} ---\n${code}\n`;
      }
    }

    // 3. Prepare AI Prompt
    const prompt = `You are an expert technical auditor.
I will provide you with a requirements document and a codebase.
Compare the codebase against the requirements document and determine compliance.

REQUIREMENTS DOCUMENT:
${requirementsText.slice(0, 10000)}

CODEBASE:
${fullCodebase.slice(0, 50000)}

Return ONLY a valid JSON object matching exactly this structure:
{
  "overallStatus": "Pass" | "Partial" | "Fail",
  "score": <number 0-100>,
  "summary": "<string explaining the result>",
  "criticalIssues": ["<string issue>", ...],
  "missingFeatures": ["<string missing feature>", ...],
  "implementedFeatures": ["<string implemented feature>", ...]
}
`;

    // 4. Run AI Analysis
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    let aiText = result.response.text();
    
    // Clean up markdown formatting if returned
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

    const requirementsResults = JSON.parse(aiText);

    // Save to DB
    project.requirementsCheckResults = requirementsResults;
    await project.save();

    res.json(requirementsResults);
  } catch (error) {
    console.error('Error checking requirements:', error);
    if (error.message && error.message.includes('503')) {
      return res.status(503).json({ error: 'The AI model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few moments.' });
    }
    res.status(500).json({ error: 'Failed to check requirements' });
  }
});

module.exports = router;
