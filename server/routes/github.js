/**
 * GitHub proxy routes — expose a project's repository contents to the client.
 *
 * The browser never calls GitHub directly: it goes through here so the server's
 * GitHub token (higher rate limit) is used and binary files can be proxied.
 * Mounted at /api/projects.
 */
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { getRepoContext, fetchRepoTree, toRawUrl, githubFetch } = require('../services/github');

// API Endpoint to get the GitHub file tree
router.get('/:projectId/github/tree', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // 1. Get default branch
    const ctx = await getRepoContext(project.githubUrl);
    if (!ctx) return res.status(400).json({ error: 'Invalid GitHub URL' });

    // 2. Get tree (recursive)
    let flatTree = await fetchRepoTree(ctx);

    // If the project targets a subfolder, keep only entries under it and strip
    // the prefix so the client sees paths relative to that subfolder as the root.
    if (ctx.subpath) {
      const prefix = ctx.subpath + '/';
      flatTree = flatTree
        .filter(item => item.path.startsWith(prefix))
        .map(item => ({ ...item, path: item.path.substring(prefix.length) }));
    }

    // 3. Convert flat tree to nested structure
    const tree = [];
    const map = {};

    flatTree.forEach(item => {
      const parts = item.path.split('/');
      const name = parts.pop();
      const parentPath = parts.join('/');

      const node = {
        name,
        path: item.path,
        type: item.type === 'tree' ? 'folder' : 'file',
        size: item.size
      };
      if (node.type === 'folder') node.children = [];

      map[item.path] = node;

      if (parentPath === '') {
        tree.push(node); // top-level entry
      } else if (map[parentPath]) {
        map[parentPath].children.push(node);
      }
    });

    res.json(tree);
  } catch (error) {
    console.error('GitHub API error (tree):', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch GitHub repository data' });
  }
});

// API Endpoint to get file content or proxy binary files (like images)
router.get('/:projectId/github/file', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // 1. Get default branch
    const ctx = await getRepoContext(project.githubUrl);
    if (!ctx) return res.status(400).json({ error: 'Invalid GitHub URL' });

    // 2. Fetch raw file
    const fileRes = await githubFetch(toRawUrl(ctx, filePath));
    if (!fileRes.ok) {
      return res.status(fileRes.status).json({ error: 'Failed to fetch file content' });
    }

    const contentType = fileRes.headers.get('content-type') || 'text/plain';

    if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
      // Check if it's an image or binary file
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    } else {
      // Return as raw text for code files
      const content = await fileRes.text();
      res.setHeader('Content-Type', 'text/plain');
      res.send(content);
    }
  } catch (error) {
    console.error('GitHub API error (file):', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch file content' });
  }
});

module.exports = router;
