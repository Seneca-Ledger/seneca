import express from 'express';
import { resolveTrustProxy } from '@/common/utils/trust-proxy.util';

describe('resolveTrustProxy', () => {
  // Express compiles the setting into the function that decides whom to believe.
  const trusts = (value: string | undefined, peer: string) => {
    const app = express();
    app.set('trust proxy', resolveTrustProxy(value));
    return (app.get('trust proxy fn') as (address: string, hop: number) => boolean)(peer, 0);
  };

  it('keeps trusting one hop when unset, as before', () => {
    expect(resolveTrustProxy(undefined)).toBe(1);
    expect(resolveTrustProxy('  ')).toBe(1);
  });

  it('reads hop counts and booleans', () => {
    expect(resolveTrustProxy('2')).toBe(2);
    expect(resolveTrustProxy('true')).toBe(true);
    expect(resolveTrustProxy('false')).toBe(false);
  });

  // The point of the setting: a client connecting from a public address cannot
  // name its own IP once only the proxy's networks are trusted.
  it('trusts only the named networks when given an address list', () => {
    const list = 'loopback, linklocal, uniquelocal';

    expect(trusts(list, '172.18.0.5')).toBe(true);
    expect(trusts(list, '127.0.0.1')).toBe(true);
    expect(trusts(list, '203.0.113.9')).toBe(false);
    expect(trusts('false', '172.18.0.5')).toBe(false);
  });
});
