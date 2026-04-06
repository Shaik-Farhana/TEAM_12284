import { useEffect, useRef, useCallback } from 'react';
import { fetchWithAuth } from '../services/api';

export function useBehaviorTracker(sessionId, isReading) {
  const eventsBatch = useRef([]);

  const flushEvents = useCallback(async () => {
    if (eventsBatch.current.length === 0 || !sessionId) return;
    const payload = [...eventsBatch.current];
    eventsBatch.current = [];
    try {
      await fetchWithAuth('/learning/behavior', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Failed to send behavior events:", err);
    }
  }, [sessionId]);

  const triggerReread = useCallback(() => {
    if (!sessionId) return;
    eventsBatch.current.push({
      session_id: sessionId,
      event_type: 'reread',
      pause_duration: null,
      reading_speed_wpm: null,
      timestamp: new Date().toISOString()
    });
    flushEvents();
  }, [sessionId, flushEvents]);

  const triggerVisionDrift = useCallback((reason) => {
    if (!sessionId) return;
    eventsBatch.current.push({
      session_id: sessionId,
      event_type: 'VisionDistractionStart',
      pause_duration: 0, // Duration will be recorded when they return
      reading_speed_wpm: null,
      vision_metadata: reason,
      timestamp: new Date().toISOString()
    });
    flushEvents();
  }, [sessionId, flushEvents]);

  const recordVisionFocusRegained = useCallback((duration) => {
    if (!sessionId || duration < 0.5) return;
    eventsBatch.current.push({
      session_id: sessionId,
      event_type: 'VisionDistractionEnd',
      pause_duration: duration,
      reading_speed_wpm: null,
      vision_metadata: JSON.stringify({ duration }),
      timestamp: new Date().toISOString()
    });
    flushEvents();
  }, [sessionId, flushEvents]);

  const recordTabDistraction = useCallback((duration) => {
    if (!sessionId || duration < 1.0) return;
    eventsBatch.current.push({
      session_id: sessionId,
      event_type: 'TabDistractionEnd',
      pause_duration: duration,
      reading_speed_wpm: null,
      vision_metadata: "Tab hidden",
      timestamp: new Date().toISOString()
    });
    flushEvents();
  }, [sessionId, flushEvents]);

  // Periodic flush for robustness
  useEffect(() => {
    if (!isReading || !sessionId) return;
    const interval = setInterval(flushEvents, 10000);
    return () => {
      clearInterval(interval);
      flushEvents();
    };
  }, [sessionId, isReading, flushEvents]);

  // Tab visibility tracking
  const tabHiddenTimeRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabHiddenTimeRef.current = Date.now();
      } else {
        if (tabHiddenTimeRef.current) {
          const duration = (Date.now() - tabHiddenTimeRef.current) / 1000;
          recordTabDistraction(duration);
          tabHiddenTimeRef.current = null;
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [sessionId, recordTabDistraction]);

  return { triggerReread, triggerVisionDrift, recordVisionFocusRegained };
}
