/**
 * GitHub integration service.
 *
 * Central place for everything that talks to GitHub. Routes (github / analysis /
 * chat) used to each re-implement the same "parse the URL -> resolve the branch
 * -> fetch the tree -> build a raw file URL" sequence. That duplication caused
 * real bugs (e.g. the requirements check ignored the branch/subpath that the
 * analyze route handled correctly). Routing all of them through these helpers
 * keeps the behavior identical everywhere.
 */

/**
 * Parses a GitHub URL into its coordinates.
 *
 * Supports plain repo URLs (`/owner/repo`) as well as "deep" URLs that point at
 * a specific branch and/or sub-directory (`/owner/repo/tree/<branch>/<subpath>`),
 * which is what lets users review a single folder inside a monorepo.
 *
 * @param {string} url
 * @returns {{owner: string, repo: string, branch: string|null, subpath: string|null}|null}
 *          Coordinates, or null if the URL is not a parseable GitHub repo URL.
 */
function parseGithubUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      let branch = null;
      let subpath = null;

      // ".../tree/<branch>/<...subpath>" — branch is parts[3], everything after is the subpath.
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

/**
 * Raised when a GitHub API call fails. Carries the upstream HTTP status so the
 * route layer can forward a meaningful code to the client instead of a blanket 500.
 */
class GithubError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GithubError';
    this.status = status;
  }
}

/**
 * Resolves a project's GitHub URL into a "repo context" with a concrete branch.
 *
 * If the URL pins a branch we use it directly; otherwise we ask GitHub for the
 * repo's default branch. Centralizing this is what guarantees the analyze route
 * and the requirements check operate on the *same* branch and subpath.
 *
 * @param {string} githubUrl
 * @returns {Promise<{owner, repo, branch, subpath}|null>} null on an invalid URL.
 * @throws {GithubError} if GitHub rejects the repo-info request.
 */
async function getRepoContext(githubUrl) {
  const info = parseGithubUrl(githubUrl);
  if (!info) return null;

  let branch = info.branch;
  if (!branch) {
    const repoRes = await githubFetch(`https://api.github.com/repos/${info.owner}/${info.repo}`);
    if (!repoRes.ok) {
      throw new GithubError('Failed to fetch repo info', repoRes.status);
    }
    const repoData = await repoRes.json();
    branch = repoData.default_branch || 'main';
  }
  return { owner: info.owner, repo: info.repo, branch, subpath: info.subpath };
}

/**
 * Fetches the full recursive git tree for a resolved repo context.
 * @returns {Promise<Array>} Flat array of tree entries ({ path, type, size, ... }).
 * @throws {GithubError} if the tree request fails.
 */
async function fetchRepoTree(ctx) {
  const treeRes = await githubFetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/git/trees/${ctx.branch}?recursive=1`
  );
  if (!treeRes.ok) {
    throw new GithubError('Failed to fetch repo tree', treeRes.status);
  }
  const data = await treeRes.json();
  return data.tree || [];
}

/**
 * Builds the raw.githubusercontent.com URL for a file *relative to the review
 * root*. When the project URL targeted a subpath, that prefix is re-applied here
 * so callers can always work with repo-root-relative paths.
 */
function toRawUrl(ctx, filePath) {
  const actualPath = ctx.subpath ? `${ctx.subpath}/${filePath}` : filePath;
  return `https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${ctx.branch}/${actualPath}`;
}

module.exports = {
  parseGithubUrl,
  githubFetch,
  getRepoContext,
  fetchRepoTree,
  toRawUrl,
  GithubError
};
