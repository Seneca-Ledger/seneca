import { SOLANA_TOKENS } from '../../../../src/modules/crypto/crypto.constants';
import {
  mapSolanaBalances,
  mapSolanaTransfers,
  type SolanaTx,
} from '../../../../src/modules/crypto/solana-transfer.mapper';

const ME = 'vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg';
const OTHER = 'E16prLnWkTodFzd1NS2ZUsYTAtP1jTtqB2tEdMbmrhH4';
const OWN_TWO = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const FAKE = 'FakeMint1111111111111111111111111111111111';

type TokenRow = { owner: string; mint: string; amount: string };

function tx(options: {
  keys: string[];
  pre: number[];
  post: number[];
  preTokens?: TokenRow[];
  postTokens?: TokenRow[];
  err?: unknown;
}): SolanaTx {
  const tokens = (rows: TokenRow[] = []) =>
    rows.map((row, index) => ({
      accountIndex: index,
      mint: row.mint,
      owner: row.owner,
      uiTokenAmount: { amount: row.amount, decimals: 6 },
    }));
  return {
    blockTime: 1_780_219_205,
    meta: {
      err: options.err ?? null,
      preBalances: options.pre,
      postBalances: options.post,
      preTokenBalances: tokens(options.preTokens),
      postTokenBalances: tokens(options.postTokens),
    },
    transaction: {
      signatures: ['sig-1'],
      message: { accountKeys: options.keys.map(pubkey => ({ pubkey })) },
    },
  };
}

function map(transactions: SolanaTx[], ownAddresses = [ME]) {
  return mapSolanaTransfers({ address: ME, ownAddresses, tokens: SOLANA_TOKENS, transactions });
}

describe('mapSolanaTransfers', () => {
  it('books SOL received, counterparty the account that paid', () => {
    const received = tx({ keys: [OTHER, ME], pre: [5e9, 1e9], post: [2.99e9, 3e9] });

    expect(map([received])).toEqual([
      {
        hash: 'sig-1',
        timestamp: 1_780_219_205,
        asset: 'SOL',
        amount: '2',
        direction: 'in',
        counterparty: OTHER,
      },
    ]);
  });

  it('books SOL sent including the fee this address paid', () => {
    const sent = tx({ keys: [ME, OTHER], pre: [3e9, 0], post: [1_999_995_000, 1e9] });

    expect(map([sent])).toEqual([
      expect.objectContaining({ direction: 'out', amount: '1.000005', counterparty: OTHER }),
    ]);
  });

  it('drops the 0.0001 SOL poisoning transfer seen on mainnet', () => {
    const poison = tx({ keys: [OTHER, ME], pre: [6_441_482, 39_769_364], post: [6_261_482, 39_869_364] });
    expect(map([poison])).toEqual([]);
  });

  it('books only the fee of a failed transaction', () => {
    const failed = tx({ keys: [ME, OTHER], pre: [1e9, 0], post: [999_995_000, 0], err: { x: 1 } });
    expect(map([failed])).toEqual([expect.objectContaining({ amount: '0.000005' })]);
  });

  it('books only the fee of a move to another own wallet', () => {
    const move = tx({ keys: [ME, OWN_TWO], pre: [3e9, 0], post: [1_999_995_000, 1e9] });

    expect(map([move], [ME, OWN_TWO])).toEqual([
      expect.objectContaining({ direction: 'out', amount: '0.000005' }),
    ]);
  });

  it('books USDC received by its mint, with the sender as counterparty', () => {
    const usdc = tx({
      keys: [OTHER, ME],
      pre: [1e9, 1e9],
      post: [999_995_000, 1e9],
      preTokens: [
        { owner: OTHER, mint: USDC, amount: '500000000' },
        { owner: ME, mint: USDC, amount: '0' },
      ],
      postTokens: [
        { owner: OTHER, mint: USDC, amount: '385000000' },
        { owner: ME, mint: USDC, amount: '115000000' },
      ],
    });

    expect(map([usdc])).toEqual([
      expect.objectContaining({ asset: 'USDC', amount: '115', direction: 'in', counterparty: OTHER }),
    ]);
  });

  it('ignores a token whose mint is not in the table', () => {
    const fake = tx({
      keys: [OTHER, ME],
      pre: [1e9, 1e9],
      post: [1e9, 1e9],
      postTokens: [{ owner: ME, mint: FAKE, amount: '999000000' }],
    });
    expect(map([fake])).toEqual([]);
  });
});

describe('mapSolanaBalances', () => {
  it('adds SOL and every account of a known mint, dropping unknown mints', () => {
    const account = (mint: string, amount: string) => ({
      account: { data: { parsed: { info: { mint, tokenAmount: { amount } } } } },
    });

    expect(
      mapSolanaBalances({
        lamports: 39_869_364,
        tokenAccounts: [account(USDC, '100000000'), account(USDC, '15000000'), account(FAKE, '9')],
        tokens: SOLANA_TOKENS,
      }),
    ).toEqual([
      { asset: 'SOL', amount: '0.039869364' },
      { asset: 'USDC', amount: '115' },
    ]);
  });
});
