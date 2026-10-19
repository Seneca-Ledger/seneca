const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

/**
 * Origins allowed to make credentialed requests. Shared by the HTTP CORS config
 * and the notifications gateway so a cookie-authenticated WebSocket cannot be
 * opened from an origin the REST API would refuse.
 *
 * The localhost entries are development conveniences and are dropped in
 * production: reflecting them there would let any page running on the victim's
 * own machine talk to the API as them.
 */
export function resolveAllowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    return configured;
  }

  return [...new Set([...configured, ...DEVELOPMENT_ORIGINS])];
}
