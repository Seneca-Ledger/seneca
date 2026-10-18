import { promises as dns } from 'node:dns';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import type { LookupFunction } from 'node:net';
import * as net from 'node:net';
import { BadRequestException } from '@nestjs/common';
import { Agent as UndiciAgent } from 'undici';

type LookupResult = Array<{ address: string }>;
type LookupFn = (host: string) => Promise<LookupResult>;
type EgressValidationOptions = {
  lookup?: LookupFn;
};

const IPV4_PRIVATE_RANGES: Array<[number, number]> = [
  [ipv4ToNumber('0.0.0.0'), ipv4ToNumber('0.255.255.255')],
  [ipv4ToNumber('10.0.0.0'), ipv4ToNumber('10.255.255.255')],
  [ipv4ToNumber('100.64.0.0'), ipv4ToNumber('100.127.255.255')],
  [ipv4ToNumber('127.0.0.0'), ipv4ToNumber('127.255.255.255')],
  [ipv4ToNumber('169.254.0.0'), ipv4ToNumber('169.254.255.255')],
  [ipv4ToNumber('172.16.0.0'), ipv4ToNumber('172.31.255.255')],
  [ipv4ToNumber('192.0.0.0'), ipv4ToNumber('192.0.0.255')],
  [ipv4ToNumber('192.0.2.0'), ipv4ToNumber('192.0.2.255')],
  [ipv4ToNumber('192.168.0.0'), ipv4ToNumber('192.168.255.255')],
  [ipv4ToNumber('198.18.0.0'), ipv4ToNumber('198.19.255.255')],
  [ipv4ToNumber('198.51.100.0'), ipv4ToNumber('198.51.100.255')],
  [ipv4ToNumber('203.0.113.0'), ipv4ToNumber('203.0.113.255')],
  [ipv4ToNumber('224.0.0.0'), ipv4ToNumber('255.255.255.255')],
];

const BLOCKED_IPV6_PREFIXES = [
  '::1',
  '::',
  'fc',
  'fd',
  'fe8',
  'fe9',
  'fea',
  'feb',
  'ff',
  '2001:db8',
];

function ipv4ToNumber(address: string): number {
  return (
    address.split('.').reduce((sum, octet) => (sum << 8) + Number.parseInt(octet, 10), 0) >>> 0
  );
}

export function isBlockedEgressAddress(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    const value = ipv4ToNumber(address);
    return IPV4_PRIVATE_RANGES.some(([start, end]) => value >= start && value <= end);
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    return BLOCKED_IPV6_PREFIXES.some(
      prefix => normalized === prefix || normalized.startsWith(prefix),
    );
  }

  return false;
}

export async function assertPublicEgressHost(
  host: string,
  options: EgressValidationOptions = {},
): Promise<void> {
  const normalizedHost = host.trim().replace(/^\[|\]$/g, '');
  if (!normalizedHost || normalizedHost.toLowerCase() === 'localhost') {
    throw new BadRequestException('Destination host is not allowed');
  }

  if (net.isIP(normalizedHost)) {
    if (isBlockedEgressAddress(normalizedHost)) {
      throw new BadRequestException('Destination address is not allowed');
    }
    return;
  }

  const lookup = options.lookup || (async (name: string) => dns.lookup(name, { all: true }));
  // A name that does not resolve is the caller's typo, not a server failure.
  const records = await lookup(normalizedHost).catch(() => {
    throw new BadRequestException('Destination host cannot be resolved');
  });
  if (records.length === 0 || records.some(record => isBlockedEgressAddress(record.address))) {
    throw new BadRequestException('Destination resolves to a blocked address');
  }
}

export async function assertPublicEgressUrl(
  value: string,
  options: EgressValidationOptions = {},
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BadRequestException('Destination URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('Destination URL protocol is not allowed');
  }

  await assertPublicEgressHost(parsed.hostname, options);
  return parsed;
}

/**
 * A socket lookup that refuses a host when any address it resolves to is
 * blocked. Node 20 connects with autoSelectFamily, which asks for every address
 * (`all: true`) and expects them as a list; other callers want the first one.
 */
export function createPublicEgressLookup(): LookupFunction {
  return (hostname, options, callback) => {
    dns
      .lookup(hostname, { all: true })
      .then(records => {
        if (
          records.length === 0 ||
          records.some(record => isBlockedEgressAddress(record.address))
        ) {
          const error = new Error(
            'Destination resolves to a blocked address',
          ) as NodeJS.ErrnoException;
          error.code = 'EHOSTUNREACH';
          callback(error, '', 4);
          return;
        }
        if (options?.all) {
          callback(null, records);
          return;
        }
        callback(null, records[0].address, records[0].family);
      })
      .catch(error => callback(error as NodeJS.ErrnoException, '', 4));
  };
}

export function createPublicEgressHttpAgents() {
  const lookup = createPublicEgressLookup();
  return {
    lookup,
    httpAgent: new HttpAgent({ lookup }),
    httpsAgent: new HttpsAgent({ lookup }),
  };
}

/**
 * Connects fetches only to addresses that pass the same check as the URL, so a
 * resolver cannot answer the validation with a public address and the socket
 * with a private one (DNS rebinding). There is no fallback to an unchecked
 * lookup. The undici major matches the one Node 20 bundles, which global fetch
 * requires of a dispatcher.
 */
const publicEgressDispatcher = new UndiciAgent({
  connect: { lookup: createPublicEgressLookup() },
});

const MAX_EGRESS_REDIRECTS = 3;

/**
 * `fetch` for user-supplied destinations.
 *
 * `assertPublicEgressUrl` alone is not enough when it only runs at the moment a
 * URL is saved: the host can start resolving somewhere private afterwards, and
 * plain `fetch` follows redirects, so one 302 to 169.254.169.254 walks straight
 * past a check done earlier. This re-validates on every hop and refuses to
 * follow a redirect it has not validated.
 *
 * The connection itself goes through `publicEgressDispatcher`, whose lookup
 * repeats the address check, so a resolver that answers differently between
 * this validation and the socket (DNS rebinding) cannot reach a private
 * address. `createPublicEgressHttpAgents` does the same for axios/node-http.
 */
export async function fetchPublicUrl(
  url: string,
  init: RequestInit = {},
  redirectsLeft = MAX_EGRESS_REDIRECTS,
): Promise<Response> {
  // Fetch exactly what was validated: the parsed, normalised URL the check returns
  // rather than the caller's raw string. An unparsable URL or a non-http(s)
  // protocol is a 400 there, not a TypeError here.
  const normalizedUrl = (await assertPublicEgressUrl(url)).toString();

  // `dispatcher` is undici's extension to fetch; lib.dom's RequestInit does not declare it.
  const response = await fetch(normalizedUrl, {
    ...init,
    redirect: 'manual',
    dispatcher: publicEgressDispatcher,
  } as RequestInit);

  if (response.status < 300 || response.status >= 400) {
    return response;
  }

  const location = response.headers.get('location');
  if (!location) {
    return response;
  }

  if (redirectsLeft <= 0) {
    throw new BadRequestException('Destination redirected too many times');
  }

  const target = new URL(location, normalizedUrl).toString();
  // A redirect turns the follow-up into a GET unless it is 307/308, and the
  // original body must not be replayed to a new host either way.
  const isMethodPreserving = response.status === 307 || response.status === 308;
  const nextInit: RequestInit = isMethodPreserving
    ? init
    : { ...init, method: 'GET', body: undefined };

  return fetchPublicUrl(target, nextInit, redirectsLeft - 1);
}
