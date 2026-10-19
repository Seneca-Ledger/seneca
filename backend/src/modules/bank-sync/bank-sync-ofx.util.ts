import type { BankSyncAccount, BankSyncTransaction } from './bank-sync-provider.interface';

/**
 * A provider's transaction id is unique within its account only (SimpleFIN
 * says so), so the key that becomes FITID and the document number carries
 * the account too: two accounts may report the same id.
 */
export function providerRowKey(accountId: string, transactionId: string): string {
  return `${accountId}:${transactionId}`;
}

/**
 * A pulled account becomes an OFX statement and goes through the same import
 * as a file the user uploads: the OFX parser, dedupe, rules, the review inbox.
 * The aggregator's transaction id travels as FITID, so a row already in the
 * workspace is recognised by its document number.
 */
export function buildOfxStatement(
  account: BankSyncAccount,
  transactions: BankSyncTransaction[],
  now = new Date(),
): string {
  const dates = transactions.map(item => item.posted.getTime());
  const start = dates.length ? new Date(Math.min(...dates)) : now;
  const end = dates.length ? new Date(Math.max(...dates)) : now;
  const lines = [
    'OFXHEADER:100',
    'DATA:OFXSGML',
    'VERSION:102',
    'SECURITY:NONE',
    'ENCODING:UTF-8',
    'CHARSET:NONE',
    'COMPRESSION:NONE',
    'OLDFILEUID:NONE',
    'NEWFILEUID:NONE',
    '',
    '<OFX>',
    '<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS>',
    `<DTSERVER>${ofxDateTime(now)}<LANGUAGE>ENG`,
    `<FI><ORG>${escapeOfx(account.org || 'SimpleFIN')}</FI></SONRS></SIGNONMSGSRSV1>`,
    '<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS>',
    `<STMTRS><CURDEF>${escapeOfx(account.currency)}`,
    `<BANKACCTFROM><BANKID>SIMPLEFIN<ACCTID>${escapeOfx(account.id)}<ACCTTYPE>CHECKING</BANKACCTFROM>`,
    `<BANKTRANLIST><DTSTART>${ofxDate(start)}<DTEND>${ofxDate(end)}`,
  ];
  for (const item of transactions) {
    const name = item.payee || item.description || item.memo || 'Unknown';
    const memo = item.memo || (item.payee ? item.description : '');
    lines.push(
      '<STMTTRN>',
      `<TRNTYPE>${item.amount < 0 ? 'DEBIT' : 'CREDIT'}`,
      `<DTPOSTED>${ofxDate(item.posted)}`,
      `<TRNAMT>${item.amount.toFixed(2)}`,
      `<FITID>${escapeOfx(providerRowKey(account.id, item.id))}`,
      `<NAME>${escapeOfx(name)}`,
      ...(memo && memo !== name ? [`<MEMO>${escapeOfx(memo)}`] : []),
      '</STMTTRN>',
    );
  }
  lines.push('</BANKTRANLIST>');
  if (account.balance !== null) {
    lines.push(
      `<LEDGERBAL><BALAMT>${account.balance.toFixed(2)}<DTASOF>${ofxDate(account.balanceDate ?? now)}</LEDGERBAL>`,
    );
  }
  lines.push('</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>', '');
  return lines.join('\n');
}

/** A file name the uploads directory and the statements list are both happy with. */
export function ofxFileName(account: BankSyncAccount, now = new Date()): string {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const org = safe(account.org || 'simplefin').toLowerCase() || 'simplefin';
  const name = safe(account.name).toLowerCase() || safe(account.id).toLowerCase() || 'account';
  return `${org}-${name}-${ofxDate(now)}.ofx`;
}

function escapeOfx(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\r\n]+/g, ' ');
}

function ofxDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function ofxDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${ofxDate(date)}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}
