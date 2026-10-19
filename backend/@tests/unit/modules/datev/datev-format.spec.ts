import {
  amountField,
  DATEV_COLUMNS,
  type DatevBooking,
  type DatevHeader,
  datevFileContent,
  documentField,
  encodeWindows1252,
  headerLine,
  textField,
} from '@/modules/datev/datev-format';
import { APP_NAME } from '../../../../src/common/brand';

/**
 * DATEV's own rules for the fields we fill, from its format check program's
 * Format_Buchungsstapel.xml (length / necessary) and the developer portal's
 * field regexes (research pass of 2026-10-10). Every data line we write must
 * pass all of them.
 */
const RULES: Array<{ index: number; name: string; required: boolean; pattern: RegExp }> = [
  { index: 0, name: 'Umsatz', required: true, pattern: /^(?!0{1,10},00)\d{1,10},\d{2}$/ },
  { index: 1, name: 'Soll/Haben', required: true, pattern: /^"[SH]"$/ },
  { index: 2, name: 'WKZ Umsatz', required: false, pattern: /^("[A-Z]{3}"|""|)$/ },
  { index: 6, name: 'Konto', required: true, pattern: /^(?!0+$)\d{1,9}$/ },
  { index: 7, name: 'Gegenkonto', required: true, pattern: /^(?!0+$)\d{1,9}$/ },
  { index: 8, name: 'BU-Schlüssel', required: false, pattern: /^"\d{0,4}"$/ },
  { index: 9, name: 'Belegdatum', required: true, pattern: /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])$/ },
  { index: 10, name: 'Belegfeld 1', required: false, pattern: /^"[A-Za-z0-9_$&%*+\-/]{0,36}"$/ },
  { index: 13, name: 'Buchungstext', required: false, pattern: /^"([^"]|""){0,60}"$/ },
];

/** Splits a DATEV line on ";" outside quotes. */
function split(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    }
    if (char === ';' && !quoted) {
      out.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  out.push(field);
  return out;
}

const HEADER: DatevHeader = {
  createdAt: new Date('2026-10-10T14:04:40.439Z'),
  consultantNumber: 29098,
  clientNumber: 55003,
  fiscalYearStart: '2026-01-01',
  accountLength: 4,
  from: '2026-01-01',
  to: '2026-03-31',
  label: `${APP_NAME} 2026-01-01 – 2026-03-31`,
  chart: '03',
};

const BOOKINGS: DatevBooking[] = [
  {
    amountMinor: 11900,
    side: 'H',
    account: '1200',
    contraAccount: '4930',
    taxKey: '401',
    date: '2026-03-10',
    documentNumber: 'RE-2026/0042',
    text: 'Bürobedarf Müller & "Söhne"; Kasse',
  },
  {
    amountMinor: 595000,
    side: 'S',
    account: '1200',
    contraAccount: '8400',
    taxKey: null,
    date: '2026-01-02',
    documentNumber: 'R 1.2: Rechnung Nr. ä',
    text: 'Kunde\nMüller AG\t€ – 😀',
  },
];

describe('DATEV Buchungsstapel format', () => {
  const content = datevFileContent(HEADER, BOOKINGS);
  const lines = content.split('\r\n');

  it('ends every line, the last included, with CRLF and nothing else', () => {
    expect(content.endsWith('\r\n')).toBe(true);
    expect(lines.at(-1)).toBe('');
    expect(content.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('writes the header as DATEV does: EXTF 700, category 21, Buchungsstapel 13, 31 fields', () => {
    const header = split(lines[0]);
    expect(header).toHaveLength(31);
    expect(header.slice(0, 5)).toEqual(['"EXTF"', '700', '21', '"Buchungsstapel"', '13']);
    expect(header[5]).toBe('20261010140440439');
    expect(header.slice(10, 16)).toEqual(['29098', '55003', '20260101', '4', '20260101', '20260331']);
    expect(header[21]).toBe('"EUR"');
    expect(header[26]).toBe('"03"');
  });

  it("writes DATEV's 125 column titles as line 2", () => {
    expect(split(lines[1])).toHaveLength(125);
    expect(lines[1].startsWith('Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;')).toBe(true);
    expect(DATEV_COLUMNS[13]).toBe('Buchungstext');
  });

  it('passes every DATEV field rule on every booking', () => {
    for (const line of lines.slice(2, -1)) {
      const fields = split(line);
      expect(fields).toHaveLength(125);
      for (const rule of RULES) {
        const value = fields[rule.index];
        if (rule.required) {
          expect(value).not.toBe('');
        }
        expect({ field: rule.name, ok: rule.pattern.test(value), value }).toMatchObject({ ok: true });
      }
    }
  });

  it('writes the booking itself as DATEV reads it', () => {
    const [first, second] = lines.slice(2, 4).map(split);
    expect(first.slice(0, 11)).toEqual([
      '119,00', '"H"', '""', '', '', '""', '1200', '4930', '"401"', '1003', '"RE-2026/0042"',
    ]);
    // Inner quotes doubled, ";" kept inside the quotes.
    expect(first[13]).toBe('"Bürobedarf Müller & ""Söhne""; Kasse"');
    expect(second.slice(0, 10)).toEqual(['5950,00', '"S"', '""', '', '', '""', '1200', '8400', '""', '0201']);
    // Characters DATEV does not allow in Belegfeld 1 are dropped.
    expect(second[10]).toBe('"R12RechnungNr"');
  });

  it('formats amounts with a decimal comma and two decimals, never a thousands separator', () => {
    expect(amountField(123456789)).toBe('1234567,89');
    expect(amountField(5)).toBe('0,05');
    expect(amountField(-1990)).toBe('19,90');
  });

  it('cuts text fields and folds line breaks', () => {
    expect(textField('a'.repeat(70), 60)).toBe(`"${'a'.repeat(60)}"`);
    expect(textField('line\r\nbreak', 60)).toBe('"line break"');
    expect(documentField('x'.repeat(40))).toBe(`"${'x'.repeat(36)}"`);
  });

  it('encodes Windows-1252: umlauts and € as single bytes, the rest as "?"', () => {
    const bytes = encodeWindows1252('Müller €– 😀');
    expect([...bytes]).toEqual([
      0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72, 0x20, 0x80, 0x96, 0x20, 0x3f,
    ]);
  });

  it('leaves no character outside Windows-1252 in the file', () => {
    const bytes = encodeWindows1252(content);
    expect(bytes.length).toBe([...content].length);
    expect(headerLine(HEADER)).toContain(`"${APP_NAME}"`);
  });
});
