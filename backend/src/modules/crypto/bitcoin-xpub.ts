/**
 * Bitcoin addresses from an extended public key.
 *
 * A Bitcoin wallet does not have "an address": it hands out a new one for every
 * payment and sends change to yet another. Watching a single address therefore
 * shows a balance that is wrong for almost everybody. What a wallet does export
 * is an extended public key — xpub, ypub or zpub — from which every address it
 * will ever use can be derived, and nothing can be spent.
 *
 * The prefix says which kind of address the wallet makes:
 *   xpub → 1… (P2PKH)   ypub → 3… (P2SH-wrapped SegWit)   zpub → bc1… (SegWit)
 */

import { ripemd160 } from '@noble/hashes/legacy';
import { sha256 } from '@noble/hashes/sha2';
import { base58check as base58checkWith, bech32 } from '@scure/base';
import { HDKey } from '@scure/bip32';

const base58check = base58checkWith(sha256);

/** Version bytes of the public half of each extended-key flavour. */
const VERSIONS: Record<ExtendedKeyKind, number> = {
  xpub: 0x0488b21e,
  ypub: 0x049d7cb2,
  zpub: 0x04b24746,
};

export type ExtendedKeyKind = 'xpub' | 'ypub' | 'zpub';

/** Mainnet address version bytes. */
const P2PKH_VERSION = 0x00;
const P2SH_VERSION = 0x05;

export function extendedKeyKind(value: string): ExtendedKeyKind | null {
  const prefix = value.trim().slice(0, 4).toLowerCase();
  if (prefix === 'xpub' || prefix === 'ypub' || prefix === 'zpub') {
    return prefix;
  }
  return null;
}

export function isExtendedKey(value: string): boolean {
  return extendedKeyKind(value) !== null && value.trim().length >= 100;
}

/**
 * `count` addresses of one chain — 0 is the addresses handed out, 1 is where
 * change goes — starting at `from`. The key is the account level, which is what
 * every wallet exports, so the path below it is `chain/index`.
 */
export function deriveAddresses(
  extendedKey: string,
  options: { chain: 0 | 1; from: number; count: number },
): string[] {
  const kind = extendedKeyKind(extendedKey);
  if (!kind) {
    throw new Error('Not an extended public key');
  }

  const account = HDKey.fromExtendedKey(extendedKey.trim(), {
    public: VERSIONS[kind],
    // Only the public half is ever accepted here: an extended private key would
    // let this process spend, and Lumio never holds anything that can.
    private: 0x7fffffff,
  });
  const branch = account.deriveChild(options.chain);

  const addresses: string[] = [];
  for (let index = options.from; index < options.from + options.count; index += 1) {
    const child = branch.deriveChild(index);
    if (!child.publicKey) {
      throw new Error('Extended key has no public half');
    }
    addresses.push(addressFor(kind, child.publicKey));
  }
  return addresses;
}

function addressFor(kind: ExtendedKeyKind, publicKey: Uint8Array): string {
  const keyHash = hash160(publicKey);
  if (kind === 'zpub') {
    return bech32.encode('bc', [0, ...bech32.toWords(keyHash)]);
  }
  if (kind === 'ypub') {
    // The script that is hashed is the witness program, not the key.
    const witnessProgram = new Uint8Array([0x00, 0x14, ...keyHash]);
    return base58check.encode(new Uint8Array([P2SH_VERSION, ...hash160(witnessProgram)]));
  }
  return base58check.encode(new Uint8Array([P2PKH_VERSION, ...keyHash]));
}

export function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}
