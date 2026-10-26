import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';

/**
 * Pure parsers for the interchange formats banks export besides CSV:
 * OFX/QFX (SGML or XML), QIF, ISO 20022 camt.053 and SWIFT MT940. Each takes
 * the file's text and returns the same shape the bank parsers do, so the
 * import pipeline (dedupe, rules, review) does not know the difference.
 */

/* ----------------------------------------------------------------------- */
/* Format sniffing                                                           */
/* ----------------------------------------------------------------------- */

export type TextStatementFormat = 'ofx' | 'qif' | 'camt' | 'mt940';

/** What a text file is, from its first few kilobytes; null when it is none of them. */
export function sniffStatementFormat(sample: string): TextStatementFormat | null {
  const head = sample.slice(0, 8192);
  if (/OFXHEADER|<OFX>|<\?OFX/i.test(head)) return 'ofx';
  if (/^\s*!(Type|Account|Option)/i.test(head)) return 'qif';
  if (/BkToCstmrStmt|BkToCstmrAcctRpt|camt\.05[23]/i.test(head)) return 'camt';
  if (/^\s*(\{1:|:20:)/.test(head) && /:61:/.test(sample)) return 'mt940';
  return null;
}

/* ----------------------------------------------------------------------- */
/* OFX / QFX                                                                 */
/* ----------------------------------------------------------------------- */

const ofxDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const digits = value.replace(/\[.*$/, '').trim();
  const match = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?/.exec(digits);
  if (!match) return null;
  const [, y, m, d, hh = '0', mm = '0', ss = '0'] = match;
  return new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)),
  );
};

/** The value of the first `<TAG>value` or `<TAG>value</TAG>` in a block. */
function ofxTag(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
  return match ? decodeEntities(match[1].trim()) : undefined;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** One pass, so '&amp;lt;' becomes the text '&lt;' rather than being decoded twice into '<'. */
function decodeEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|(amp|lt|gt|quot|apos));/g, (_, code, name) =>
    code ? String.fromCharCode(Number(code)) : NAMED_ENTITIES[name],
  );
}

export function parseOfx(text: string): ParsedStatement {
  const currency = ofxTag(text, 'CURDEF') ?? 'USD';
  const accountNumber = ofxTag(text, 'ACCTID') ?? 'Unknown';
  const institution = ofxTag(text, 'ORG');
  const transactions: ParsedTransaction[] = [];
  const blocks =
    text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTRS>|$)/gi) ?? [];
  for (const block of blocks) {
    const date = ofxDate(ofxTag(block, 'DTPOSTED')) ?? ofxDate(ofxTag(block, 'DTUSER'));
    const amount = Number.parseFloat((ofxTag(block, 'TRNAMT') ?? '').replace(',', '.'));
    if (!(date && Number.isFinite(amount))) continue;
    const name = ofxTag(block, 'NAME') ?? ofxTag(block, 'PAYEE') ?? '';
    const memo = ofxTag(block, 'MEMO') ?? '';
    transactions.push({
      transactionDate: date,
      documentNumber: ofxTag(block, 'FITID') ?? ofxTag(block, 'CHECKNUM'),
      counterpartyName: name || memo || 'Unknown',
      paymentPurpose: memo || name,
      ...(amount < 0 ? { debit: Math.abs(amount) } : { credit: amount }),
      currency,
    });
  }
  const dates = transactions.map(t => t.transactionDate.getTime());
  const balanceEnd = Number.parseFloat(ofxTag(text, 'BALAMT') ?? '');
  return {
    metadata: {
      accountNumber,
      currency,
      institution,
      dateFrom:
        ofxDate(ofxTag(text, 'DTSTART')) ??
        new Date(dates.length ? Math.min(...dates) : Date.now()),
      dateTo:
        ofxDate(ofxTag(text, 'DTEND')) ?? new Date(dates.length ? Math.max(...dates) : Date.now()),
      ...(Number.isFinite(balanceEnd) ? { balanceEnd } : {}),
    },
    transactions,
  };
}

