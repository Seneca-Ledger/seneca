/**
 * Express `trust proxy` from TRUST_PROXY: which peers may set the client IP
 * through X-Forwarded-For, and so pick the rate-limit bucket of a request.
 *
 * - unset: `1`, one proxy hop in front of the backend (the long-standing default)
 * - a number: that many hops
 * - `true` / `false`: every peer / none
 * - anything else: Express's address list, e.g. `loopback, uniquelocal` or
 *   `10.0.0.0/8, 172.16.0.0/12`
 *
 * With a hop count, a client that reaches the API port directly chooses its own
 * IP by sending X-Forwarded-For. Deployments that publish that port should
 * either close it to everything but the proxy or name the proxy's addresses here.
 */
export function resolveTrustProxy(value: string | undefined): boolean | number | string {
  const setting = value?.trim();
  if (!setting) {
    return 1;
  }
  if (/^\d+$/.test(setting)) {
    return Number(setting);
  }
  if (setting === 'true' || setting === 'false') {
    return setting === 'true';
  }
  return setting;
}
