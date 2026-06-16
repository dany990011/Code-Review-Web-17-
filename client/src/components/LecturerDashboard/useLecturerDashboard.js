import { useState, useEffect } from 'react';

export default function useLecturerDashboard() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = () => {
    setIsLoading(true);
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects`)
      .then(res => res.json())
      .then(data => {
        const mappedSessions = data.map(project => {
          let groupName = project.githubUrl;
          try {
            const parsed = new URL(project.githubUrl);
            const parts = parsed.pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
              groupName = `${parts[0]}/${parts[1].replace('.git', '')}`;
            }
          } catch (e) {
            // ignore
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
            createdAt: new Date(project.uploadedAt).toLocaleDateString(),
            updatedAt: project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : new Date(project.uploadedAt).toLocaleDateString(),
            rawProject: project
          };
        });
        setSessions(mappedSessions);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch projects:', err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const deleteProject = async (projectId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects/${projectId}`, {
        method: 'DELETE',
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

  return {
    sessions,
    isLoading,
    deleteProject
  };
}
