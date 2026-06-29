import { useParams } from 'react-router-dom';
import useFileViewer from './useFileViewer';
import useChat from './useChat';
import useProjectReview from './useProjectReview';

/**
 * Composition root for the workspace.
 *
 * It's split into three focused, independently-testable hooks, each owning one concern:
 *   - useFileViewer   : which file/line is open and its contents
 *   - useProjectReview: project + tree + AI scorecard + checklist/overrides + live sync
 *   - useChat         : the Socratic conversation
 *
 * This hook just wires them together and flattens their state into the single
 * props object WorkspaceView consumes. The chat needs the active file/line, so
 * those flow from the file viewer into the chat hook.
 */
export default function useWorkspace() {
  const { projectId } = useParams();

  const fileViewer = useFileViewer(projectId);
  const review = useProjectReview(projectId);
  const chat = useChat(projectId, {
    activeFile: fileViewer.activeFile,
    selectedLine: fileViewer.selectedLine,
  });

  return {
    projectId,

    // Project + review state
    project: review.project,
    fileTree: review.fileTree,
    analysisResults: review.analysisResults,
    checklist: review.checklist,
    studentOverrides: review.studentOverrides,
    isAnalyzing: review.isAnalyzing,
    runAnalysis: review.runAnalysis,
    toggleChecklistCategory: review.toggleChecklistCategory,
    markAsNonIssue: review.markAsNonIssue,
    saveChecklistComment: review.saveChecklistComment,

    // File viewer
    activeFile: fileViewer.activeFile,
    fileContent: fileViewer.fileContent,
    selectedLine: fileViewer.selectedLine,
    jumpToLine: fileViewer.jumpToLine,
    handleFileSelect: fileViewer.handleFileSelect,
    handleLineClick: fileViewer.handleLineClick,

    // Chat
    chatMessages: chat.chatMessages,
    isChatLoading: chat.isChatLoading,
    handleSendMessage: chat.handleSendMessage,
  };
}
