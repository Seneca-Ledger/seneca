import { bech32 } from '@scure/base';
import {
  deriveAddresses,
  extendedKeyKind,
  isExtendedKey,
} from '../../../../src/modules/crypto/bitcoin-xpub';

/**
 * The account key of the BIP-84 test vector (the "abandon … about" mnemonic),
 * whose first addresses the specification states outright.
 */
const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';

describe('extended keys', () => {
  it('reads the flavour off the prefix', () => {
    expect(extendedKeyKind(ZPUB)).toBe('zpub');
    expect(extendedKeyKind('xpub661MyMwAqRbc')).toBe('xpub');
    expect(extendedKeyKind('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu')).toBeNull();
  });

  it('does not take a plain address for an extended key', () => {
    expect(isExtendedKey('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu')).toBe(false);
    expect(isExtendedKey(ZPUB)).toBe(true);
  });

  it('derives the addresses the BIP-84 vector states', () => {
    expect(deriveAddresses(ZPUB, { chain: 0, from: 0, count: 2 })).toEqual([
      'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
      'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g',
    ]);
    expect(deriveAddresses(ZPUB, { chain: 1, from: 0, count: 1 })).toEqual([
      'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el',
    ]);
  });

  it('keeps receiving and change addresses apart', () => {
    const [receive] = deriveAddresses(ZPUB, { chain: 0, from: 0, count: 1 });
    const [change] = deriveAddresses(ZPUB, { chain: 1, from: 0, count: 1 });

    expect(receive).not.toBe(change);
  });

  it('starts where it is told to', () => {
    const [second] = deriveAddresses(ZPUB, { chain: 0, from: 1, count: 1 });

    expect(second).toBe(deriveAddresses(ZPUB, { chain: 0, from: 0, count: 2 })[1]);
  });

  it('encodes a witness program of the right shape', () => {
    const [address] = deriveAddresses(ZPUB, { chain: 0, from: 0, count: 1 });
    const decoded = bech32.decode(address as `bc1${string}`);

    // Witness version 0 and a 20-byte key hash: anything else is not an address.
    expect(decoded.prefix).toBe('bc');
    expect(decoded.words[0]).toBe(0);
    expect(bech32.fromWords(decoded.words.slice(1))).toHaveLength(20);
  });

  it('refuses anything that is not an extended public key', () => {
    expect(() => deriveAddresses('not a key', { chain: 0, from: 0, count: 1 })).toThrow();
  });
});
