import React, { useState } from 'react';
import { Panel, Group, Separator } from "react-resizable-panels";
import FileExplorer from './FileExplorer';
import CodeViewer from './CodeViewer';
import AIChat from './AIChat';
import Checklist from './Checklist';
import RequirementsCheck from './RequirementsCheck';
import { Layout, MessageSquare, CheckSquare, FileText, GripVertical, Code, Folder } from 'lucide-react';

export default function WorkspaceView(props) {
  const [activeRightPanel, setActiveRightPanel] = useState('chat');
  const [activeMobileTab, setActiveMobileTab] = useState('explorer'); // 'explorer', 'code', 'panel'

  const handleFileSelectOverride = (file, line, triggerAIChat) => {
    props.handleFileSelect(file, line, triggerAIChat);
    setActiveMobileTab('code'); // Auto-switch to code view on mobile
  };

  const renderFileExplorer = () => (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border font-semibold flex items-center gap-2 shrink-0">
        <Layout className="w-4 h-4 text-blue-500" />
        Project Files
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <FileExplorer tree={props.fileTree} activeFile={props.activeFile} onFileSelect={handleFileSelectOverride} />
      </div>
    </div>
  );

  const renderCodeViewer = () => (
    <div className="flex flex-col h-full bg-[#0d1117] min-w-0">
      {props.activeFile ? (
        <CodeViewer
          content={props.fileContent}
          filename={props.activeFile}
          selectedLine={props.selectedLine}
          jumpToLine={props.jumpToLine}
          onLineClick={props.handleLineClick}
          projectId={props.projectId}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-4 text-center">
          Select a file from the explorer to begin review
        </div>
      )}
    </div>
  );

  const renderRightPanel = () => (
    <div className="flex flex-col h-full bg-card relative shadow-xl">
      <div className="flex border-b border-border bg-background/50 overflow-x-auto print:hidden shrink-0">
        <button
          className={`flex-1 py-3 px-2 font-medium text-xs flex flex-col items-center justify-center gap-1 transition-colors ${activeRightPanel === 'chat' ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-500/5' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveRightPanel('chat')}
        >
          <MessageSquare className="w-4 h-4" />
          Socratic AI
        </button>
        <button
          className={`flex-1 py-3 px-2 font-medium text-xs flex flex-col items-center justify-center gap-1 transition-colors ${activeRightPanel === 'checklist' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-500/5' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveRightPanel('checklist')}
        >
          <CheckSquare className="w-4 h-4" />
          Framework
        </button>
        <button
          className={`flex-1 py-3 px-2 font-medium text-xs flex flex-col items-center justify-center gap-1 transition-colors ${activeRightPanel === 'requirements' ? 'text-purple-500 border-b-2 border-purple-500 bg-purple-500/5' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveRightPanel('requirements')}
        >
          <FileText className="w-4 h-4" />
          Requirements
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeRightPanel === 'chat' && (
          <AIChat
            messages={props.chatMessages}
            onSendMessage={props.handleSendMessage}
            selectedLine={props.selectedLine}
            activeFile={props.activeFile}
            isLoading={props.isChatLoading}
          />
        )}
        {activeRightPanel === 'checklist' && (
          <Checklist
            items={props.checklist}
            onToggle={props.toggleChecklistCategory}
            analysisResults={props.analysisResults}
            studentOverrides={props.studentOverrides}
            markAsNonIssue={props.markAsNonIssue}
            saveChecklistComment={props.saveChecklistComment}
            isAnalyzing={props.isAnalyzing}
            runAnalysis={props.runAnalysis}
            onFileSelect={handleFileSelectOverride}
            onLineClick={props.handleLineClick}
            projectName={props.project?.groupName || props.project?.name || props.projectId}
          />
        )}
        {activeRightPanel === 'requirements' && (
          <RequirementsCheck
            projectId={props.projectId}
            initialResults={props.project?.requirementsCheckResults}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP LAYOUT */}
      <div className="hidden md:flex flex-1 h-full w-full overflow-hidden print:!block print:!overflow-visible print:!h-auto">
        <Group direction="horizontal" className="flex-1 h-full w-full bg-background">
          <Panel defaultSize="20%" minSize="10%" maxSize="40%" className="border-r border-border print:hidden">
            {renderFileExplorer()}
          </Panel>
          <Separator className="w-2 bg-background flex items-center justify-center cursor-col-resize hover:bg-blue-500/20 transition-colors group print:hidden">
            <div className="w-1 h-8 rounded-full bg-border group-hover:bg-blue-500 transition-colors" />
          </Separator>
          <Panel defaultSize="50%" minSize="30%" className="print:hidden">
            {renderCodeViewer()}
          </Panel>
          <Separator className="w-2 bg-background flex items-center justify-center cursor-col-resize hover:bg-blue-500/20 transition-colors group print:hidden">
            <div className="w-1 h-8 rounded-full bg-border group-hover:bg-blue-500 transition-colors" />
          </Separator>
          <Panel defaultSize="30%" minSize="20%" maxSize="60%" className="border-l border-border print:!block print:!w-[100vw] print:!max-w-full print:![flex-basis:100%] print:shadow-none print:border-none print:!h-auto print:!overflow-visible">
            {renderRightPanel()}
          </Panel>
        </Group>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="flex md:hidden flex-col flex-1 h-full w-full overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden">
          {activeMobileTab === 'explorer' && renderFileExplorer()}
          {activeMobileTab === 'code' && renderCodeViewer()}
          {activeMobileTab === 'panel' && renderRightPanel()}
        </div>
        
        {/* BOTTOM NAVIGATION BAR */}
        <div className="flex border-t border-border bg-card shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] pb-safe">
          <button
            className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 text-[10px] sm:text-xs font-medium transition-colors ${activeMobileTab === 'explorer' ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            onClick={() => setActiveMobileTab('explorer')}
          >
            <Folder className="w-5 h-5" />
            Explorer
          </button>
          <button
            className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 text-[10px] sm:text-xs font-medium transition-colors border-x border-border ${activeMobileTab === 'code' ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            onClick={() => setActiveMobileTab('code')}
          >
            <Code className="w-5 h-5" />
            Code
          </button>
          <button
            className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 text-[10px] sm:text-xs font-medium transition-colors ${activeMobileTab === 'panel' ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            onClick={() => setActiveMobileTab('panel')}
          >
            <Layout className="w-5 h-5" />
            Tools
          </button>
        </div>
      </div>
    </>
  );
}
