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

/**
 * IPv6 ranges that are local or lead back into IPv4/private networks. Checked
 * as subnets rather than string prefixes, so uncompressed or zero-padded
 * spellings ('0:0:0:0:0:0:0:1') cannot slip past.
 * - ::/8 holds ::, ::1, IPv4-mapped/-compatible addresses and NAT64 64:ff9b::/96
 *   and 64:ff9b:1::/48, which a NAT64 gateway turns into any IPv4 address
 * - 2002::/16 is 6to4, which embeds an IPv4 address
 * - fe80::/9 covers link-local fe80::/10 and the deprecated site-local fec0::/10
 */
const BLOCKED_IPV6_SUBNETS: Array<[string, number]> = [
  ['::', 8],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 9],
  ['ff00::', 8],
];

const blockedIpv6 = new net.BlockList();
for (const [prefix, bits] of BLOCKED_IPV6_SUBNETS) {
  blockedIpv6.addSubnet(prefix, bits, 'ipv6');
}

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
    // A zone id ('fe80::1%eth0') names the interface, not the address.
    return blockedIpv6.check(address.split('%')[0], 'ipv6');
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
 * Resolves a user-supplied host once, refuses it as `assertPublicEgressHost`
 * does, and returns the address to connect to, keeping the name for TLS (SNI
 * and the certificate check). For clients that resolve names themselves and
 * take no lookup hook (nodemailer): the address that was checked is the one
 * connected to, so a resolver cannot answer the check with a public address and
 * the socket with a private one (DNS rebinding). IPv4 first, as nodemailer
 * prefers it too.
 */
export async function pinPublicEgressHost(
  host: string,
): Promise<{ host: string; servername?: string }> {
  const normalizedHost = host.trim().replace(/^\[|\]$/g, '');
  if (net.isIP(normalizedHost)) {
    await assertPublicEgressHost(normalizedHost);
    return { host: normalizedHost };
  }

  let records: LookupResult = [];
  await assertPublicEgressHost(normalizedHost, {
    lookup: async name => {
      records = await dns.lookup(name, { all: true });
      return records;
    },
  });
  const pinned = records.find(record => net.isIPv4(record.address)) ?? records[0];
  return { host: pinned.address, servername: normalizedHost };
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
 * lookup. The undici major must match the one Node bundles (7 on Node 24):
 * global fetch takes no other dispatcher.
 */
const publicEgressDispatcher = new UndiciAgent({
  connect: { lookup: createPublicEgressLookup() },
});

const MAX_EGRESS_REDIRECTS = 3;

/** Credentials for the first host that a redirect to another origin must not carry. */
const CROSS_ORIGIN_DROPPED_HEADERS = ['authorization', 'cookie', 'proxy-authorization'];

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
  let nextInit: RequestInit = isMethodPreserving
    ? init
    : { ...init, method: 'GET', body: undefined };
  if (init.headers && new URL(target).origin !== new URL(normalizedUrl).origin) {
    const headers = new Headers(init.headers);
    for (const name of CROSS_ORIGIN_DROPPED_HEADERS) {
      headers.delete(name);
    }
    nextInit = { ...nextInit, headers };
  }

  return fetchPublicUrl(target, nextInit, redirectsLeft - 1);
}
