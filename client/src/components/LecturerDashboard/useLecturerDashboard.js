import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@clerk/clerk-react';

export default function useLecturerDashboard() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const fetchProjects = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      if (!isLoaded || !isSignedIn) return;
      
      const token = await getToken();
      if (!token) return; // Prevent fetching without a token
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        console.error('Unauthorized');
        setIsLoading(false);
        return;
      }
      const data = await res.json();
        const mappedSessions = data.map(project => {
          let groupName = project.githubUrl;
          try {
            const parsed = new URL(project.githubUrl);
            const parts = parsed.pathname.split('/').filter(Boolean);
            if (parts.length > 0) {
              groupName = parts[parts.length - 1].replace('.git', '');
            }
          } catch (e) {
            const parts = groupName.split('/').filter(Boolean);
            if (parts.length > 0) groupName = parts[parts.length - 1].replace('.git', '');
          }

          let progress = 0;
          if (project.checkedChecklistIds && Array.isArray(project.checkedChecklistIds)) {
            progress = Math.round((project.checkedChecklistIds.length / 12) * 100);
          }

          return {
            id: project._id,
            groupName: groupName,
            reviewer: 'Anonymous Student',
            progress: progress,
            active: progress < 100,
            createdAt: new Date(project.uploadedAt).toLocaleDateString('en-GB'),
            updatedAt: project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('en-GB') : new Date(project.uploadedAt).toLocaleDateString('en-GB'),
            rawProject: project
          };
        });
        setSessions(mappedSessions);
        setIsLoading(false);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setIsLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchProjects();
    } else if (isLoaded && !isSignedIn) {
       setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, fetchProjects]);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socket = io(socketUrl);

    socket.on('projectUpdated', () => {
      fetchProjects(true);
    });

    socket.on('projectCreated', () => {
      fetchProjects(true);
    });

    socket.on('projectDeleted', () => {
      fetchProjects(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchProjects]);

  const deleteProject = async (projectId) => {
    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== projectId));
      } else {
        console.error('Failed to delete project');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const inviteLecturer = async (email) => {
    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/lecturers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite lecturer');
      }
      return { success: true, message: data.message };
    } catch (err) {
      console.error('Error inviting lecturer:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    sessions,
    isLoading,
    deleteProject,
    inviteLecturer
  };
}