/* ----------------------------------------------------------------------- */
/* QIF                                                                       */
/* ----------------------------------------------------------------------- */

/**
 * QIF dates are ambiguous (MM/DD/YYYY in the US, DD/MM/YYYY elsewhere); the
 * whole file is read first and the order that makes every date valid wins,
 * US first when both do.
 */
function qifDateParser(rows: string[]): (value: string) => Date | null {
  const parts = rows.map(row =>
    row
      .replace(/'/g, '/')
      .split(/[/.-]/)
      .map(part => part.trim()),
  );
  const valid = (order: 'mdy' | 'dmy') =>
    parts.every(part => {
      if (part.length !== 3) return false;
      const [a, b] = part.map(Number);
      return order === 'mdy'
        ? a >= 1 && a <= 12 && b >= 1 && b <= 31
        : b >= 1 && b <= 12 && a >= 1 && a <= 31;
    });
  const order: 'mdy' | 'dmy' = valid('mdy') ? 'mdy' : valid('dmy') ? 'dmy' : 'mdy';
  return value => {
    const part = value
      .replace(/'/g, '/')
      .split(/[/.-]/)
      .map(piece => piece.trim());
    if (part.length !== 3) return null;
    let [a, b, year] = part.map(Number);
    if (part[0].length === 4) {
      // ISO-looking: YYYY-MM-DD
      [year, a, b] = part.map(Number);
      return new Date(Date.UTC(year, a - 1, b));
    }
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const month = order === 'mdy' ? a : b;
    const day = order === 'mdy' ? b : a;
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  };
}

export function parseQif(text: string, currency = 'USD'): ParsedStatement {
  const lines = text.split(/\r?\n/);
  const records: Array<Record<string, string>> = [];
  let current: Record<string, string> = {};
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith('!')) continue;
    if (line === '^') {
      if (Object.keys(current).length) records.push(current);
      current = {};
      continue;
    }
    const code = line[0];
    const value = line.slice(1).trim();
    current[code] = current[code] ? `${current[code]} ${value}` : value;
  }
  if (Object.keys(current).length) records.push(current);

  const parseDate = qifDateParser(records.map(record => record.D ?? '').filter(Boolean));
  const transactions: ParsedTransaction[] = [];
  for (const record of records) {
    const date = record.D ? parseDate(record.D) : null;
    const amount = Number.parseFloat((record.T ?? record.U ?? '').replace(/,/g, ''));
    if (!(date && Number.isFinite(amount))) continue;
    transactions.push({
      transactionDate: date,
      documentNumber: record.N,
      counterpartyName: record.P || record.M || 'Unknown',
      paymentPurpose: record.M || record.P || '',
      ...(amount < 0 ? { debit: Math.abs(amount) } : { credit: amount }),
      currency,
    });
  }
  const dates = transactions.map(t => t.transactionDate.getTime());
  return {
    metadata: {
      accountNumber: 'Unknown',
      currency,
      dateFrom: new Date(dates.length ? Math.min(...dates) : Date.now()),
      dateTo: new Date(dates.length ? Math.max(...dates) : Date.now()),
    },
    transactions,
  };
}

/* ----------------------------------------------------------------------- */
/* camt.053 (ISO 20022)                                                      */
/* ----------------------------------------------------------------------- */

function xmlTag(block: string, tag: string): string | undefined {
  const match = new RegExp(
    `<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
    'i',
  ).exec(block);
  return match ? decodeEntities(match[1].trim()) : undefined;
}

function xmlBlocks(text: string, tag: string): string[] {
  return (
    text.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?</(?:\\w+:)?${tag}>`, 'gi')) ??
    []
  );
}

function xmlAttr(block: string, tag: string, attr: string): string | undefined {
  const match = new RegExp(`<(?:\\w+:)?${tag}\\s[^>]*${attr}="([^"]*)"`, 'i').exec(block);
  return match ? match[1] : undefined;
}

