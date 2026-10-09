import { parseExchangeCsv, splitCsv } from '../../../../src/modules/crypto/crypto-exchange-csv';

const COINBASE = [
  'You can use this transaction report to inform your likely tax obligations.',
  '',
  'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes',
  'aaa,2026-01-05T10:00:00Z,Buy,BTC,0.01,EUR,60000,600.00,606.00,6.00,Bought 0.01 BTC for €606.00 EUR',
  'bbb,2026-02-05T10:00:00Z,Sell,ETH,0.5,EUR,2000,1000.00,994.00,6.00,Sold 0.5 ETH for €994.00 EUR',
  'ccc,2026-03-05T10:00:00Z,Convert,BTC,0.005,EUR,60000,300.00,300.00,0.00,Converted 0.005 BTC to 0.15 ETH',
  'ddd,2026-04-05T10:00:00Z,Receive,BTC,0.02,EUR,60000,,,,"Received 0.02 BTC from an external account"',
  'eee,2026-05-05T10:00:00Z,Staking Income,ETH,0.01,EUR,2000,20.00,20.00,0.00,',
  'fff,2026-06-05T10:00:00Z,Deposit,EUR,500,EUR,1,,,,Deposited €500',
].join('\n');

const BINANCE = [
  'User_ID,UTC_Time,Account,Operation,Coin,Change,Remark',
  '123,2026-01-10 08:00:00,Spot,Transaction Buy,BTC,0.02,',
  '123,2026-01-10 08:00:00,Spot,Transaction Spend,USDT,-1200,',
  '123,2026-01-10 08:00:00,Spot,Fee,BNB,-0.001,',
  '123,2026-02-10 08:00:00,Spot,Deposit,ETH,1.5,',
  '123,2026-03-10 08:00:00,Earn,Simple Earn Flexible Interest,ETH,0.004,',
  '123,2026-04-10 08:00:00,Spot,Deposit,EUR,300,',
].join('\n');

const KRAKEN = [
  '"txid","refid","time","type","subtype","aclass","asset","wallet","amount","fee","balance"',
  '"L1","R1","2026-01-15 09:00:00","trade","","currency","XXBT","spot",0.03,0.0001,0.03',
  '"L2","R1","2026-01-15 09:00:00","trade","","currency","ZEUR","spot",-1800.0,0.0,200.0',
  '"L3","R2","2026-02-15 09:00:00","deposit","","currency","XETH","spot",2.0,0.0,2.0',
  '"L4","R3","2026-03-15 09:00:00","staking","","currency","ETH.S","spot",0.05,0.0,2.05',
].join('\n');

describe('parseExchangeCsv', () => {
  it('refuses a file it does not recognise instead of guessing', () => {
    expect(parseExchangeCsv('date,amount,description\n2026-01-01,10,Coffee')).toBeNull();
  });

  describe('Coinbase', () => {
    const parsed = parseExchangeCsv(COINBASE);

    it('finds the header under the preamble', () => {
      expect(parsed?.exchange).toBe('Coinbase');
    });

    it('reads a buy as coins arriving and a sell as coins leaving', () => {
      const buy = parsed?.entries.find(entry => entry.reference === 'aaa');
      const sell = parsed?.entries.find(entry => entry.reference === 'bbb');

      expect(buy).toMatchObject({ asset: 'BTC', amount: 0.01, kind: 'trade', date: '2026-01-05' });
      expect(sell).toMatchObject({ asset: 'ETH', amount: -0.5, kind: 'trade' });
    });

    it('takes both sides of a conversion out of the note', () => {
      const legs = parsed?.entries.filter(entry => entry.reference.startsWith('ccc')) ?? [];

      expect(legs).toHaveLength(2);
      expect(legs[0]).toMatchObject({ asset: 'BTC', amount: -0.005 });
      expect(legs[1]).toMatchObject({ asset: 'ETH', amount: 0.15 });
    });

    it('calls a transfer a move and staking an earning', () => {
      expect(parsed?.entries.find(entry => entry.reference === 'ddd')?.kind).toBe('move');
      expect(parsed?.entries.find(entry => entry.reference === 'eee')?.kind).toBe('earn');
    });

    it('takes the money the file states, fee and spread included', () => {
      const buy = parsed?.entries.find(entry => entry.reference === 'aaa');
      const sell = parsed?.entries.find(entry => entry.reference === 'bbb');

      // 606 paid for the BTC, 994 received for the ETH — not the market average.
      expect(buy?.value).toEqual({ amount: 606, currency: 'EUR' });
      expect(sell?.value).toEqual({ amount: 994, currency: 'EUR' });
    });

    it('states no money for a row that carries none', () => {
      expect(parsed?.entries.find(entry => entry.reference === 'ddd')?.value).toBeUndefined();
    });

    it('leaves money on the exchange out: it is not a holding we can price', () => {
      expect(parsed?.entries.some(entry => entry.asset === 'EUR')).toBe(false);
    });
  });

  describe('Binance', () => {
    const parsed = parseExchangeCsv(BINANCE);

    it('reads the signed change as the amount', () => {
      expect(parsed?.exchange).toBe('Binance');
      expect(parsed?.entries.find(entry => entry.asset === 'BTC')).toMatchObject({
        amount: 0.02,
        kind: 'trade',
      });
      expect(parsed?.entries.find(entry => entry.asset === 'USDT')).toMatchObject({
        amount: -1200,
        kind: 'trade',
      });
    });

    it('tells a fee, a deposit and interest apart by the operation', () => {
      const byAsset = (asset: string, kind: string) =>
        parsed?.entries.find(entry => entry.asset === asset && entry.kind === kind);

      expect(byAsset('BNB', 'fee')).toBeDefined();
      expect(byAsset('ETH', 'move')).toBeDefined();
      expect(byAsset('ETH', 'earn')).toBeDefined();
    });
  });

  describe('Kraken', () => {
    const parsed = parseExchangeCsv(KRAKEN);

    it('speaks Kraken’s own tickers', () => {
      expect(parsed?.exchange).toBe('Kraken');
      expect(parsed?.entries.map(entry => entry.asset)).toEqual(
        expect.arrayContaining(['BTC', 'ETH']),
      );
      expect(parsed?.entries.some(entry => entry.asset.startsWith('X'))).toBe(false);
    });

    it('turns the fee column into an entry of its own', () => {
      const fee = parsed?.entries.find(entry => entry.kind === 'fee');

      expect(fee).toMatchObject({ asset: 'BTC', amount: -0.0001 });
    });

    it('reads a staked ticker as the coin itself', () => {
      expect(parsed?.entries.find(entry => entry.kind === 'earn')).toMatchObject({
        asset: 'ETH',
        amount: 0.05,
      });
    });
  });
});

describe('splitCsv', () => {
  it('keeps commas inside quotes together', () => {
    expect(splitCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });

  it('reads a doubled quote as one quote', () => {
    expect(splitCsv('"say ""hi""",2')).toEqual([['say "hi"', '2']]);
  });
});
