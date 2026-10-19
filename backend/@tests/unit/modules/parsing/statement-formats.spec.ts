import { findCsvPreset, presetColumnMapping } from '@/modules/parsing/parsers/csv-presets';
import {
  parseCamt053,
  parseMt940,
  parseOfx,
  parseQif,
  sniffStatementFormat,
} from '@/modules/parsing/parsers/statement-formats.util';

const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><BANKID>123<ACCTID>987654321<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903120000[-5:EST]<TRNAMT>-42.50<FITID>T1<NAME>COFFEE &amp; CO<MEMO>Latte</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260925<TRNAMT>3000.00<FITID>T2<NAME>ACME PAYROLL</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1234.56<DTASOF>20260930</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const QIF = `!Type:Bank
D09/03/2026
T-42.50
PCoffee & Co
MLatte
^
D09/25/2026
T3,000.00
PACME Payroll
^`;

const CAMT = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
<BkToCstmrStmt><Stmt>
<Acct><Id><IBAN>DE89370400440532013000</IBAN></Id><Ccy>EUR</Ccy></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">100.00</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">57.50</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>
<Ntry><Amt Ccy="EUR">42.50</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-09-03</Dt></BookgDt>
<NtryDtls><TxDtls><RltdPties><Cdtr><Nm>Coffee &amp; Co</Nm></Cdtr></RltdPties><RmtInf><Ustrd>Latte</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
</Stmt></BkToCstmrStmt></Document>`;

const MT940 = `:20:STARTUMS
:25:12345678/987654321
:28C:1/1
:60F:C260901EUR100,00
:61:2609030903DR42,50NMSCNONREF//REF1
:86:166?00SEPA-LASTSCHRIFT?20Latte?21Coffee?32Coffee und Co
:61:2609250925CR3000,00NTRFNONREF
:86:Salary ACME
:62F:C260930EUR3057,50
-`;

describe('statement formats', () => {
  it('sniffs each format off its first bytes', () => {
    expect(sniffStatementFormat(OFX)).toBe('ofx');
    expect(sniffStatementFormat(QIF)).toBe('qif');
    expect(sniffStatementFormat(CAMT)).toBe('camt');
    expect(sniffStatementFormat(MT940)).toBe('mt940');
    expect(sniffStatementFormat('date,amount\n2026-01-01,5')).toBeNull();
  });

  it('parses OFX SGML with signed amounts, entities and the ledger balance', () => {
    const parsed = parseOfx(OFX);
    expect(parsed.metadata).toMatchObject({ currency: 'USD', accountNumber: '987654321', balanceEnd: 1234.56 });
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0]).toMatchObject({
      debit: 42.5,
      counterpartyName: 'COFFEE & CO',
      paymentPurpose: 'Latte',
      documentNumber: 'T1',
    });
    expect(parsed.transactions[0].transactionDate.toISOString()).toBe('2026-09-03T12:00:00.000Z');
    expect(parsed.transactions[1]).toMatchObject({ credit: 3000, counterpartyName: 'ACME PAYROLL' });
  });

  it('decodes an entity once: &amp;lt; stays a literal &lt;', () => {
    const parsed = parseOfx(OFX.replace('COFFEE &amp; CO', 'A &amp;lt;B&amp;gt; &#38; C'));
    expect(parsed.transactions[0].counterpartyName).toBe('A &lt;B&gt; & C');
  });

  it('parses QIF, picking the date order that makes every date valid', () => {
    const parsed = parseQif(QIF);
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0].transactionDate.toISOString().slice(0, 10)).toBe('2026-09-03');
    expect(parsed.transactions[0]).toMatchObject({ debit: 42.5, counterpartyName: 'Coffee & Co', paymentPurpose: 'Latte' });
    expect(parsed.transactions[1]).toMatchObject({ credit: 3000 });

    const dmy = parseQif('!Type:Bank\nD25/09/2026\nT10\nPShop\n^');
    expect(dmy.transactions[0].transactionDate.toISOString().slice(0, 10)).toBe('2026-09-25');
  });

  it('parses camt.053 entries with parties, remittance and balances', () => {
    const parsed = parseCamt053(CAMT);
    expect(parsed.metadata).toMatchObject({
      accountNumber: 'DE89370400440532013000',
      currency: 'EUR',
      balanceStart: 100,
      balanceEnd: 57.5,
    });
    expect(parsed.transactions).toEqual([
      expect.objectContaining({ debit: 42.5, counterpartyName: 'Coffee & Co', paymentPurpose: 'Latte' }),
    ]);
    expect(parsed.transactions[0].transactionDate.toISOString().slice(0, 10)).toBe('2026-09-03');
  });

  it('parses MT940 :61:/:86: pairs, structured German details and balances', () => {
    const parsed = parseMt940(MT940);
    expect(parsed.metadata).toMatchObject({ accountNumber: '12345678', currency: 'EUR', balanceStart: 100, balanceEnd: 3057.5 });
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0]).toMatchObject({ debit: 42.5, counterpartyName: 'Coffee und Co', paymentPurpose: 'Latte Coffee' });
    expect(parsed.transactions[0].transactionDate.toISOString().slice(0, 10)).toBe('2026-09-03');
    expect(parsed.transactions[1]).toMatchObject({ credit: 3000, paymentPurpose: 'Salary ACME' });
  });
});

describe('CSV presets', () => {
  it('recognises a bank by its header row and maps its columns exactly', () => {
    const headers = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance'];
    const preset = findCsvPreset(headers);
    expect(preset?.name).toBe('Revolut');
    expect(presetColumnMapping(preset!, headers)).toEqual({ purpose: 0, date: 3, counterparty: 4, amount: 5, currency: 7 });
  });

  it('leaves unknown layouts to the header guesser', () => {
    expect(findCsvPreset(['Дата', 'Сумма', 'Назначение'])).toBeNull();
  });

  it('knows Capital One splits debit and credit', () => {
    const preset = findCsvPreset(['Transaction Date', 'Posted Date', 'Card No.', 'Description', 'Category', 'Debit', 'Credit']);
    expect(preset?.name).toBe('Capital One');
  });
});
