import {
  addDecimals,
  type EtherscanTokenTx,
  type EtherscanTx,
  finalizeTransfers,
  formatUnits,
  mapChainTransfers,
} from '../../../../src/modules/crypto/crypto-transfer.mapper';
import { TICKER_BY_CONTRACT } from '../../../../src/modules/crypto/crypto.constants';

const ME = '0x1111111111111111111111111111111111111111';
const OTHER_OWN = '0x2222222222222222222222222222222222222222';
const STRANGER = '0x3333333333333333333333333333333333333333';
const USDC_CONTRACT = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

function tx(overrides: Partial<EtherscanTx> = {}): EtherscanTx {
  return {
    hash: '0xhash',
    timeStamp: '1750000000',
    from: STRANGER,
    to: ME,
    value: '0',
    gasUsed: '0',
    gasPrice: '0',
    ...overrides,
  };
}

function tokenTx(overrides: Partial<EtherscanTokenTx> = {}): EtherscanTokenTx {
  return {
    hash: '0xtoken',
    timeStamp: '1750000000',
    from: STRANGER,
    to: ME,
    value: '0',
    contractAddress: USDC_CONTRACT,
    tokenDecimal: '6',
    ...overrides,
  };
}

function map(overrides: {
  transactions?: EtherscanTx[];
  tokenTransfers?: EtherscanTokenTx[];
  ownAddresses?: string[];
}) {
  return mapChainTransfers({
    address: ME,
    nativeAsset: 'ETH',
    ownAddresses: overrides.ownAddresses ?? [ME],
    tickerByContract: TICKER_BY_CONTRACT[1],
    transactions: overrides.transactions ?? [],
    tokenTransfers: overrides.tokenTransfers ?? [],
  });
}

describe('mapChainTransfers', () => {
  it('ignores a token transfer from a contract it cannot price', () => {
    // A homoglyph "USDT" airdrop: the symbol is a lie, the address is not.
    const spam = tokenTx({ contractAddress: '0x32e8aed3e1ba6ac970f0c41616bf2a595edb36c4' });

    expect(map({ tokenTransfers: [spam] })).toEqual([]);
  });

  it('books an incoming native transfer as income', () => {
    const [transfer] = map({ transactions: [tx({ value: '1500000000000000000' })] });

    expect(transfer).toMatchObject({
      asset: 'ETH',
      amount: '1.5',
      direction: 'in',
      counterparty: STRANGER,
    });
  });

  it('keeps the gas of an outgoing native transfer off the amount that was sent', () => {
    const transfers = map({
      transactions: [
        tx({
          from: ME,
          to: STRANGER,
          value: '1000000000000000000',
          gasUsed: '21000',
          gasPrice: '1000000000',
        }),
      ],
    });

    // The sent amount is the sent amount; the fee rides along as its own leg until
    // `finalizeTransfers` folds it onto the transfer.
    expect(transfers).toHaveLength(2);
    expect(transfers.find(transfer => transfer.leg === 'fee')).toMatchObject({
      direction: 'out',
      amount: '0.000021',
    });
    expect(transfers.find(transfer => transfer.leg !== 'fee')).toMatchObject({
      direction: 'out',
      amount: '1',
    });
  });

  it('drops a transfer between two wallets the workspace owns', () => {
    const transfers = map({
      transactions: [tx({ from: ME, to: OTHER_OWN, value: '1000000000000000000' })],
      ownAddresses: [ME, OTHER_OWN],
    });

    expect(transfers).toEqual([]);
  });

  it('still books the gas burned by an internal transfer', () => {
    const transfers = map({
      transactions: [
        tx({
          from: ME,
          to: OTHER_OWN,
          value: '1000000000000000000',
          gasUsed: '21000',
          gasPrice: '1000000000',
        }),
      ],
      ownAddresses: [ME, OTHER_OWN],
    });

    expect(transfers).toEqual([
      expect.objectContaining({ direction: 'out', amount: '0.000021', asset: 'ETH', leg: 'fee' }),
    ]);
  });

  it('books only gas for a reverted transaction', () => {
    const transfers = map({
      transactions: [
        tx({
          from: ME,
          to: STRANGER,
          value: '1000000000000000000',
          gasUsed: '21000',
          gasPrice: '1000000000',
          isError: '1',
        }),
      ],
    });

    expect(transfers).toEqual([
      expect.objectContaining({ amount: '0.000021', direction: 'out', leg: 'fee' }),
    ]);
  });

  it('honours each token’s own decimal count', () => {
    const [transfer] = map({ tokenTransfers: [tokenTx({ value: '2500000' })] });

    expect(transfer).toMatchObject({ asset: 'USDC', amount: '2.5', direction: 'in' });
  });

  it('sums several transfers of one asset inside a single transaction', () => {
    const transfers = map({
      tokenTransfers: [tokenTx({ value: '1000000' }), tokenTx({ value: '500000' })],
    });

    expect(transfers).toEqual([expect.objectContaining({ amount: '1.5' })]);
  });

  it('keeps the two legs of a transaction that both sends and receives apart', () => {
    const transfers = map({
      transactions: [tx({ from: ME, to: STRANGER, value: '1000000000000000000' })],
      tokenTransfers: [tokenTx({ value: '3000000' })],
    });

    expect(transfers).toHaveLength(2);
    expect(transfers.map(transfer => transfer.direction).sort()).toEqual(['in', 'out']);
  });

  it('ignores zero-value rows such as bare contract calls', () => {
    expect(map({ transactions: [tx({ value: '0' })] })).toEqual([]);
  });
});

