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

/**
 * GET /:projectId/github/tree
 * Returns the repo's files as a nested folder/file tree for the File Explorer.
 */
router.get('/:projectId/github/tree', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Resolve owner/repo/branch/subpath once (handles default-branch lookup).
    const ctx = await getRepoContext(project.githubUrl);
    if (!ctx) return res.status(400).json({ error: 'Invalid GitHub URL' });

    let flatTree = await fetchRepoTree(ctx);

    // If the project targets a subfolder, keep only entries under it and strip
    // the prefix so the client sees paths relative to that subfolder as the root.
    if (ctx.subpath) {
      const prefix = ctx.subpath + '/';
      flatTree = flatTree
        .filter(item => item.path.startsWith(prefix))
        .map(item => ({ ...item, path: item.path.substring(prefix.length) }));
    }

    // Convert GitHub's flat path list into a nested tree.
    // `map` indexes every node by its full path so we can attach each child to
    // its parent in a single pass (the recursive tree lists parents before children).
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

/**
 * GET /:projectId/github/file?path=...
 * Returns one file's contents. Text files come back as raw text; images and
 * other binaries are streamed through with their original content-type so the
 * client can render them (e.g. <img src=...>).
 */
router.get('/:projectId/github/file', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const ctx = await getRepoContext(project.githubUrl);
    if (!ctx) return res.status(400).json({ error: 'Invalid GitHub URL' });

    const fileRes = await githubFetch(toRawUrl(ctx, filePath));
    if (!fileRes.ok) {
      return res.status(fileRes.status).json({ error: 'Failed to fetch file content' });
    }

    const contentType = fileRes.headers.get('content-type') || 'text/plain';

    if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
      // Binary: forward the bytes untouched.
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    } else {
      // Text/code: return as plain text for the syntax highlighter.
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
