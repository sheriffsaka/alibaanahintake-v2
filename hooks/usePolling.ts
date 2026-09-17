
import { useEffect, useRef } from 'react';

/**
 * A custom hook for polling an async function at a specified interval.
 * It is visibility- and lifecycle-aware:
 * - Automatically pauses polling when the browser tab is hidden/minimized
 * - Instantly triggers a fresh fetch when the user returns to the tab
 * - Ensures a new request is not sent until the previous one has completed
 * @param callback The async function to execute.
 * @param delay The polling interval in milliseconds. Can be null to disable polling.
 */
export const usePolling = (callback: () => Promise<void>, delay: number | null) => {
  const savedCallback = useRef(callback);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval with visibility awareness.
  useEffect(() => {
    let timeoutId: number | undefined;
    let isMounted = true;
    let isExecuting = false;

    async function tick() {
      if (!isMounted) return;
      // Do NOT execute background queries while the tab is hidden
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      if (isExecuting) return;

      isExecuting = true;
      try {
        await savedCallback.current();
      } catch (err) {
        // Log polling errors but don't let them crash the app.
        console.error("Error during polling execution:", err);
      } finally {
        isExecuting = false;
      }

      if (delay !== null && isMounted && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
        // Schedule the next tick only after the current one has completed.
        timeoutId = window.setTimeout(tick, delay);
      }
    }

    const handleVisibilityChange = () => {
      if (!isMounted) return;
      if (document.visibilityState === 'visible') {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        // Immediately refresh when switching back to tab
        tick();
      } else {
        // Pause timer when tab is hidden
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      }
    };

    if (delay !== null) {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        tick();
      }

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        isMounted = false;
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [delay]);
};