import type { Request } from 'express';

/** The app origin a request came from, for links in invitation e-mails. */
export function requestAppOrigin(req: Request): string | undefined {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && originHeader.trim().length > 0) {
    return originHeader;
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === 'string' && refererHeader.trim().length > 0) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      // ignore
    }
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.headers.host;
  if (typeof host === 'string' && host.trim().length > 0) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protoRaw = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const proto = typeof protoRaw === 'string' && protoRaw.length > 0 ? protoRaw : 'https';
    return `${proto}://${host}`;
  }

  return undefined;
}
