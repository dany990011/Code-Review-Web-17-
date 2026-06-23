import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import LoginContainer from './components/Login/LoginContainer';
import ProjectUploadContainer from './components/ProjectUpload/ProjectUploadContainer';
import WorkspaceContainer from './components/Workspace/WorkspaceContainer';
import LecturerDashboardContainer from './components/LecturerDashboard/LecturerDashboardContainer';

import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  const toggleTheme = () => setIsLightMode(!isLightMode);

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <Router>
        <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col transition-colors duration-300 print:h-auto print:overflow-visible">
          <header className="border-b border-border p-4 flex justify-between items-center bg-card shrink-0 print:hidden transition-colors duration-300">
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              Reviewly - Socratic Code Review
            </h1>
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-muted text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </header>
          <main className="flex-1 flex overflow-hidden print:overflow-visible">
            <Routes>
              <Route path="/" element={<LoginContainer />} />
              <Route path="/upload" element={<ProjectUploadContainer />} />
              <Route path="/workspace/:projectId" element={<WorkspaceContainer />} />
              <Route path="/dashboard" element={<LecturerDashboardContainer />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ClerkProvider>
  );
}

export default App;
