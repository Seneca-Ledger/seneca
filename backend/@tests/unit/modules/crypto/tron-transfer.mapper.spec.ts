import { TRON_TOKENS } from '../../../../src/modules/crypto/crypto.constants';
import {
  mapTronBalances,
  mapTronTransfers,
  type TronGridTrc20Transfer,
  type TronGridTx,
  tronHexToBase58,
} from '../../../../src/modules/crypto/tron-transfer.mapper';

/** A real address pair, checked against TronGrid: the hex form and its base58. */
const ME_HEX = '4171b683c7d41706c9050aff9662d271a25ff64f33';
const ME = 'TLLU15qbiSEqv2y3DLfbHTHS5TVdjQ7hoJ';
const OTHER_HEX = '4185434e8859b2db0fc6eeb72a7998a765201ae94b';
const OTHER = tronHexToBase58(OTHER_HEX);
const USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const FAKE_USDT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

function tx(overrides: {
  type?: string;
  from?: string;
  to?: string;
  amount?: number;
  fee?: number;
  result?: string;
  id?: string;
}): TronGridTx {
  return {
    txID: overrides.id ?? 'tx-1',
    block_timestamp: 1_790_749_329_000,
    ret: [{ contractRet: overrides.result ?? 'SUCCESS', fee: overrides.fee ?? 0 }],
    raw_data: {
      contract: [
        {
          type: overrides.type ?? 'TransferContract',
          parameter: {
            value: {
              owner_address: overrides.from ?? OTHER_HEX,
              to_address: overrides.to ?? ME_HEX,
              amount: overrides.amount ?? 5_000_000,
            },
          },
        },
      ],
    },
  };
}

function trc20(overrides: Partial<TronGridTrc20Transfer> = {}): TronGridTrc20Transfer {
  return {
    transaction_id: 'trc-1',
    block_timestamp: 1_790_717_766_000,
    from: OTHER,
    to: ME,
    value: '58500000',
    type: 'Transfer',
    token_info: { address: USDT, decimals: 6 },
    ...overrides,
  };
}

function map(transactions: TronGridTx[], tokenTransfers: TronGridTrc20Transfer[] = []) {
  return mapTronTransfers({
    address: ME,
    ownAddresses: [ME],
    tokens: TRON_TOKENS,
    transactions,
    tokenTransfers,
  });
}

describe('tronHexToBase58', () => {
  it('encodes a hex address the way TronGrid shows it in base58', () => {
    expect(tronHexToBase58(ME_HEX)).toBe(ME);
  });

  it('returns empty for anything that is not a Tron hex address', () => {
    expect(tronHexToBase58('')).toBe('');
    expect(tronHexToBase58('0x71b683c7d41706c9050aff9662d271a25ff64f33')).toBe('');
  });
});

describe('mapTronTransfers', () => {
  it('books an incoming TRX transfer in TRX, six decimals', () => {
    expect(map([tx({ amount: 5_000_000 })])).toEqual([
      {
        hash: 'tx-1',
        timestamp: 1_790_749_329,
        asset: 'TRX',
        amount: '5',
        direction: 'in',
        counterparty: OTHER,
      },
    ]);
  });

  it('keeps the TRX burned by an outgoing transfer off the amount that was sent', () => {
    const transfers = map([tx({ from: ME_HEX, to: OTHER_HEX, amount: 2_000_000, fee: 268_000 })]);

    expect(transfers.find(transfer => transfer.leg === 'fee')).toMatchObject({
      asset: 'TRX',
      amount: '0.268',
      direction: 'out',
    });
    expect(transfers.find(transfer => transfer.leg !== 'fee')).toMatchObject({
      asset: 'TRX',
      amount: '2',
      direction: 'out',
    });
  });

  it('books the fee of a USDT transfer, whose row is a contract call', () => {
    const call = tx({ type: 'TriggerSmartContract', from: ME_HEX, to: OTHER_HEX, fee: 13_844_850 });

    expect(map([call])).toEqual([expect.objectContaining({ asset: 'TRX', amount: '13.84485' })]);
  });

  it('books only the fee of a failed transfer', () => {
    const failed = tx({ from: ME_HEX, to: OTHER_HEX, amount: 9_000_000, fee: 1_000, result: 'REVERT' });

    expect(map([failed])).toEqual([expect.objectContaining({ amount: '0.001' })]);
  });

  it('ignores resource delegation, which moves no TRX', () => {
    expect(map([tx({ type: 'DelegateResourceContract', amount: 8_111_000_000 })])).toEqual([]);
  });

  it('drops 1-sun address-poisoning dust', () => {
    expect(map([tx({ amount: 1 })])).toEqual([]);
  });

  it('keeps a tiny amount the user sent themselves', () => {
    expect(map([tx({ from: ME_HEX, to: OTHER_HEX, amount: 1 })])).toEqual([
      expect.objectContaining({ direction: 'out', amount: '0.000001' }),
    ]);
  });

  it('drops a move between two wallets of the same workspace', () => {
    const transfers = mapTronTransfers({
      address: ME,
      ownAddresses: [ME, OTHER],
      tokens: TRON_TOKENS,
      transactions: [tx({ amount: 5_000_000 })],
      tokenTransfers: [trc20()],
    });

    expect(transfers).toEqual([]);
  });

  it('books a real USDT transfer by its contract', () => {
    expect(map([], [trc20()])).toEqual([
      {
        hash: 'trc-1',
        timestamp: 1_790_717_766,
        asset: 'USDT',
        amount: '58.5',
        direction: 'in',
        counterparty: OTHER,
      },
    ]);
  });

  it('ignores a fake USDT contract, whatever it calls itself', () => {
    expect(map([], [trc20({ token_info: { address: FAKE_USDT, decimals: 6 } })])).toEqual([]);
  });

  it('drops zero-value and dust USDT sent to poison the history', () => {
    expect(map([], [trc20({ value: '0' }), trc20({ transaction_id: 'b', value: '1' })])).toEqual(
      [],
    );
  });

  it('marks a USDT transfer from this address as outgoing', () => {
    const [transfer] = map([], [trc20({ from: ME, to: OTHER, value: '429000000' })]);

    expect(transfer).toMatchObject({ direction: 'out', amount: '429', counterparty: OTHER });
  });
});

describe('mapTronBalances', () => {
  it('reads TRX and the known TRC-20 tokens, dropping unknown contracts', () => {
    const balances = mapTronBalances({
      account: {
        balance: 2_588_000,
        trc20: [{ [USDT]: '460942000' }, { [FAKE_USDT]: '999000000' }],
      },
      tokens: TRON_TOKENS,
    });

    expect(balances).toEqual([
      { asset: 'TRX', amount: '2.588' },
      { asset: 'USDT', amount: '460.942' },
    ]);
  });

  it('is empty for an address that was never activated', () => {
    expect(mapTronBalances({ account: null, tokens: TRON_TOKENS })).toEqual([]);
  });
});
