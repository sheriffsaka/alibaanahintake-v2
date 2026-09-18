/**
 * Typed error indicating an asynchronous operation exceeded its hard deadline.
 */
export class HardTimeoutError extends Error {
  readonly isHardTimeout: boolean = true;
  readonly timeoutMs: number;
  readonly operationName?: string;

  constructor(message: string = "Operation timed out", timeoutMs: number = 15000, operationName?: string) {
    super(message);
    this.name = 'HardTimeoutError';
    this.timeoutMs = timeoutMs;
    this.operationName = operationName;
    Object.setPrototypeOf(this, HardTimeoutError.prototype);
  }
}

/**
 * Type guard for HardTimeoutError.
 */
export const isHardTimeoutError = (error: unknown): error is HardTimeoutError => {
  if (!error || typeof error !== 'object') return false;
  return (
    error instanceof HardTimeoutError ||
    (error as { isHardTimeout?: boolean }).isHardTimeout === true ||
    (error as { name?: string }).name === 'HardTimeoutError'
  );
};

/**
 * Standard user-facing message when an operation exceeds its hard deadline.
 */
export const HARD_TIMEOUT_USER_MESSAGE = "Couldn't load — something's taking too long";

/**
 * Races an async operation against a timeout.
 * 
 * Guarantees:
 * - If the operation completes before the timeout, its result is returned.
 * - If the timeout fires first, a HardTimeoutError is thrown immediately to the caller.
 * - The original promise continues running harmlessly in the background (preventing unhandled rejection leaks).
 * - The caller's catch/finally blocks execute immediately when the timeout expires.
 */
export async function withHardTimeout<T>(
  promiseOrFn: Promise<T> | (() => Promise<T>),
  timeoutMs: number = 15000,
  operationName: string = "Operation"
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(
        new HardTimeoutError(
          `${operationName} timed out after ${timeoutMs}ms`,
          timeoutMs,
          operationName
        )
      );
    }, timeoutMs);
  });

  const executionPromise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;

  // Attach a noop catch handler to the underlying promise so that if it fails
  // later in the background after the timeout has fired, it will not trigger an
  // unhandled promise rejection in the browser or test runner.
  executionPromise.catch((bgErr) => {
    // Silent background absorption once caller has already timed out
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.debug(`[withHardTimeout] Background operation "${operationName}" settled after caller moved on:`, bgErr);
    }
  });

  try {
    return await Promise.race([executionPromise, timeoutPromise]);
  } finally {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  }
}

export default withHardTimeout;
