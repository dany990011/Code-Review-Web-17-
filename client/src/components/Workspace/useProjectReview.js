import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api, API_BASE_URL } from '../../services/api';
import { getRepoName } from '../../utils/github';
import { INITIAL_CHECKLIST } from './workspaceConstants';

/**
 * Owns the review-session state for one project: the project metadata, the file
 * tree, the AI scorecard, and the checklist/override state — plus the logic to
 * persist changes and stay in sync via WebSockets.
 *
 * Design note: the persistence `fetch`es deliberately run *outside* the
 * `setState` updater functions. Updaters must be pure — React invokes them twice
 * under StrictMode, which previously fired every checklist/override PATCH twice.
 * Here we compute the next value from current state, set it, then persist it.
 *
 * @param {string} projectId
 */
export default function useProjectReview(projectId) {
  const [project, setProject] = useState(null);
  const [fileTree, setFileTree] = useState([]);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [studentOverrides, setStudentOverrides] = useState({});
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Initial load: file tree + project (independent so one failing is OK) ---
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    api.getTree(projectId)
      .then(tree => { if (!cancelled && Array.isArray(tree)) setFileTree(tree); })
      .catch(err => console.error('Error fetching file tree:', err));

    api.getProject(projectId)
      .then(data => {
        if (cancelled || !data) return;
        setProject({ ...data, groupName: getRepoName(data.githubUrl) });
        if (data.analysisResults) setAnalysisResults(data.analysisResults);
        if (data.studentOverrides) setStudentOverrides(data.studentOverrides);
        if (data.checkedChecklistIds) {
          setChecklist(prev => prev.map(item => ({
            ...item,
            checked: data.checkedChecklistIds.includes(item.id)
          })));
        }
      })
      .catch(err => console.error('Error fetching project:', err));

    return () => { cancelled = true; };
  }, [projectId]);

  // --- Live updates: reflect changes made elsewhere (other viewers, analyses) ---
  useEffect(() => {
    if (!projectId) return;
    const socket = io(API_BASE_URL);

    socket.on('connect', () => socket.emit('joinProject', projectId));

    socket.on('projectUpdated', (data) => {
      if (!data) return;
      if (Array.isArray(data.checkedChecklistIds)) {
        setChecklist(prev => prev.map(item => ({
          ...item,
          checked: data.checkedChecklistIds.includes(item.id)
        })));
      }
      if (data.studentOverrides) setStudentOverrides(data.studentOverrides);
      // Keep the scorecard and requirements result live too (previously missed,
      // so an analysis run elsewhere didn't show up in an open workspace).
      if (data.analysisResults) setAnalysisResults(data.analysisResults);
      setProject(prev => (prev ? { ...prev, ...data, groupName: prev.groupName } : prev));
    });

    return () => {
      socket.emit('leaveProject', projectId);
      socket.disconnect();
    };
  }, [projectId]);

  // --- Persistence helpers (run outside setState updaters) --------------------
  const persistChecklist = useCallback((nextChecklist) => {
    const checkedChecklistIds = nextChecklist.filter(i => i.checked).map(i => i.id);
    api.updateProject(projectId, { checkedChecklistIds })
      .catch(err => console.error('Error syncing checklist:', err));
  }, [projectId]);

  const persistOverrides = useCallback((nextOverrides) => {
    api.updateProject(projectId, { studentOverrides: nextOverrides })
      .catch(err => console.error('Error syncing overrides:', err));
  }, [projectId]);

  // --- Actions ----------------------------------------------------------------
  const toggleChecklistCategory = useCallback((id) => {
    const next = checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item);
    setChecklist(next);
    persistChecklist(next);
  }, [checklist, persistChecklist]);

  const markAsNonIssue = useCallback((categoryName) => {
    const current = studentOverrides[categoryName] || {};
    const next = { ...studentOverrides };

    if (current.isNonIssue) {
      // Un-mark: remove the flag but keep any comment the user wrote.
      const rest = { ...current };
      delete rest.isNonIssue;
      if (Object.keys(rest).length > 0) next[categoryName] = rest;
      else delete next[categoryName];
    } else {
      next[categoryName] = { ...current, isNonIssue: true };
    }

    setStudentOverrides(next);
    persistOverrides(next);
  }, [studentOverrides, persistOverrides]);

  const saveChecklistComment = useCallback((categoryName, comment) => {
    const next = { ...studentOverrides, [categoryName]: { ...(studentOverrides[categoryName] || {}), comment } };
    setStudentOverrides(next);
    persistOverrides(next);
  }, [studentOverrides, persistOverrides]);

  const runAnalysis = useCallback(async () => {
    if (!projectId) return;
    setIsAnalyzing(true);
    try {
      const results = await api.analyze(projectId);
      setAnalysisResults(results);
    } catch (err) {
      console.error('Analysis failed:', err);
      alert(`Analysis failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId]);

  return {
    project,
    fileTree,
    analysisResults,
    checklist,
    studentOverrides,
    isAnalyzing,
    runAnalysis,
    toggleChecklistCategory,
    markAsNonIssue,
    saveChecklistComment,
  };
}
