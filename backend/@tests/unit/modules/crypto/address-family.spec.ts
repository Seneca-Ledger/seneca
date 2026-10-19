import { familyForAddress } from '../../../../src/modules/crypto/crypto.constants';

describe('familyForAddress', () => {
  it.each([
    ['0x899cd926a9028afe9056e76cc01f32ee859e7a65', 'evm'],
    ['TLLU15qbiSEqv2y3DLfbHTHS5TVdjQ7hoJ', 'tron'],
    ['bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'bitcoin'],
    ['bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297', 'bitcoin'],
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'bitcoin'],
    ['3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'bitcoin'],
    ['vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg', 'solana'],
    ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'solana'],
  ])('reads %s as %s', (address, family) => {
    expect(familyForAddress(address)).toBe(family);
  });

  it('tells a Solana key starting with 1 from a Bitcoin address by its bytes', () => {
    // Base58 like a legacy Bitcoin address, but 32 bytes and no checksum.
    expect(familyForAddress('11111111111111111111111111111111')).toBe('solana');
  });

  it('rejects a Bitcoin or Tron address with a broken checksum', () => {
    expect(familyForAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb')).toBeNull();
    expect(familyForAddress('TLLU15qbiSEqv2y3DLfbHTHS5TVdjQ7hoK')).toBeNull();
  });

  it('rejects a mixed-case bech32 address and plain garbage', () => {
    expect(familyForAddress('bc1QXY2KGDYGJRSQTZQ2N0YRF2493P83KKFJHX0WLH')).toBeNull();
    expect(familyForAddress('hello world')).toBeNull();
  });
});
