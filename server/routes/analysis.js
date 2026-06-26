/**
 * Analysis routes — the two AI-powered audits.
 *
 *  - POST /:projectId/analyze            -> 12-category "Socratic scorecard"
 *  - POST /:projectId/check-requirements -> compliance vs. the requirements doc
 *
 * Both pull the repo's code via the shared GitHub service (so branch/subpath are
 * handled identically) and call Gemini through the key-pool failover helper.
 * Both are rate limited because each call is expensive and the routes are open.
 * Mounted at /api/projects.
 */
const express = require('express');
const fs = require('fs');
const router = express.Router();
const Project = require('../models/Project');
const { executeWithFallback } = require('../services/ai');
const { getRepoContext, fetchRepoTree, toRawUrl, githubFetch } = require('../services/github');
const rateLimit = require('../middleware/rateLimit');
const { extractRequirementsText } = require('../services/requirements');

// File types worth sending to the model, and directories never worth sending.
const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rb', '.php', '.html', '.css', '.json'];
const SKIP_DIRS = ['node_modules', 'dist', 'build'];

// Per-IP throttle shared by both AI endpoints. Generous enough for legitimate
// re-runs, low enough to stop a runaway loop from draining the Gemini quota.
// NOTE: keyed by IP, so a whole class behind one NAT shares the budget — tune
// `max` for your cohort, or switch to auth-based keying if that becomes a problem.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40,
  message: 'Too many AI requests from this network. Please wait a few minutes and try again.'
});

/**
 * Selects the code files to feed the model: right extension, not in a build dir,
 * within the review subpath (with the prefix stripped to repo-root-relative
 * paths), capped at `limit` to bound the prompt size.
 */
function selectCodeFiles(flatTree, ctx, limit) {
  let files = flatTree.filter(item =>
    item.type === 'blob' &&
    CODE_EXTENSIONS.some(ext => item.path.endsWith(ext)) &&
    !SKIP_DIRS.some(dir => item.path.includes(dir))
  );

  if (ctx.subpath) {
    const prefix = ctx.subpath + '/';
    files = files
      .filter(item => item.path.startsWith(prefix))
      .map(item => ({ ...item, path: item.path.substring(prefix.length) }));
  }

  return files.slice(0, limit);
}

/**
 * Fetches the selected files concurrently and concatenates them into one
 * labelled blob for the prompt. `numbered` prefixes each line with its number
 * so the model can cite exact line numbers in its findings.
 */
async function fetchCodebaseText(ctx, files, { numbered }) {
  const parts = await Promise.all(files.map(async (file) => {
    const fileRes = await githubFetch(toRawUrl(ctx, file.path));
    if (!fileRes.ok) return '';
    const code = await fileRes.text();
    const body = numbered
      ? code.split('\n').map((line, i) => `${i + 1}: ${line}`).join('\n')
      : code;
    return `\n--- FILE: ${file.path} ---\n${body}\n`;
  }));
  return parts.join('');
}

/**
 * Gemini is asked to return raw JSON, but sometimes wraps it in a ```json fence.
 * Strip the fence, then parse — throwing a clean error the caller maps to a 502.
 */
function parseAiJson(aiText) {
  const cleaned = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const err = new Error('AI returned malformed JSON');
    err.code = 'AI_BAD_JSON';
    throw err;
  }
}

/** Maps known failure modes to a tidy HTTP response; returns true if it handled it. */
function handleAiError(res, error, fallbackMsg) {
  if (error.code === 'AI_BAD_JSON') {
    res.status(502).json({ error: 'The AI returned an unexpected response. Please try again.' });
    return true;
  }
  if (error.message && error.message.includes('503')) {
    res.status(503).json({ error: 'The AI model is currently experiencing high demand. Please try again in a few moments.' });
    return true;
  }
  if (error.status) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  res.status(500).json({ error: fallbackMsg });
  return true;
}

// API Endpoint to run deep analysis
router.post('/:projectId/analyze', aiLimiter, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // 1. Get default branch & tree
    const ctx = await getRepoContext(project.githubUrl);
    if (!ctx) return res.status(400).json({ error: 'Invalid GitHub URL' });

    const tree = await fetchRepoTree(ctx);
    // Filter to code files only
    // Analyze more files to get a comprehensive view
    const files = selectCodeFiles(tree, ctx, 100); // broad view of the project
    // 2. Fetch code for these files concurrently for better performance
    const fullCodebase = await fetchCodebaseText(ctx, files, { numbered: true });

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
${fullCodebase.slice(0, 1000000)}
`;

    // 4. Run AI Analysis
    const aiText = await executeWithFallback(async (genAI) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    // Clean up markdown formatting if returned
    const analysisResults = parseAiJson(aiText);

    // 5. Save results to DB
    project.analysisResults = analysisResults;
    await project.save();

    // Push the fresh scorecard to everyone viewing this project + the dashboard.
    const io = req.app.get('io');
    if (io) {
      io.to(`project_${project._id}`).emit('projectUpdated', project);
      io.to('lecturers').emit('projectUpdated', project);
    }

    res.json(analysisResults);
  } catch (error) {
    console.error('Error analyzing project:', error);
    handleAiError(res, error, 'Failed to analyze project');
  }
});

// API Endpoint to check requirements against codebase
router.post('/:projectId/check-requirements', aiLimiter, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Prefer the requirements text stored in the DB; fall back to the on-disk
    // file for projects uploaded before that field existed.
    let requirementsText = project.requirementsText;
    if (!requirementsText && project.requirementsFilePath && fs.existsSync(project.requirementsFilePath)) {
      requirementsText = await extractRequirementsText(project.requirementsFilePath, project.requirementsFileName);
    }
    if (!requirementsText) {
      return res.status(400).json({ error: 'Requirements document not found.' });
    }

    // 1. Get default branch & tree
    const ctx = await getRepoContext(project.githubUrl);
    if (!ctx) return res.status(400).json({ error: 'Invalid GitHub URL' });

    const tree = await fetchRepoTree(ctx);
    // Filter to code files only
    // Take top 15 files to avoid massive context
    const files = selectCodeFiles(tree, ctx, 15); // smaller sample to bound context
    // 2. Fetch code for these files
    const fullCodebase = await fetchCodebaseText(ctx, files, { numbered: false });

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
    const aiText = await executeWithFallback(async (genAI) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    // Clean up markdown formatting if returned
    const requirementsResults = parseAiJson(aiText);

    // Save to DB
    project.requirementsCheckResults = requirementsResults;
    await project.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`project_${project._id}`).emit('projectUpdated', project);
      io.to('lecturers').emit('projectUpdated', project);
    }

    res.json(requirementsResults);
  } catch (error) {
    console.error('Error checking requirements:', error);
    handleAiError(res, error, 'Failed to check requirements');
  }
});

module.exports = router;
