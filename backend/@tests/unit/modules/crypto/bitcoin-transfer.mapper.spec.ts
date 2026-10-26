import {
  type MempoolTx,
  mapBitcoinBalance,
  mapBitcoinTransfers,
} from '../../../../src/modules/crypto/bitcoin-transfer.mapper';

const ME = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
const SHOP = 'bc1qsf2l2dqqxuffswrs59qd7d6va8r4rtuzj6wgeh';
const PAYER = 'bc1q4599jxvf9hj4m84lfdll26jjzxgrrep33j36t9';
const SAVINGS = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';

function tx(
  vin: [string, number][],
  vout: [string | undefined, number][],
  overrides: Partial<MempoolTx> = {},
): MempoolTx {
  return {
    txid: 'tx-1',
    status: { confirmed: true, block_time: 1_790_598_850 },
    vin: vin.map(([address, value]) => ({ prevout: { scriptpubkey_address: address, value } })),
    vout: vout.map(([address, value]) => ({ scriptpubkey_address: address, value })),
    ...overrides,
  };
}

function map(transactions: MempoolTx[], ownAddresses = [ME]) {
  return mapBitcoinTransfers({ addresses: [ME], ownAddresses, transactions });
}

describe('mapBitcoinTransfers', () => {
  it('books a payment received', () => {
    expect(map([tx([[PAYER, 150_000]], [[ME, 100_000], [PAYER, 49_000]])])).toEqual([
      {
        hash: 'tx-1',
        timestamp: 1_790_598_850,
        asset: 'BTC',
        amount: '0.001',
        direction: 'in',
        counterparty: PAYER,
      },
    ]);
  });

  it('books a payment sent as what left the balance: amount plus fee, change excluded', () => {
    // Spends 100 000, pays the shop 60 000, gets 39 000 change: 1 000 is the fee.
    const [transfer] = map([tx([[ME, 100_000]], [[SHOP, 60_000], [ME, 39_000]])]);

    expect(transfer).toMatchObject({ direction: 'out', amount: '0.00061', counterparty: SHOP });
  });

  it('drops a 546-sat dust output from a dust attack', () => {
    expect(map([tx([[PAYER, 112_075]], [[undefined, 0], [ME, 546], [SHOP, 546]])])).toEqual([]);
  });

  it('skips unconfirmed transactions', () => {
    const pending = tx([[PAYER, 150_000]], [[ME, 100_000]], { status: { confirmed: false } });
    expect(map([pending])).toEqual([]);
  });

  it('books only the fee of a move to another own address', () => {
    const move = tx([[ME, 100_000]], [[SAVINGS, 90_000], [ME, 9_500]]);

    expect(map([move], [ME, SAVINGS])).toEqual([
      expect.objectContaining({ direction: 'out', amount: '0.000005', counterparty: SAVINGS }),
    ]);
  });

  it('books nothing on the receiving side of an own move', () => {
    const move = tx([[SAVINGS, 100_000]], [[ME, 90_000], [SAVINGS, 9_500]]);
    expect(map([move], [ME, SAVINGS])).toEqual([]);
  });
});

describe('mapBitcoinBalance', () => {
  it('is funded minus spent, in BTC', () => {
    expect(
      mapBitcoinBalance({ chain_stats: { funded_txo_sum: 1_679_253_616, spent_txo_sum: 1_287_005_839 } }),
    ).toEqual([{ asset: 'BTC', amount: '3.92247777' }]);
  });

  it('is empty for an empty address', () => {
    expect(mapBitcoinBalance({ chain_stats: { funded_txo_sum: 5, spent_txo_sum: 5 } })).toEqual([]);
  });
});
