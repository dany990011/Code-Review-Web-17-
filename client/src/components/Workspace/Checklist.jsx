import React from 'react';
import { CheckCircle2, Circle, Play, Loader2, FileCode2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Checklist({ items, onToggle, analysisResults = [], studentOverrides = {}, markAsNonIssue, isAnalyzing, runAnalysis, onFileSelect, onLineClick }) {
  const completedCount = items.filter(i => i.checked).length;
  const progress = (completedCount / items.length) * 100;

  const handleViewIssue = (e, result) => {
    e.stopPropagation();
    if (result.offendingFile) {
      onFileSelect({ path: result.offendingFile }, result.offendingLine);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-emerald-400 bg-emerald-900 border-emerald-500';
    if (score >= 5) return 'text-yellow-400 bg-yellow-900 border-yellow-500';
    return 'text-red-400 bg-red-900 border-red-500';
  };

  const getPanelColor = (checked) => {
    if (checked) return 'opacity-70 bg-muted/50 border-border';
    return 'bg-card border-border';
  };

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Socratic Scorecard</h3>
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {isAnalyzing ? 'Analyzing Codebase...' : (analysisResults?.length > 0 ? 'Re-run Analysis' : 'Run AI Analysis')}
          </button>
        </div>
        <div className="flex items-center justify-between mb-2">
           <span className="text-sm font-medium">Review Progress</span>
           <span className="text-sm font-normal text-muted-foreground">{completedCount} of {items.length}</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {items.map((item, idx) => {
          const result = analysisResults?.find(r => r.category.toLowerCase() === item.category.toLowerCase());
          const isOverridden = studentOverrides[item.category]?.isNonIssue;
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onToggle(item.id)}
              className={`flex flex-col gap-2 p-3 my-2 rounded-lg cursor-pointer border transition-all hover:border-muted-foreground/50 ${getPanelColor(item.checked)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {item.checked ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm font-medium transition-colors ${item.checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {item.category}
                  </span>
                </div>
                {result && (
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${isOverridden ? 'text-blue-400 bg-blue-900 border-blue-500' : getScoreColor(result.rating)}`}>
                    {isOverridden ? '10 / 10 (Override)' : `${result.rating} / 10`}
                  </span>
                )}
              </div>

              {result && (
                <div className="mt-1 pl-8">
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                    {result.reasoning}
                  </p>
                  <div className="flex flex-col gap-3 mt-3">
                    {result.offendingFile && (
                      <button 
                        onClick={(e) => handleViewIssue(e, result)}
                        className="w-full text-sm flex items-center justify-center gap-2 text-blue-50 bg-blue-600 hover:bg-blue-500 transition-all px-4 py-2.5 rounded-md font-semibold shadow-md border border-blue-500/50 active:scale-[0.98]"
                      >
                        <FileCode2 className="w-4 h-4" />
                        View Issue in Code {result.offendingLine ? `(Line ${result.offendingLine})` : ''}
                      </button>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsNonIssue(item.category);
                      }}
                      className={`w-full text-sm flex items-center justify-center font-medium transition-all px-4 py-2 rounded-md shadow-sm active:scale-[0.98] border ${
                        isOverridden 
                          ? 'text-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/50' 
                          : 'text-foreground bg-muted/50 hover:bg-muted border-border'
                      }`}
                    >
                      {isOverridden ? 'Unmark as AI false detection' : 'Mark as AI false detection'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
