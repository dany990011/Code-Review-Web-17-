/**
 * Derives a short, human-friendly name from a GitHub URL — the last path
 * segment (the repo or targeted sub-folder), with any trailing ".git" removed.
 * Falls back gracefully if the string isn't a valid URL.
 *
 * @param {string} githubUrl
 * @returns {string}
 */
export function getRepoName(githubUrl) {
  if (!githubUrl) return 'Project';

  const lastSegment = (segments) => {
    const parts = segments.filter(Boolean);
    return parts.length ? parts[parts.length - 1].replace('.git', '') : null;
  };

  try {
    const name = lastSegment(new URL(githubUrl).pathname.split('/'));
    if (name) return name;
  } catch {
    const name = lastSegment(String(githubUrl).split('/'));
    if (name) return name;
  }
  return githubUrl;
}
