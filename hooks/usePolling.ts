
import { useEffect, useRef } from 'react';

/**
 * A custom hook for polling an async function at a specified interval.
 * It's lifecycle-aware and ensures that a new request is not sent until the previous one has completed.
 * @param callback The async function to execute.
 * @param delay The polling interval in milliseconds. Can be null to disable polling.
 */
export const usePolling = (callback: () => Promise<void>, delay: number | null) => {
  const savedCallback = useRef(callback);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    let timeoutId: number;

    async function tick() {
      try {
        await savedCallback.current();
      } catch (err) {
        // Log polling errors but don't let them crash the app.
        console.error("Error during polling execution:", err);
      }

      if (delay !== null) {
        // Schedule the next tick only after the current one has completed.
        timeoutId = window.setTimeout(tick, delay);
      }
    }
    if (delay !== null) {
      // Start the polling immediately without waiting for the first delay
      tick(); 
      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }
  }, [delay]);
};