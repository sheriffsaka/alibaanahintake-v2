import { useEffect, useRef } from 'react';

/**
 * A custom hook for polling an async function at a specified interval.
 * It's lifecycle-aware and ensures that a new request is not sent until the previous one has completed.
 * @param callback The async function to execute.
 * @param delay The polling interval in milliseconds. Can be null to disable polling.
 */
export const usePolling = (callback: () => Promise<void>, delay: number | null) => {
  // FIX: Initialize useRef with the callback. Although useRef() is valid, the error
  // "Expected 1 arguments, but got 0" may indicate a tool struggling with an
  // uninitialized ref. This change makes the hook more robust by ensuring
  // `savedCallback.current` is always a function.
  const savedCallback = useRef(callback);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    let timeoutId: number;

    async function tick() {
      // Since the ref is now initialized, the .current property will always be defined.
      await savedCallback.current();

      if (delay !== null) {
        timeoutId = window.setTimeout(tick, delay);
      }
    }
    if (delay !== null) {
      // Start the polling immediately without waiting for the first delay
      tick(); 
      return () => window.clearTimeout(timeoutId);
    }
  }, [delay]);
};
