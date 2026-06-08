import React, { useState } from 'react';
import { Play, Loader2, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RequirementsCheck({ projectId, initialResults }) {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState(initialResults || null);
  const [error, setError] = useState(null);

  const runCheck = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}/check-requirements`, {
        method: 'POST'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to perform requirements check');
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Pass') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'Partial') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Requirements Check
          </h3>
          <button
            onClick={runCheck}
            disabled={isChecking}
            className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {isChecking ? 'Checking...' : (results ? 'Re-run Check' : 'Run Check')}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          The AI will read the exact requirements document you uploaded and audit the entire codebase for compliance.
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="p-3 mb-4 text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg">
            {error}
          </div>
        )}

        {!results && !isChecking && !error && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
            <FileText className="w-12 h-12" />
            <p className="text-sm">Run a check to see if the code meets your requirements.</p>
          </div>
        )}

        {isChecking && (
          <div className="h-full flex flex-col items-center justify-center text-blue-400 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-medium animate-pulse">Reading Document & Auditing Codebase...</p>
          </div>
        )}

        {results && !isChecking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header Score */}
            <div className={`p-4 rounded-xl border flex items-center justify-between \${getStatusColor(results.overallStatus)}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-80">Overall Status</p>
                <p className="text-2xl font-bold">{results.overallStatus}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-80">Compliance Score</p>
                <p className="text-3xl font-black">{results.score}%</p>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl border border-border">
              <p className="text-sm leading-relaxed">{results.summary}</p>
            </div>

            {results.criticalIssues?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  Critical Issues
                </h4>
                <ul className="space-y-2">
                  {results.criticalIssues.map((issue, i) => (
                    <li key={i} className="text-sm text-foreground bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg flex items-start gap-2">
                      <span className="text-red-500 font-bold mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results.missingFeatures?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-yellow-400 flex items-center gap-2 mb-3">
                  <XCircle className="w-4 h-4" />
                  Missing Requirements
                </h4>
                <ul className="space-y-2">
                  {results.missingFeatures.map((feature, i) => (
                    <li key={i} className="text-sm text-foreground bg-yellow-950/10 border border-yellow-900/20 p-2.5 rounded-lg flex items-start gap-2">
                      <span className="text-yellow-500 font-bold mt-0.5">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results.implementedFeatures?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4" />
                  Successfully Implemented
                </h4>
                <ul className="space-y-2">
                  {results.implementedFeatures.map((feature, i) => (
                    <li key={i} className="text-sm text-foreground bg-emerald-950/10 border border-emerald-900/20 p-2.5 rounded-lg flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="pb-8"></div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