export function parseCamt053(text: string): ParsedStatement {
  const statement = xmlBlocks(text, 'Stmt')[0] ?? text;
  const accountBlock = xmlBlocks(statement, 'Acct')[0] ?? '';
  const accountNumber = xmlTag(accountBlock, 'IBAN') ?? xmlTag(accountBlock, 'Id') ?? 'Unknown';
  const currency = xmlTag(accountBlock, 'Ccy') ?? xmlAttr(statement, 'Amt', 'Ccy') ?? 'EUR';
  const transactions: ParsedTransaction[] = [];
  for (const entry of xmlBlocks(statement, 'Ntry')) {
    const amount = Number.parseFloat(xmlTag(entry, 'Amt') ?? '');
    const indicator = (xmlTag(entry, 'CdtDbtInd') ?? '').toUpperCase();
    const dateText =
      xmlTag(xmlBlocks(entry, 'BookgDt')[0] ?? xmlBlocks(entry, 'ValDt')[0] ?? '', 'Dt') ??
      xmlTag(xmlBlocks(entry, 'BookgDt')[0] ?? '', 'DtTm');
    const date = dateText
      ? new Date(dateText.length === 10 ? `${dateText}T00:00:00Z` : dateText)
      : null;
    if (!date || Number.isNaN(date.getTime()) || !Number.isFinite(amount)) continue;
    const details = xmlBlocks(entry, 'TxDtls')[0] ?? entry;
    const parties = xmlBlocks(details, 'RltdPties')[0] ?? '';
    const counterparty =
      indicator === 'DBIT'
        ? (xmlTag(xmlBlocks(parties, 'Cdtr')[0] ?? '', 'Nm') ?? xmlTag(parties, 'Nm'))
        : (xmlTag(xmlBlocks(parties, 'Dbtr')[0] ?? '', 'Nm') ?? xmlTag(parties, 'Nm'));
    const purpose =
      xmlBlocks(details, 'RmtInf')
        .map(block =>
          xmlBlocks(block, 'Ustrd')
            .map(item => xmlTag(item, 'Ustrd') ?? '')
            .join(' '),
        )
        .join(' ')
        .trim() ||
      xmlTag(entry, 'AddtlNtryInf') ||
      '';
    const reference = xmlTag(entry, 'AcctSvcrRef') ?? xmlTag(details, 'EndToEndId');
    transactions.push({
      transactionDate: date,
      documentNumber: reference,
      counterpartyName: counterparty || purpose || 'Unknown',
      paymentPurpose: purpose || counterparty || '',
      ...(indicator === 'DBIT' ? { debit: amount } : { credit: amount }),
      currency: xmlAttr(entry, 'Amt', 'Ccy') ?? currency,
    });
  }
  const balances = xmlBlocks(statement, 'Bal');
  const balanceOf = (code: string) => {
    const block = balances.find(item => (xmlTag(item, 'Cd') ?? '').toUpperCase() === code);
    if (!block) return undefined;
    const value = Number.parseFloat(xmlTag(block, 'Amt') ?? '');
    if (!Number.isFinite(value)) return undefined;
    return (xmlTag(block, 'CdtDbtInd') ?? '').toUpperCase() === 'DBIT' ? -value : value;
  };
  const period = xmlBlocks(statement, 'FrToDt')[0] ?? '';
  const dates = transactions.map(t => t.transactionDate.getTime());
  const from = xmlTag(period, 'FrDtTm');
  const to = xmlTag(period, 'ToDtTm');
  return {
    metadata: {
      accountNumber,
      currency,
      institution: xmlTag(xmlBlocks(accountBlock, 'Svcr')[0] ?? '', 'Nm'),
      dateFrom: from ? new Date(from) : new Date(dates.length ? Math.min(...dates) : Date.now()),
      dateTo: to ? new Date(to) : new Date(dates.length ? Math.max(...dates) : Date.now()),
      balanceStart: balanceOf('OPBD'),
      balanceEnd: balanceOf('CLBD'),
    },
    transactions,
  };
}

