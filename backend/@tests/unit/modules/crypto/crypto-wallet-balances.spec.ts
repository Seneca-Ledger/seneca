import {
  type EtherscanTokenBalance,
  mapWalletBalances,
} from '../../../../src/modules/crypto/crypto-transfer.mapper';
import { TICKER_BY_CONTRACT } from '../../../../src/modules/crypto/crypto.constants';

const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
/** The "EuroCoin" actually sitting in a real wallet — not Circle's EURC. */
const FAKE_EURC = '0x88f43b9f5a6d4adef8f80d646732f5b6153c2586';

const TICKERS = TICKER_BY_CONTRACT[1];

function token(overrides: Partial<EtherscanTokenBalance> = {}): EtherscanTokenBalance {
  return {
    balance: '0',
    contractAddress: USDT,
    decimals: '6',
    type: 'ERC-20',
    ...overrides,
  };
}

function map(overrides: { nativeBalance?: string; tokens?: EtherscanTokenBalance[] } = {}) {
  return mapWalletBalances({
    nativeAsset: 'ETH',
    nativeBalance: overrides.nativeBalance ?? '0',
    tickerByContract: TICKERS,
    tokens: overrides.tokens ?? [],
  });
}

describe('mapWalletBalances', () => {
  it('reports the native balance to full precision', () => {
    // 18 decimals overflow a float, so the amount has to survive as a string.
    expect(map({ nativeBalance: '1307703707412344' })).toEqual([
      { asset: 'ETH', amount: '0.001307703707412344' },
    ]);
  });

  it('leaves out an asset the address does not hold', () => {
    expect(map({ nativeBalance: '0', tokens: [token({ balance: '0' })] })).toEqual([]);
  });

  it('scales a token by its own decimals', () => {
    expect(map({ tokens: [token({ balance: '1292070' })] })).toEqual([
      { asset: 'USDT', amount: '1.29207' },
    ]);
  });

  it('ignores an NFT, which counts tokens rather than money', () => {
    const nft = token({
      balance: '1',
      decimals: '',
      type: 'ERC-721',
      contractAddress: '0x2214a42d8e2a1d20635c2cb0664422c528b6a432',
    });
    expect(map({ tokens: [nft] })).toEqual([]);
  });

  it('ignores a contract it cannot price, however the token names itself', () => {
    const impostor = token({ balance: '9999000000', contractAddress: FAKE_EURC });

    expect(map({ tokens: [impostor] })).toEqual([]);
  });

  it('keeps the real token when an impostor sits beside it', () => {
    const real = token({ balance: '1292070' });
    const impostor = token({ balance: '9999000000', contractAddress: FAKE_EURC });
    const dai = token({ balance: '2000000000000000000', decimals: '18', contractAddress: DAI });

    expect(map({ nativeBalance: '1000', tokens: [real, impostor, dai] })).toEqual([
      { asset: 'ETH', amount: '0.000000000000001' },
      { asset: 'USDT', amount: '1.29207' },
      { asset: 'DAI', amount: '2' },
    ]);
  });

  it('matches a contract address regardless of its casing', () => {
    expect(map({ tokens: [token({ balance: '1000000', contractAddress: USDT.toUpperCase() })] })
    ).toEqual([{ asset: 'USDT', amount: '1' }]);
  });

  it('sums two rows of the same contract', () => {
    expect(map({ tokens: [token({ balance: '1000000' }), token({ balance: '292070' })] })).toEqual([
      { asset: 'USDT', amount: '1.29207' },
    ]);
  });
});

describe('TICKER_BY_CONTRACT', () => {
  it('maps every contract to exactly one ticker', () => {
    const tickers = Object.values(TICKERS);
    expect(new Set(tickers).size).toBe(tickers.length);
  });

  it('holds lowercase addresses, since that is how lookups arrive', () => {
    for (const address of Object.keys(TICKERS)) {
      expect(address).toBe(address.toLowerCase());
    }
  });
});
