import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@clerk/clerk-react';
import { api, API_BASE_URL } from '../../services/api';
import { getRepoName } from '../../utils/github';

/**
 * Powers the lecturer dashboard: loads every project (authenticated with the
 * Clerk token), keeps the list live via WebSockets, and exposes delete + invite
 * actions. Mapping raw projects into card-friendly "sessions" happens here so
 * the view stays purely presentational.
 */
export default function useLecturerDashboard() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken, isLoaded, isSignedIn } = useAuth();

  /**
   * Fetches all projects and maps them to the dashboard card shape.
   * @param {boolean} silent  Refresh without flashing the loading spinner
   *                          (used for live, socket-triggered refreshes).
   */
  const fetchProjects = useCallback(async (silent = false) => {
    if (!isLoaded || !isSignedIn) return; // wait until Clerk is ready
    if (!silent) setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) return;

      const data = await api.listProjects(token);
      const mappedSessions = data.map(project => {
        const progress = Array.isArray(project.checkedChecklistIds)
          ? Math.round((project.checkedChecklistIds.length / 12) * 100)
          : 0;

        return {
          id: project._id,
          groupName: getRepoName(project.githubUrl),
          reviewer: 'Anonymous Student',
          progress,
          active: progress < 100,
          createdAt: new Date(project.uploadedAt).toLocaleDateString('en-GB'),
          updatedAt: project.updatedAt
            ? new Date(project.updatedAt).toLocaleDateString('en-GB')
            : new Date(project.uploadedAt).toLocaleDateString('en-GB'),
          rawProject: project,
        };
      });
      setSessions(mappedSessions);
    } catch (err) {
      // A 401/403 (caller isn't an allowlisted lecturer) surfaces here too;
      // there's nothing to show, so we just stop loading.
      console.error('Failed to fetch projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  // Initial load once Clerk has resolved the auth state. Driving loading state
  // here is intentional — this is a mount-time data fetch, the legitimate use of
  // an effect, not the derived-state anti-pattern the lint rule targets.
  useEffect(() => {
    if (!isLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSignedIn) fetchProjects(); else setIsLoading(false);
  }, [isLoaded, isSignedIn, fetchProjects]);

  // Live updates. The socket MUST join the 'lecturers' room — the server emits
  // projectCreated/Updated/Deleted only to that room. Without joining (the
  // previous behavior), none of these events arrived and the dashboard only
  // refreshed on a manual page reload.
  useEffect(() => {
    const socket = io(API_BASE_URL);
    socket.on('connect', () => socket.emit('joinLecturers'));
    socket.on('projectUpdated', () => fetchProjects(true));
    socket.on('projectCreated', () => fetchProjects(true));
    socket.on('projectDeleted', () => fetchProjects(true));

    return () => {
      socket.emit('leaveLecturers');
      socket.disconnect();
    };
  }, [fetchProjects]);

  const deleteProject = async (projectId) => {
    try {
      const token = await getToken();
      await api.deleteProject(projectId, token);
      setSessions(prev => prev.filter(s => s.id !== projectId)); // optimistic removal
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const inviteLecturer = async (email) => {
    try {
      const token = await getToken();
      const data = await api.inviteLecturer(email, token);
      return { success: true, message: data.message };
    } catch (err) {
      console.error('Error inviting lecturer:', err);
      return { success: false, error: err.message };
    }
  };

  return { sessions, isLoading, deleteProject, inviteLecturer };
}
