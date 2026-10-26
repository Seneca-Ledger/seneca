/**
 * Runs `callback` once the current content has been painted (two animation
 * frames) and the browser is idle, so measuring never competes with the
 * first paint. Returns a cancel function.
 */
export function afterPaint(callback: () => void, idleTimeoutMs = 2000): () => void {
  let cancelled = false;
  let idle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (): void => {
    if (!cancelled) {
      callback();
    }
  };
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (typeof requestIdleCallback === 'function') {
        idle = requestIdleCallback(run, { timeout: idleTimeoutMs });
      } else {
        timer = setTimeout(run, 0);
      }
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    if (idle !== undefined && typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(idle);
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  };
}
