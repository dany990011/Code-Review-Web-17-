import React, { useState } from 'react';
import { Panel, Group, Separator } from "react-resizable-panels";
import FileExplorer from './FileExplorer';
import CodeViewer from './CodeViewer';
import AIChat from './AIChat';
import Checklist from './Checklist';
import RequirementsCheck from './RequirementsCheck';
import { Layout, MessageSquare, CheckSquare, FileText, GripVertical } from 'lucide-react';

export default function WorkspaceView(props) {
  const [activeRightPanel, setActiveRightPanel] = useState('chat');

  return (
    <Group direction="horizontal" className="flex-1 h-full w-full overflow-hidden bg-background">
      
      {/* LEFT SIDEBAR: File Explorer */}
      <Panel defaultSize="20%" minSize="10%" maxSize="40%" className="bg-card flex flex-col border-r border-border">
        <div className="p-4 border-b border-border font-semibold flex items-center gap-2">
          <Layout className="w-4 h-4 text-blue-500" />
          Project Files
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <FileExplorer tree={props.fileTree} activeFile={props.activeFile} onFileSelect={props.handleFileSelect} />
        </div>
      </Panel>

      <Separator className="w-2 bg-background flex items-center justify-center cursor-col-resize hover:bg-blue-500/20 transition-colors group">
        <div className="w-1 h-8 rounded-full bg-border group-hover:bg-blue-500 transition-colors" />
      </Separator>

      {/* MIDDLE: Code Viewer */}
      <Panel defaultSize="50%" minSize="30%" className="flex flex-col min-w-0 bg-[#0d1117]">
        {props.activeFile ? (
          <CodeViewer
            content={props.fileContent}
            filename={props.activeFile}
            selectedLine={props.selectedLine}
            onLineClick={props.handleLineClick}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a file to begin review
          </div>
        )}
      </Panel>

      <Separator className="w-2 bg-background flex items-center justify-center cursor-col-resize hover:bg-blue-500/20 transition-colors group">
        <div className="w-1 h-8 rounded-full bg-border group-hover:bg-blue-500 transition-colors" />
      </Separator>

      {/* RIGHT SIDEBAR: Socratic / Scorecard / Requirements */}
      <Panel defaultSize="30%" minSize="20%" maxSize="60%" className="bg-card flex flex-col z-10 shadow-xl border-l border-border">
        <div className="flex border-b border-border bg-background/50 overflow-x-auto">
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
              isAnalyzing={props.isAnalyzing}
              runAnalysis={props.runAnalysis}
              onFileSelect={props.handleFileSelect}
              onLineClick={props.handleLineClick}
            />
          )}
          {activeRightPanel === 'requirements' && (
            <RequirementsCheck
              projectId={props.projectId}
              initialResults={props.project?.requirementsCheckResults}
            />
          )}
        </div>
      </Panel>
      
    </Group>
  );
}
