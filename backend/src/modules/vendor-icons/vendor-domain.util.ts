import { isIP } from 'node:net';

/**
 * A vendor website host, as it may be stored on a subscription and used as the
 * path segment of the icon proxy. Lowercase ASCII labels, at least one dot, no
 * leading or trailing hyphen, 253 characters at most.
 *
 * Both the subscription DTOs and the proxy import this, so the proxy can never
 * accept a value the DTOs reject.
 */
export const VENDOR_DOMAIN_PATTERN =
  /^(?=.{4,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/**
 * Bare IPs pass the label pattern (`1.2.3.4`) but are never a brand's website,
 * and pointing the proxy at one would be the start of an SSRF probe.
 */
export function isValidVendorDomain(value: string): boolean {
  return VENDOR_DOMAIN_PATTERN.test(value) && isIP(value) === 0;
}
