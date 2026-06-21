import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function useWorkspace() {
  const { projectId } = useParams();
  const [fileTree, setFileTree] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState('// Select a file to view its contents');
  const [selectedLine, setSelectedLine] = useState(null);
  const [jumpToLine, setJumpToLine] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [project, setProject] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [studentOverrides, setStudentOverrides] = useState({});
  const [checklist, setChecklist] = useState([
    { id: 1, category: 'Security', checked: false },
    { id: 2, category: 'Performance', checked: false },
    { id: 3, category: 'Readability', checked: false },
    { id: 4, category: 'Architecture', checked: false },
    { id: 5, category: 'Testing', checked: false },
    { id: 6, category: 'Error Handling', checked: false },
    { id: 7, category: 'State Management', checked: false },
    { id: 8, category: 'Accessibility', checked: false },
    { id: 9, category: 'Documentation', checked: false },
    { id: 10, category: 'Scalability', checked: false },
    { id: 11, category: 'Best Practices', checked: false },
    { id: 12, category: 'Reusability', checked: false },
  ]);

  useEffect(() => {
    // Fetch GitHub tree
    if (projectId) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/github/tree`)
        .then(res => res.json())
        .then(tree => {
          if (Array.isArray(tree)) setFileTree(tree);
        })
        .catch(err => console.error("Error fetching file tree:", err));
    }

    // Fetch Project Details (for analysis results)
    if (projectId) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            let groupName = data.githubUrl || 'Project';
            try {
              const parsed = new URL(data.githubUrl);
              const parts = parsed.pathname.split('/').filter(Boolean);
              if (parts.length > 0) {
                groupName = parts[parts.length - 1].replace('.git', '');
              }
            } catch (e) {
              const parts = groupName.split('/').filter(Boolean);
              if (parts.length > 0) groupName = parts[parts.length - 1].replace('.git', '');
            }
            data.groupName = groupName;
            
            setProject(data);
            if (data.analysisResults) {
              setAnalysisResults(data.analysisResults);
            }
            if (data.studentOverrides) {
              setStudentOverrides(data.studentOverrides);
            }
            if (data.checkedChecklistIds) {
              setChecklist(prev => prev.map(item => ({
                ...item,
                checked: data.checkedChecklistIds.includes(item.id)
              })));
            }
          }
        })
        .catch(err => console.error("Error fetching project:", err));
    }

    // Fetch chat history
    if (projectId) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/messages`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            setChatMessages(data);
          } else {
            // First time load, save initial bot message
            const initialMsg = { role: 'assistant', content: "Welcome to the code review session! Please select a file or a specific line from the workspace to start discussing it." };
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(initialMsg)
            });
            setChatMessages([initialMsg]);
          }
        })
        .catch(err => console.error('Failed to load chat history:', err));
    }
  }, [projectId]);

  // Live updates (Polling)
  useEffect(() => {
    if (!projectId) return;
    
    const intervalId = setInterval(() => {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            if (data.checkedChecklistIds) {
              setChecklist(prev => prev.map(item => ({
                ...item,
                checked: data.checkedChecklistIds.includes(item.id)
              })));
            }
            if (data.studentOverrides) {
              setStudentOverrides(data.studentOverrides);
            }
          }
        })
        .catch(() => {}); // silently ignore polling errors
    }, 3000); // Check every 3 seconds

    return () => clearInterval(intervalId);
  }, [projectId]);

  const handleFileSelect = async (file, lineToSelect = null, shouldHighlight = true) => {
    if (!file || !file.path) return;
    
    let cleanPath = file.path.replace(/^(\.\/|\/+)/, '');
    
    if (['null', 'none', 'n/a', 'undefined'].includes(cleanPath.toLowerCase())) {
      setActiveFile(null);
      setFileContent('// No specific file associated with this issue.');
      return;
    }

    setActiveFile(cleanPath);
    if (!lineToSelect || shouldHighlight) {
      setSelectedLine(null);
    }
    setJumpToLine(null);
    const ext = cleanPath.split('.').pop().toLowerCase();
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
    const knownCodeExts = ['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'json', 'py', 'md', 'txt', 'yml', 'yaml', 'env', 'gitignore', 'sh', 'xml', 'java', 'c', 'cpp', 'h', 'cs', 'rb', 'go', 'rs', 'php', 'sql', 'config'];

    if (imageExts.includes(ext)) {
      setFileContent('__IMAGE__');
      return;
    }

    if (!knownCodeExts.includes(ext) && cleanPath.includes('.')) {
      setFileContent('__UNKNOWN_FILE__');
      return;
    }

    setFileContent(`// Loading ${cleanPath}...`);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/github/file?path=${encodeURIComponent(cleanPath)}`);
      if (response.ok) {
        const content = await response.text();
        setFileContent(content);
        if (lineToSelect) {
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
  };

  const handleLineClick = (lineNumber) => {
    setSelectedLine(lineNumber);
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || !projectId) return;
    
    const tempUserMsg = { role: 'user', content: text, contextLine: selectedLine, timestamp: new Date().toISOString() };
    
    // Optimistic UI update
    setChatMessages(prev => [...prev, tempUserMsg]);
    setIsChatLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, contextLine: selectedLine, activeFile })
      });

      if (response.ok) {
        const { userMessage, botMessage } = await response.json();
        // Replace optimistic user message with real one from DB, and append bot message
        setChatMessages(prev => {
          const updated = [...prev];
          updated.pop(); // Remove optimistic
          return [...updated, userMessage, botMessage];
        });
      } else {
        console.error('Failed to get AI response');
        setChatMessages(prev => [
          ...prev, 
          { role: 'error', content: 'The Socratic AI server is currently unavailable or encountered an error. Please try your request again.', timestamp: new Date().toISOString() }
        ]);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setChatMessages(prev => [
        ...prev, 
        { role: 'error', content: 'Network error: Could not connect to the AI server. Please check your connection and try again.', timestamp: new Date().toISOString() }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!projectId) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}/analyze`, { method: 'POST' });
      if (response.ok) {
        const results = await response.json();
        setAnalysisResults(results);
      } else {
        const err = await response.json();
        alert(`Analysis failed: ${err.error || 'Unknown error'}`);
        console.error('Failed to run analysis', err);
      }
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleChecklistCategory = (id) => {
    setChecklist(prev => {
      const next = prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item);
      
      // Sync to backend
      const checkedIds = next.filter(i => i.checked).map(i => i.id);
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedChecklistIds: checkedIds })
      }).catch(err => console.error('Error syncing checklist:', err));
      
      return next;
    });
  };

  const markAsNonIssue = (categoryName) => {
    setStudentOverrides(prev => {
      const isCurrentlyOverridden = prev[categoryName]?.isNonIssue;
      const next = { ...prev };
      
      if (isCurrentlyOverridden) {
        delete next[categoryName]; // Remove the override entirely if it was true
      } else {
        next[categoryName] = { isNonIssue: true }; // Add the override
      }
      
      // Sync to backend
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentOverrides: next })
      }).catch(err => console.error('Error syncing overrides:', err));
      
      return next;
    });
  };

  const saveChecklistComment = (categoryName, comment) => {
    setStudentOverrides(prev => {
      const existing = prev[categoryName] || {};
      const next = { ...prev, [categoryName]: { ...existing, comment } };
      
      // Sync to backend
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentOverrides: next })
      }).catch(err => console.error('Error syncing overrides:', err));
      
      return next;
    });
  };

  return {
    projectId,
    project,
    fileTree,
    activeFile,
    fileContent,
    selectedLine,
    jumpToLine,
    chatMessages,
    checklist,
    studentOverrides,
    handleFileSelect,
    handleLineClick,
    handleSendMessage,
    toggleChecklistCategory,
    markAsNonIssue,
    saveChecklistComment,
    isChatLoading,
    analysisResults,
    isAnalyzing,
    runAnalysis
  };
}
