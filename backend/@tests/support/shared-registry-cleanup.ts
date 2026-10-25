// The unit project shares one module registry per worker (isolate: false), so
// whatever a spec leaves behind reaches the next file: put back what specs
// commonly replace by hand or forget to undo.
const realFetch = globalThis.fetch;
const realEnv = { ...process.env };

afterAll(() => {
  globalThis.fetch = realFetch;
  // Specs point UPLOADS_DIR and friends at temp dirs.
  for (const key of Object.keys(process.env)) {
    if (!(key in realEnv)) delete process.env[key];
  }
  Object.assign(process.env, realEnv);
  vi.useRealTimers();
  vi.restoreAllMocks();
});
