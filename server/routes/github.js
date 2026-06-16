const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { parseGithubUrl, githubFetch } = require('../services/github');

// API Endpoint to get the GitHub file tree
router.get('/:projectId/github/tree', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const repoInfo = parseGithubUrl(project.githubUrl);
    if (!repoInfo) return res.status(400).json({ error: 'Invalid GitHub URL' });

    // 1. Get default branch
    const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
    if (!repoRes.ok) return res.status(repoRes.status).json({ error: 'Failed to fetch repo info' });
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';

    // 2. Get tree (recursive)
    const treeRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branch}?recursive=1`);
    if (!treeRes.ok) return res.status(treeRes.status).json({ error: 'Failed to fetch repo tree' });
    const treeData = await treeRes.json();

    // 3. Convert flat tree to nested structure
    const tree = [];
    const map = {};

    treeData.tree.forEach(item => {
      const parts = item.path.split('/');
      const name = parts.pop();
      const parentPath = parts.join('/');
      
      const node = {
        name,
        path: item.path,
        type: item.type === 'tree' ? 'folder' : 'file',
        size: item.size
      };

      if (node.type === 'folder') {
        node.children = [];
      }

      map[item.path] = node;

      if (parentPath === '') {
        tree.push(node);
      } else {
        if (map[parentPath]) {
          map[parentPath].children.push(node);
        }
      }
    });

    res.json(tree);
  } catch (error) {
    console.error('GitHub API error:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub repository data' });
  }
});

// API Endpoint to get file content or proxy binary files (like images)
router.get('/:projectId/github/file', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const repoInfo = parseGithubUrl(project.githubUrl);
    if (!repoInfo) return res.status(400).json({ error: 'Invalid GitHub URL' });

    // 1. Get default branch
    const repoRes = await githubFetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
    if (!repoRes.ok) return res.status(repoRes.status).json({ error: 'Failed to fetch repo info' });
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';

    // 2. Fetch raw file
    const fileUrl = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}/${filePath}`;
    const fileRes = await githubFetch(fileUrl);
    
    if (!fileRes.ok) {
      return res.status(fileRes.status).json({ error: 'Failed to fetch file content' });
    }

    const contentType = fileRes.headers.get('content-type') || 'text/plain';

    // Check if it's an image or binary file
    if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
      const arrayBuffer = await fileRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    } else {
      // Return as raw text for code files
      const content = await fileRes.text();
      res.setHeader('Content-Type', 'text/plain');
      res.send(content);
    }
  } catch (error) {
    console.error('GitHub API error:', error);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
});

module.exports = router;
