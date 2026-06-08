import { useState, useEffect } from 'react';

export default function useLecturerDashboard() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/projects`)
      .then(res => res.json())
      .then(data => {
        const mappedSessions = data.map(project => {
          // Extract repo name from githubUrl
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
          if (project.requirementsCheckResults) {
            progress = 100;
          } else if (project.analysisResults && project.analysisResults.length > 0) {
            progress = 50;
          } else {
            progress = 10; // Just uploaded
          }

          return {
            id: project._id,
            groupName: groupName,
            reviewer: 'Anonymous Student',
            progress: progress,
            active: progress < 100
          };
        });
        setSessions(mappedSessions);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch projects:', err);
        setIsLoading(false);
      });
  }, []);

  return {
    sessions,
    isLoading
  };
}
