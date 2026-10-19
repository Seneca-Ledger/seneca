import { promises as dns } from 'node:dns';
import { BadRequestException } from '@nestjs/common';
import {
  assertPublicEgressHost,
  assertPublicEgressUrl,
  createPublicEgressLookup,
  fetchPublicUrl,
  isBlockedEgressAddress,
} from '@/common/utils/egress-url.util';

describe('egress-url.util', () => {
  it.each(['127.0.0.1', '10.0.0.5', '172.16.1.1', '192.168.1.20', '169.254.169.254', '::1'])(
    'blocks private or local address %s',
    address => {
      expect(isBlockedEgressAddress(address)).toBe(true);
    },
  );

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
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
