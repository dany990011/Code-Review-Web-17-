import React from 'react';
import { Activity, Users, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { generateAuditPDF } from '../../utils/pdfGenerator';

export default function LecturerDashboardView({ sessions, isLoading, deleteProject }) {
  const [reportSession, setReportSession] = React.useState(null);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this project? This cannot be undone.")) {
      deleteProject(id);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 bg-background overflow-y-auto relative">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Lecturer Dashboard</h2>
          <p className="text-muted-foreground mt-1">Monitor active code review sessions</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500"><Activity className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Active Sessions</p>
              <p className="text-2xl font-bold text-foreground">{sessions.filter(s => s.active).length}</p>
            </div>
          </div>
          <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500"><CheckCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-foreground">{sessions.filter(s => !s.active).length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 print:hidden">
        {sessions.map((session, idx) => (
          <motion.div 
            key={session.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-card border border-border rounded-xl p-6 shadow-md hover:shadow-lg transition-all relative overflow-hidden flex flex-col"
          >
            {session.progress === 100 && (
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 flex items-center justify-center rounded-bl-full">
                <CheckCircle className="w-6 h-6 text-emerald-500 mb-4 ml-4" />
              </div>
            )}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-foreground truncate max-w-[200px]" title={session.groupName}>{session.groupName}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Users className="w-4 h-4" /> Reviewed by {session.reviewer}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 z-10">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${session.active ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {session.active ? 'In Progress' : 'Completed'}
                </span>
                <button 
                  onClick={() => handleDelete(session.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="mt-auto mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Review Progress</span>
                <span className="font-medium text-foreground">{session.progress}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-4">
                <div 
                  className={`h-full ${session.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                  style={{ width: `${session.progress}%` }}
                />
              </div>
              
              <div className="flex justify-between items-center text-xs text-muted-foreground bg-background/50 p-2 rounded-lg border border-border/50">
                <span>Created: {session.createdAt}</span>
                <span>Updated: {session.updatedAt}</span>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-border flex justify-between items-center">
              <button 
                onClick={() => setReportSession(session)}
                className="text-sm text-blue-500 font-medium hover:text-blue-400 transition-colors"
              >
                View Audit Report
              </button>
              <Link to={`/workspace/${session.id}`} className="text-sm text-purple-500 font-medium hover:text-purple-400 transition-colors">
                Join Session
              </Link>
            </div>
          </motion.div>
        ))}
        {sessions.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl">
            <p className="text-muted-foreground">No projects have been uploaded yet.</p>
            <Link to="/upload" className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
              Upload a Project
            </Link>
          </div>
        )}
      </div>

      {reportSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8 print:static print:bg-white print:p-0">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-3xl w-full max-h-full flex flex-col overflow-hidden print:shadow-none print:border-none print:max-w-none print:h-auto print:max-h-none print:overflow-visible">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <div>
                <h3 className="text-2xl font-bold text-foreground">Audit Report: {reportSession.groupName}</h3>
                <p className="text-muted-foreground text-sm mt-1">Detailed breakdown of AI findings vs. Student overrides</p>
              </div>
              <button 
                onClick={() => setReportSession(null)}
                className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted transition-colors print:hidden"
              >
                ✕
              </button>
            </div>
            
            <div id="audit-report-content" className="p-6 overflow-y-auto bg-card text-foreground print:overflow-visible">
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Checklist Progress</h4>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${(reportSession.rawProject?.checkedChecklistIds?.length || 0) / 12 * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold">{reportSession.rawProject?.checkedChecklistIds?.length || 0} / 12</span>
                </div>
                <p className="text-xs text-muted-foreground">Items checked off by student</p>
              </div>

              <div>
                <h4 className="font-semibold mb-4 border-b border-border pb-2">Identified Issues & Overrides</h4>
                {!reportSession.rawProject?.analysisResults?.length ? (
                  <p className="text-sm text-muted-foreground italic">No analysis results available.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {reportSession.rawProject.analysisResults.map((result, i) => {
                      const isOverridden = reportSession.rawProject.studentOverrides?.[result.category]?.isNonIssue;
                      return (
                        <div key={i} className={`p-4 rounded-lg border ${isOverridden ? 'bg-blue-500/5 border-blue-500/30' : 'bg-muted/20 border-border'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-foreground">{result.category}</span>
                            {isOverridden ? (
                              <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-500 rounded font-bold">STUDENT OVERRIDE: False Positive</span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded font-bold">Score: {result.rating} / 10</span>
                            )}
                          </div>
                          <p className={`text-sm ${isOverridden ? 'text-muted-foreground line-through opacity-70' : 'text-foreground'}`}>
                            {result.reasoning}
                          </p>
                          {reportSession.rawProject.studentOverrides?.[result.category]?.comment && (
                            <div className="mt-3 p-3 bg-muted/30 border border-border rounded-md">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Student Comment:</p>
                              <p className="text-sm text-foreground">{reportSession.rawProject.studentOverrides[result.category].comment}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3 print:hidden">
              <button 
                onClick={() => {
                  generateAuditPDF(reportSession.rawProject, reportSession.groupName);
                }}
                className="px-6 py-2 bg-purple-500 text-white font-medium rounded hover:bg-purple-600 transition-colors"
              >
                Download PDF
              </button>
              <button 
                onClick={() => setReportSession(null)}
                className="px-6 py-2 bg-blue-500 text-white font-medium rounded hover:bg-blue-600 transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