describe('finalizeTransfers', () => {
  const SWAP_HASH = '0xswap';

  function swap() {
    return mapChainTransfers({
      address: ME,
      nativeAsset: 'ETH',
      ownAddresses: [ME],
      tickerByContract: TICKER_BY_CONTRACT[1],
      // One transaction: ETH out, USDC in — a sale of ETH, not spending.
      transactions: [
        tx({
          hash: SWAP_HASH,
          from: ME,
          to: STRANGER,
          value: '1000000000000000000',
          gasUsed: '21000',
          gasPrice: '1000000000',
        }),
      ],
      tokenTransfers: [tokenTx({ hash: SWAP_HASH, value: '3000000' })],
    });
  }

  it('folds the fee onto the transfer it paid for', () => {
    const finalized = finalizeTransfers(
      map({
        transactions: [
          tx({
            from: ME,
            to: STRANGER,
            value: '1000000000000000000',
            gasUsed: '21000',
            gasPrice: '1000000000',
          }),
        ],
      }),
    );

    expect(finalized).toEqual([
      expect.objectContaining({
        direction: 'out',
        amount: '1',
        leg: 'value',
        fee: { asset: 'ETH', amount: '0.000021' },
      }),
    ]);
  });

  it('marks both legs of a swap as a trade', () => {
    const finalized = finalizeTransfers(swap());
    const legs = finalized.filter(transfer => transfer.leg === 'value');

    expect(legs).toHaveLength(2);
    expect(legs.every(leg => leg.isTrade)).toBe(true);
  });

  it('leaves a swap’s fee as its own leg, since the swap itself nets out', () => {
    const finalized = finalizeTransfers(swap());

    expect(finalized.filter(transfer => transfer.leg === 'fee')).toEqual([
      expect.objectContaining({ asset: 'ETH', amount: '0.000021', direction: 'out' }),
    ]);
    const sold = finalized.find(
      transfer => transfer.leg === 'value' && transfer.direction === 'out',
    );
    expect(sold).toMatchObject({ amount: '1' });
    expect(sold).not.toHaveProperty('fee');
  });

  it('keeps a fee with no transfer to ride on', () => {
    const finalized = finalizeTransfers(
      map({
        transactions: [
          tx({
            from: ME,
            to: STRANGER,
            value: '1000000000000000000',
            gasUsed: '21000',
            gasPrice: '1000000000',
            isError: '1',
          }),
        ],
      }),
    );

    expect(finalized).toEqual([expect.objectContaining({ leg: 'fee', amount: '0.000021' })]);
  });

  it('does not call an ordinary receipt a trade', () => {
    const finalized = finalizeTransfers(map({ tokenTransfers: [tokenTx({ value: '1000000' })] }));

    expect(finalized[0].isTrade).toBeUndefined();
  });
});

describe('formatUnits', () => {
  it.each([
    [1n, 18, '0.000000000000000001'],
    [1000000000000000000n, 18, '1'],
    [1500000n, 6, '1.5'],
    [0n, 18, '0'],
    [42n, 0, '42'],
    [-500000n, 6, '-0.5'],
  ])('formats %s with %s decimals as %s', (value, decimals, expected) => {
    expect(formatUnits(value, decimals)).toBe(expected);
  });

  it('does not lose precision on amounts beyond Number.MAX_SAFE_INTEGER', () => {
    expect(formatUnits(123456789012345678901234567890n, 18)).toBe('123456789012.34567890123456789');
  });
});

describe('addDecimals', () => {
  it('adds values with different scales', () => {
    expect(addDecimals('1.5', '0.000021')).toBe('1.500021');
  });

  it('subtracts when the second value is negative', () => {
    expect(addDecimals('2', '-0.5')).toBe('1.5');
  });

  it('avoids the binary floating point error of 0.1 + 0.2', () => {
    expect(addDecimals('0.1', '0.2')).toBe('0.3');
  });
});
