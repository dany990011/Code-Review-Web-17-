import { useState, useCallback } from 'react';
import { api } from '../../services/api';

// File categories the viewer recognizes. Images render as a preview; known code
// extensions are fetched and syntax-highlighted; anything else is "can't preview".
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
const KNOWN_CODE_EXTS = [
  'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'json', 'py', 'md', 'txt', 'yml', 'yaml',
  'env', 'gitignore', 'sh', 'xml', 'java', 'c', 'cpp', 'h', 'cs', 'rb', 'go', 'rs', 'php', 'sql', 'config'
];

// Sentinel placeholders the CodeViewer special-cases instead of treating as code.
const PLACEHOLDER_NO_FILE = '// No specific file associated with this issue.';
const NON_FILE_TOKENS = ['null', 'none', 'n/a', 'undefined'];

/**
 * Owns the "center pane" state: which file is open, its contents, and which line
 * is selected/jumped-to. Selecting a file fetches its text on demand.
 *
 * `selectedLine` vs `jumpToLine`: selecting highlights the line (and tells the
 * chat what we're discussing); jumping only scrolls to it without highlighting
 * (used by "View Issue in Code" so the AI finding isn't treated as a chat focus).
 *
 * @param {string} projectId
 */
export default function useFileViewer(projectId) {
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState('// Select a file to view its contents');
  const [selectedLine, setSelectedLine] = useState(null);
  const [jumpToLine, setJumpToLine] = useState(null);

  /**
   * Opens a file in the viewer.
   * @param {{path: string}} file
   * @param {number|null} lineToSelect  Line to focus, if any.
   * @param {boolean} shouldHighlight   true = highlight (select); false = just scroll (jump).
   */
  const handleFileSelect = useCallback(async (file, lineToSelect = null, shouldHighlight = true) => {
    if (!file || !file.path) return;

    // Normalize leading "./" or "/" the AI sometimes prepends to paths.
    const cleanPath = file.path.replace(/^(\.\/|\/+)/, '');

    // The AI may report "null"/"n/a" when a finding has no concrete file.
    if (NON_FILE_TOKENS.includes(cleanPath.toLowerCase())) {
      setActiveFile(null);
      setFileContent(PLACEHOLDER_NO_FILE);
      return;
    }

    setActiveFile(cleanPath);
    if (!lineToSelect || shouldHighlight) {
      setSelectedLine(null);
    }
    setJumpToLine(null);

    const ext = cleanPath.split('.').pop().toLowerCase();
    if (IMAGE_EXTS.includes(ext)) {
      setFileContent('__IMAGE__'); // CodeViewer renders an <img> from the file URL
      return;
    }
    if (!KNOWN_CODE_EXTS.includes(ext) && cleanPath.includes('.')) {
      setFileContent('__UNKNOWN_FILE__'); // CodeViewer shows "can't preview"
      return;
    }

    setFileContent(`// Loading ${cleanPath}...`);
    try {
      const { ok, content } = await api.getFileContent(projectId, cleanPath);
      if (ok) {
        setFileContent(content);
        if (lineToSelect) {
          // Highlight (select) or just scroll (jump) depending on the caller.
          if (shouldHighlight) {
            setSelectedLine(lineToSelect);
          } else {
            setJumpToLine(lineToSelect);
            setSelectedLine(null);
          }
        }
      } else {
        setFileContent(`// Error: The AI identified '${cleanPath}', but this file could not be found in the repository.`);
      }
    } catch (err) {
      console.error('Error fetching file content:', err);
      setFileContent('// Error loading file content');
    }
  }, [projectId]);

  const handleLineClick = useCallback((lineNumber) => {
    setSelectedLine(lineNumber);
  }, []);

  return { activeFile, fileContent, selectedLine, jumpToLine, handleFileSelect, handleLineClick };
}
