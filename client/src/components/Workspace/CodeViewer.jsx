import { useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fileContentUrl } from '../../services/api';

/**
 * Renders the contents of the open file with syntax highlighting and clickable,
 * highlightable lines. Two special `content` sentinels short-circuit rendering:
 * '__IMAGE__' (show the file as an image) and '__UNKNOWN_FILE__' (unpreviewable).
 *
 * `selectedLine` highlights + is scrolled to; `jumpToLine` is only scrolled to.
 */
export default function CodeViewer({ content, filename, selectedLine, jumpToLine, onLineClick, projectId }) {
  const containerRef = useRef(null);

  // Scroll the focused line into view once content (and thus the DOM) is ready.
  // The small timeout lets the highlighter finish painting line elements first.
  useEffect(() => {
    const lineToScroll = selectedLine || jumpToLine;
    if (lineToScroll && containerRef.current) {
      const timer = setTimeout(() => {
        const lineEl = containerRef.current?.querySelector(`#code-line-${lineToScroll}`);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return () => clearTimeout(timer); // avoid a stale scroll if deps change fast
    }
  }, [selectedLine, jumpToLine, content]);

  // Determine language based on file extension
  const getLanguage = (file) => {
    if (!file) return 'javascript';
    const ext = file.split('.').pop().toLowerCase();
    const map = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'css': 'css',
      'html': 'html',
      'json': 'json',
      'py': 'python',
      'md': 'markdown'
    };
    return map[ext] || 'javascript';
  };

  if (content === '__IMAGE__') {
    const imageUrl = fileContentUrl(projectId, filename);
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm overflow-hidden">
        <div className="flex items-center px-4 py-2 border-b border-[#333333] bg-[#252526] text-xs font-semibold text-[#cccccc]">
          {filename}
        </div>
        <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-black/20">
          <img src={imageUrl} alt={filename} className="max-w-full max-h-full object-contain shadow-2xl rounded-sm" />
        </div>
      </div>
    );
  }

  if (content === '__UNKNOWN_FILE__') {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm overflow-hidden">
        <div className="flex items-center px-4 py-2 border-b border-[#333333] bg-[#252526] text-xs font-semibold text-[#cccccc]">
          {filename}
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
          Cannot preview this file type.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm overflow-hidden">
      <div className="flex items-center px-4 py-2 border-b border-[#333333] bg-[#252526] text-xs font-semibold text-[#cccccc]">
        {filename}
      </div>
      <div className="flex-1 overflow-auto p-0 m-0" ref={containerRef}>
        <SyntaxHighlighter
          language={getLanguage(filename)}
          style={vscDarkPlus}
          showLineNumbers={true}
          wrapLines={true}
          customStyle={{
            margin: 0,
            padding: '1rem 0 3rem 0',
            backgroundColor: 'transparent',
            fontSize: '13px'
          }}
          lineProps={lineNumber => {
            const isSelected = selectedLine === lineNumber;
            return {
              id: `code-line-${lineNumber}`,
              style: { 
                display: 'block', 
                backgroundColor: isSelected ? 'rgba(38, 79, 120, 0.5)' : 'transparent',
                cursor: 'pointer',
                borderLeft: isSelected ? '3px solid #3794ff' : '3px solid transparent'
              },
              onClick: () => onLineClick(lineNumber)
            };
          }}
          lineNumberStyle={{
            minWidth: '3.5em',
            paddingRight: '1em',
            textAlign: 'right',
            color: '#858585',
            opacity: 0.7,
            userSelect: 'none'
          }}
        >
          {content || '// Select a file to view its contents'}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
