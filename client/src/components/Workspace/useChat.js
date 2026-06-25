import { useState, useEffect, useRef, useCallback } from 'react';
import { api, ApiError } from '../../services/api';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'Welcome to the code review session! Please select a file or a specific line from the workspace to start discussing it.'
};

/**
 * Owns the Socratic chat: loads history, seeds a welcome message on first visit,
 * and sends turns with an optimistic UI update.
 *
 * The currently-open file and selected line are passed in so each message can be
 * tagged with that context (the server injects the file into the AI prompt).
 *
 * @param {string} projectId
 * @param {{ activeFile: string|null, selectedLine: number|null }} context
 */
export default function useChat(projectId, { activeFile, selectedLine }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Which project we've already seeded a welcome message for. Prevents creating
  // duplicate welcomes when React StrictMode double-invokes this effect in dev
  // (and guards against quick remounts in production).
  const seededProjectRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await api.getMessages(projectId);
        if (cancelled) return;

        if (data && data.length > 0) {
          setChatMessages(data);
        } else if (seededProjectRef.current !== projectId) {
          // First-ever load for this project: show + persist the welcome once.
          seededProjectRef.current = projectId;
          setChatMessages([WELCOME_MESSAGE]);
          api.saveMessage(projectId, WELCOME_MESSAGE)
            .catch(err => console.error('Failed to save welcome message:', err));
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [projectId]);

  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || !projectId) return;

    // Show the user's message immediately (optimistic), before the server replies.
    const optimisticMsg = { role: 'user', content: text, contextLine: selectedLine, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, optimisticMsg]);
    setIsChatLoading(true);

    try {
      const { userMessage, botMessage } = await api.sendChat(projectId, { text, contextLine: selectedLine, activeFile });
      // Swap the optimistic message for the persisted one and append the reply.
      setChatMessages(prev => [...prev.slice(0, -1), userMessage, botMessage]);
    } catch (error) {
      console.error('Error in chat:', error);
      // Distinguish a server-side failure from a connectivity problem.
      const content = error instanceof ApiError
        ? 'The Socratic AI server is currently unavailable or encountered an error. Please try your request again.'
        : 'Network error: Could not connect to the AI server. Please check your connection and try again.';
      setChatMessages(prev => [...prev, { role: 'error', content, timestamp: new Date().toISOString() }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [projectId, activeFile, selectedLine]);

  return { chatMessages, isChatLoading, handleSendMessage };
}
