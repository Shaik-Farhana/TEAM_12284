import { useState, useCallback, useEffect } from 'react';
import { getAuthToken } from '../services/api';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_BASE_URL = rawBaseUrl.includes('/api/v1') ? rawBaseUrl : `${rawBaseUrl.replace(/\/$/, '')}/api/v1`;

export function useAdaptationStream(sessionId) {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [learningState, setLearningState] = useState('Focused'); // Default UI badge state
  const [learningReason, setLearningReason] = useState('Starting fresh session.');
  const [audioUrl, setAudioUrl] = useState(null);
  const [visualUrl, setVisualUrl] = useState(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (!sessionId || hasLoadedHistory) return;
      try {
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/learning/${sessionId}/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const history = await response.json();
          if (history.length > 0) {
            const combinedText = history.map(h => h.content_text).join('\n\n');
            const lastItem = history[history.length - 1];
            setContent(combinedText);
            setAudioUrl(lastItem.audio_url);
            setVisualUrl(lastItem.visual_url);
            setLearningState(lastItem.state_at_generation || 'Focused');
            setLearningReason(lastItem.adaptation_reason || 'Restored from history.');
          }
        }
        setHasLoadedHistory(true);
      } catch (err) {
        console.error("Failed to load history:", err);
        setHasLoadedHistory(true); // Don't block even on error
      }
    };
    
    loadHistory();
  }, [sessionId, hasLoadedHistory]);

  const requestNextChunk = useCallback(async (query) => {
    if (!sessionId) return;
    
    setIsStreaming(true);
    setAudioUrl(null);
    setVisualUrl(null);
    // Add a couple newlines if there is previous content, to separate chunks
    setContent(prev => prev ? prev + '\n\n' : prev);

    try {
      const token = await getAuthToken();
      const url = `${API_BASE_URL}/learning/stream?session_id=${sessionId}&query=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream'
        }
      });
      
      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete fragment in the buffer
        buffer = lines.pop() || '';

        let currentEvent = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;

            const data = JSON.parse(dataStr);
            
            if (currentEvent === 'state_update') {
              setLearningState(data.state);
              setLearningReason(data.reason);
            } else if (currentEvent === 'text_chunk') {
              setContent(prev => prev + data.content);
            } else if (currentEvent === 'audio_url') {
              setAudioUrl(data.url);
            } else if (currentEvent === 'visual_url') {
              setVisualUrl(data.url);
            } else if (currentEvent === 'done') {
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('SSE Error:', error);
      setContent(prev => prev + '\n\n*(Error communicating with the learning agent. Please check your connection.)*');
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId]);

  return { 
    content, 
    isStreaming, 
    learningState, 
    learningReason, 
    audioUrl, 
    visualUrl, 
    requestNextChunk,
    hasLoadedHistory 
  };
}
