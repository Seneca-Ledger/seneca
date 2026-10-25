import { lookup as dnsLookup, promises as dns } from 'node:dns';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { BadRequestException } from '@nestjs/common';
import {
  assertPublicEgressHost,
  assertPublicEgressUrl,
  createPublicEgressLookup,
  fetchPublicUrl,
  isBlockedEgressAddress,
  pinPublicEgressHost,
} from '@/common/utils/egress-url.util';
import { Agent } from 'undici';

describe('egress-url.util', () => {
  it.each(['127.0.0.1', '10.0.0.5', '172.16.1.1', '192.168.1.20', '169.254.169.254', '::1'])(
    'blocks private or local address %s',
    address => {
      expect(isBlockedEgressAddress(address)).toBe(true);
    },
  );

  // Ranges that reach IPv4 or local networks through IPv6: NAT64 (64:ff9b::/96,
  // 64:ff9b:1::/48), 6to4 (2002::/16) and the deprecated site-local fec0::/10,
  // plus spellings of loopback that are not the compressed '::1'.
  it.each([
    '64:ff9b::7f00:1',
    '64:ff9b:1::a00:1',
    '2002:7f00:1::',
    'fec0::1',
    'feff::1',
    '0:0:0:0:0:0:0:1',
    '0000:0000:0000:0000:0000:0000:0000:0001',
    '::ffff:127.0.0.1',
    'fe80::1%eth0',
    'FC00::1',
  ])('blocks IPv6 address %s that leads to a private network', address => {
    expect(isBlockedEgressAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888'])(
    'allows public address %s',
    address => {
      expect(isBlockedEgressAddress(address)).toBe(false);
    },
  );

  it('rejects private literal URL hosts before any network request', async () => {
    await expect(assertPublicEgressUrl('http://169.254.169.254/latest')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects resolved private DNS addresses', async () => {
    await expect(
      assertPublicEgressHost('metadata.google.internal', {
        lookup: jest.fn().mockResolvedValue([{ address: '169.254.169.254' }]),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('fetchPublicUrl', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  const respond = (status: number, location?: string): Response =>
    ({
      status,
      headers: { get: (name: string) => (name === 'location' ? (location ?? null) : null) },
    }) as unknown as Response;

  it('refuses a destination that resolves to a private address', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(fetchPublicUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
      BadRequestException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses a non-http protocol', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(fetchPublicUrl('file:///etc/passwd')).rejects.toThrow(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // The bypass this function exists for: the destination passes validation and
  // then redirects somewhere private.
  it('does not follow a redirect to a blocked address', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        respond(302, 'http://169.254.169.254/latest/meta-data'),
      ) as unknown as typeof fetch;

    await expect(fetchPublicUrl('http://8.8.8.8/start')).rejects.toThrow(BadRequestException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('never lets plain fetch follow redirects on its own', async () => {
    const spy = jest.fn().mockResolvedValue(respond(200));
    global.fetch = spy as unknown as typeof fetch;

    await fetchPublicUrl('http://8.8.8.8/ok');

    expect(spy.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: 'manual' }));
  });

  // Validation and connection resolve separately; the dispatcher makes the
  // connection repeat the check so DNS rebinding cannot slip between them.
  it('connects through a dispatcher that re-checks resolved addresses', async () => {
    const spy = jest.fn().mockResolvedValue(respond(200));
    global.fetch = spy as unknown as typeof fetch;

    await fetchPublicUrl('http://8.8.8.8/ok');

    expect(spy.mock.calls[0][1]).toEqual(expect.objectContaining({ dispatcher: expect.anything() }));
  });

  it('stops after too many redirects instead of looping', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(respond(302, 'http://8.8.8.8/next')) as unknown as typeof fetch;

    await expect(fetchPublicUrl('http://8.8.8.8/start')).rejects.toThrow(
      'Destination redirected too many times',
    );
  });

  it('drops the body when a redirect changes the method to GET', async () => {
    const spy = jest
      .fn()
      .mockResolvedValueOnce(respond(302, 'http://1.1.1.1/next'))
      .mockResolvedValueOnce(respond(200));
    global.fetch = spy as unknown as typeof fetch;

    await fetchPublicUrl('http://8.8.8.8/start', { method: 'POST', body: 'secret' });

    expect(spy.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });

  // A credential meant for the first host must not be replayed to whatever host
  // that one redirects to.
  it('drops Authorization and Cookie when a redirect leaves the origin', async () => {
    const spy = jest
      .fn()
      .mockResolvedValueOnce(respond(302, 'http://1.1.1.1/next'))
      .mockResolvedValueOnce(respond(200));
    global.fetch = spy as unknown as typeof fetch;

    await fetchPublicUrl('http://8.8.8.8/start', {
      headers: { Authorization: 'Basic c2VjcmV0', Cookie: 'sid=1', Accept: 'text/csv' },
    });

    const headers = new Headers(spy.mock.calls[1][1].headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('accept')).toBe('text/csv');
    expect(new Headers(spy.mock.calls[0][1].headers).get('authorization')).toBe('Basic c2VjcmV0');
  });

  it('keeps Authorization on a redirect within the same origin', async () => {
    const spy = jest
      .fn()
      .mockResolvedValueOnce(respond(302, '/next'))
      .mockResolvedValueOnce(respond(200));
    global.fetch = spy as unknown as typeof fetch;

    await fetchPublicUrl('http://8.8.8.8/start', { headers: { Authorization: 'Bearer t' } });

    expect(new Headers(spy.mock.calls[1][1].headers).get('authorization')).toBe('Bearer t');
  });

  it('keeps the method and body for a 308, which preserves them by spec', async () => {
    const spy = jest
      .fn()
      .mockResolvedValueOnce(respond(308, 'http://1.1.1.1/next'))
      .mockResolvedValueOnce(respond(200));
    global.fetch = spy as unknown as typeof fetch;

    await fetchPublicUrl('http://8.8.8.8/start', { method: 'POST', body: 'payload' });

    expect(spy.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'POST', body: 'payload' }),
    );
  });
});

describe('createPublicEgressLookup', () => {
  const lookupOnce = (records: Array<{ address: string; family: number }>, all: boolean) => {
    jest.spyOn(dns, 'lookup').mockResolvedValueOnce(records as never);
    return new Promise<{ error: NodeJS.ErrnoException | null; address: unknown }>(resolve => {
      createPublicEgressLookup()('example.test', { all }, (error, address) =>
        resolve({ error, address }),
      );
    });
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers with the first address for a single-address lookup', async () => {
    const result = await lookupOnce([{ address: '93.184.216.34', family: 4 }], false);
    expect(result).toEqual({ error: null, address: '93.184.216.34' });
  });

  it('answers with every address when asked for all of them', async () => {
    const records = [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ];
    const result = await lookupOnce(records, true);
    expect(result).toEqual({ error: null, address: records });
  });

  it('refuses the host when any resolved address is private', async () => {
    const result = await lookupOnce(
      [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
      true,
    );
    expect(result.error?.code).toBe('EHOSTUNREACH');
  });
});

describe('pinPublicEgressHost', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects to the checked address and keeps the name for TLS', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValueOnce([
      { address: '2a00:1450:4001:c02::6c', family: 6 },
      { address: '142.250.102.108', family: 4 },
    ] as never);

    await expect(pinPublicEgressHost('smtp.example.test')).resolves.toEqual({
      host: '142.250.102.108',
      servername: 'smtp.example.test',
    });
  });

  it('refuses a name that resolves to a private address', async () => {
    jest
      .spyOn(dns, 'lookup')
      .mockResolvedValueOnce([{ address: '10.0.0.25', family: 4 }] as never);

    await expect(pinPublicEgressHost('smtp.example.test')).rejects.toThrow(BadRequestException);
  });

  it('passes a public IP literal through and refuses a private one', async () => {
    await expect(pinPublicEgressHost('8.8.8.8')).resolves.toEqual({ host: '8.8.8.8' });
    await expect(pinPublicEgressHost('127.0.0.1')).rejects.toThrow(BadRequestException);
  });
});

describe('the undici dependency', () => {
  // fetchPublicUrl hands an undici Agent to Node's own fetch, which only takes
  // a dispatcher of the undici major Node bundles (undici 8 on Node 24 fails
  // every request with "invalid onRequestStart method"). The other tests mock
  // fetch, so this one goes through the real thing.
  it("is a dispatcher Node's fetch accepts", async () => {
    const server = createServer((_request, response) => response.end('ok'));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        dispatcher: new Agent({ connect: { lookup: dnsLookup } }),
      } as RequestInit);
      expect(await response.text()).toBe('ok');
    } finally {
      server.close();
    }
  });
});
