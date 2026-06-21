function parseGithubUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      let branch = null;
      let subpath = null;
      
      if (parts.length >= 4 && parts[2] === 'tree') {
        branch = parts[3];
        subpath = parts.slice(4).join('/') || null;
      }
      
      return { 
        owner: parts[0], 
        repo: parts[1].replace('.git', ''),
        branch,
        subpath
      };
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

module.exports = {
  parseGithubUrl,
  githubFetch
};