/* ----------------------------------------------------------------------- */
/* MT940                                                                     */
/* ----------------------------------------------------------------------- */

const mt940Date = (yymmdd: string): Date | null => {
  const match = /^(\d{2})(\d{2})(\d{2})$/.exec(yymmdd);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  return new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[3])));
};

const mt940Amount = (value: string): number => Number.parseFloat(value.replace(',', '.'));

export function parseMt940(text: string): ParsedStatement {
  // Fields span lines until the next ":NN:" tag.
  const unfolded = text.replace(/\r?\n(?!:\d{2}[A-Z]?:|-\s*$)/g, '\n');
  const fields: Array<{ tag: string; value: string }> = [];
  for (const match of unfolded.matchAll(
    /:(\d{2}[A-Z]?):([\s\S]*?)(?=\n:\d{2}[A-Z]?:|\n-\s*$|$)/g,
  )) {
    fields.push({ tag: match[1], value: match[2].trim() });
  }
  const field = (tag: string) => fields.find(item => item.tag === tag)?.value;
  const accountNumber = (field('25') ?? 'Unknown').split('/')[0].trim();
  const opening = field('60F') ?? field('60M') ?? '';
  const closing = field('62F') ?? field('62M') ?? '';
  const balance = (value: string) => {
    const match = /^([CD])(\d{6})([A-Z]{3})([\d,.]+)/.exec(value);
    if (!match) return { amount: undefined, currency: undefined };
    const amount = mt940Amount(match[4]);
    return { amount: match[1] === 'D' ? -amount : amount, currency: match[3] };
  };
  const openingBalance = balance(opening);
  const closingBalance = balance(closing);
  const currency = openingBalance.currency ?? closingBalance.currency ?? 'EUR';

  const transactions: ParsedTransaction[] = [];
  for (let i = 0; i < fields.length; i += 1) {
    if (fields[i].tag !== '61') continue;
    const line = fields[i].value;
    const match = /^(\d{6})(\d{4})?(R?[CD])([A-Z])?([\d,]+)([A-Z]{4})([^/\n]*)(?:\/\/(.*))?/.exec(
      line.replace(/\n.*/s, ''),
    );
    if (!match) continue;
    const date = mt940Date(match[1]);
    const amount = mt940Amount(match[5]);
    if (!(date && Number.isFinite(amount))) continue;
    const isDebit = match[3].endsWith('D');
    const info = fields[i + 1]?.tag === '86' ? fields[i + 1].value.replace(/\s+/g, ' ') : '';
    // Structured :86: (German banks): ?20..?29 purpose, ?32/?33 counterparty name.
    const structured = info.includes('?');
    const purpose = structured
      ? (info.match(/\?2\d([^?]*)/g) ?? [])
          .map(part => part.slice(3).trim())
          .join(' ')
          .trim()
      : info;
    const counterparty = structured
      ? (info.match(/\?3[23]([^?]*)/g) ?? [])
          .map(part => part.slice(3).trim())
          .join(' ')
          .trim()
      : '';
    transactions.push({
      transactionDate: date,
      documentNumber: (match[7] ?? '').trim() || undefined,
      counterpartyName: counterparty || purpose || match[6] || 'Unknown',
      paymentPurpose: purpose || info,
      ...(isDebit ? { debit: amount } : { credit: amount }),
      currency,
    });
  }
  const dates = transactions.map(t => t.transactionDate.getTime());
  return {
    metadata: {
      accountNumber,
      currency,
      dateFrom: new Date(dates.length ? Math.min(...dates) : Date.now()),
      dateTo: new Date(dates.length ? Math.max(...dates) : Date.now()),
      balanceStart: openingBalance.amount,
      balanceEnd: closingBalance.amount,
    },
    transactions,
  };
}
