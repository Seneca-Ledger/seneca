import { APP_NAME } from '../../common/brand';

/**
 * The DATEV-Format "Buchungsstapel" (EXTF, header version 700, data category
 * 21, format version 13), as DATEV documents it on developer.datev.de and in
 * its format check program (research pass of 2026-10-10). Pure functions: the
 * service decides what to book, this decides how DATEV wants it written.
 *
 * File rules: ";" separator, '"' text qualifier with inner quotes doubled, CRLF
 * after every line including the last, Windows-1252 encoding (UTF-8 is only
 * accepted with a BOM and not by every import path), name starting "EXTF_".
 */

/** Line 2, copied from DATEV's own sample file: all 125 column titles. */
export const DATEV_COLUMNS: readonly string[] = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basis-Umsatz',
  'WKZ Basis-Umsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
  'Postensperre',
  'Diverse Adressnummer',
  'Geschäftspartnerbank',
  'Sachverhalt',
  'Zinssperre',
  'Beleglink',
  'Beleginfo - Art 1',
  'Beleginfo - Inhalt 1',
  'Beleginfo - Art 2',
  'Beleginfo - Inhalt 2',
  'Beleginfo - Art 3',
  'Beleginfo - Inhalt 3',
  'Beleginfo - Art 4',
  'Beleginfo - Inhalt 4',
  'Beleginfo - Art 5',
  'Beleginfo - Inhalt 5',
  'Beleginfo - Art 6',
  'Beleginfo - Inhalt 6',
  'Beleginfo - Art 7',
  'Beleginfo - Inhalt 7',
  'Beleginfo - Art 8',
  'Beleginfo - Inhalt 8',
  'KOST1 - Kostenstelle',
  'KOST2 - Kostenstelle',
  'Kost-Menge',
  'EU-Land u. UStID (Bestimmung)',
  'EU-Steuersatz (Bestimmung)',
  'Abw. Versteuerungsart',
  'Sachverhalt L+L',
  'Funktionsergänzung L+L',
  'BU 49 Hauptfunktionstyp',
  'BU 49 Hauptfunktionsnummer',
  'BU 49 Funktionsergänzung',
  'Zusatzinformation - Art 1',
  'Zusatzinformation- Inhalt 1',
  'Zusatzinformation - Art 2',
  'Zusatzinformation- Inhalt 2',
  'Zusatzinformation - Art 3',
  'Zusatzinformation- Inhalt 3',
  'Zusatzinformation - Art 4',
  'Zusatzinformation- Inhalt 4',
  'Zusatzinformation - Art 5',
  'Zusatzinformation- Inhalt 5',
  'Zusatzinformation - Art 6',
  'Zusatzinformation- Inhalt 6',
  'Zusatzinformation - Art 7',
  'Zusatzinformation- Inhalt 7',
  'Zusatzinformation - Art 8',
  'Zusatzinformation- Inhalt 8',
  'Zusatzinformation - Art 9',
  'Zusatzinformation- Inhalt 9',
  'Zusatzinformation - Art 10',
  'Zusatzinformation- Inhalt 10',
  'Zusatzinformation - Art 11',
  'Zusatzinformation- Inhalt 11',
  'Zusatzinformation - Art 12',
  'Zusatzinformation- Inhalt 12',
  'Zusatzinformation - Art 13',
  'Zusatzinformation- Inhalt 13',
  'Zusatzinformation - Art 14',
  'Zusatzinformation- Inhalt 14',
  'Zusatzinformation - Art 15',
  'Zusatzinformation- Inhalt 15',
  'Zusatzinformation - Art 16',
  'Zusatzinformation- Inhalt 16',
  'Zusatzinformation - Art 17',
  'Zusatzinformation- Inhalt 17',
  'Zusatzinformation - Art 18',
  'Zusatzinformation- Inhalt 18',
  'Zusatzinformation - Art 19',
  'Zusatzinformation- Inhalt 19',
  'Zusatzinformation - Art 20',
  'Zusatzinformation- Inhalt 20',
  'Stück',
  'Gewicht',
  'Zahlweise',
  'Forderungsart',
  'Veranlagungsjahr',
  'Zugeordnete Fälligkeit',
  'Skontotyp',
  'Auftragsnummer',
  'Buchungstyp',
  'USt-Schlüssel (Anzahlungen)',
  'EU-Land (Anzahlungen)',
  'Sachverhalt L+L (Anzahlungen)',
  'EU-Steuersatz (Anzahlungen)',
  'Erlöskonto (Anzahlungen)',
  'Herkunft-Kz',
  'Buchungs GUID',
  'KOST-Datum',
  'SEPA-Mandatsreferenz',
  'Skontosperre',
  'Gesellschaftername',
  'Beteiligtennummer',
  'Identifikationsnummer',
  'Zeichnernummer',
  'Postensperre bis',
  'Bezeichnung SoBil-Sachverhalt',
  'Kennzeichen SoBil-Buchung',
  'Festschreibung',
  'Leistungsdatum',
  'Datum Zuord. Steuerperiode',
  'Fälligkeit',
  'Generalumkehr (GU)',
  'Steuersatz',
  'Land',
  'Abrechnungsreferenz',
  'BVV-Position',
  'EU-Land u. UStID (Ursprung)',
  'EU-Steuersatz (Ursprung)',
  'Abw. Skontokonto',
];

export interface DatevHeader {
  /** When the file was made. */
  createdAt: Date;
  consultantNumber: number;
  clientNumber: number;
  /** First day of the fiscal year, 'YYYY-MM-DD'; Belegdatum takes its year from here. */
  fiscalYearStart: string;
  /** Length of the client's general-ledger account numbers (4 in the standard setup). */
  accountLength: number;
  from: string;
  to: string;
  label: string;
  chart: '03' | '04';
}

export interface DatevBooking {
  /** Always positive, in minor units. */
  amountMinor: number;
  /** "S": the account is debited and the contra account credited; "H" the reverse. */
  side: 'S' | 'H';
  account: string;
  contraAccount: string;
  taxKey: string | null;
  /** 'YYYY-MM-DD'; only day and month are written. */
  date: string;
  documentNumber: string | null;
  text: string;
}

const compactDate = (date: string): string => date.replace(/-/g, '');

function timestamp(date: Date): string {
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}` +
    pad(date.getUTCMilliseconds(), 3)
  );
}

/** A quoted text field: no line breaks or control characters, quotes doubled, cut to length. */
export function textField(value: string | null | undefined, maxLength: number): string {
  const clean = (value ?? '')
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what DATEV forbids.
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return `"${clean.replace(/"/g, '""')}"`;
}

/** Belegfeld 1 allows only [A-Za-z0-9_$&%*+-/], up to 36 characters. */
export function documentField(value: string | null | undefined): string {
  return `"${(value ?? '').replace(/[^A-Za-z0-9_$&%*+\-/]/g, '').slice(0, 36)}"`;
}

/** Umsatz: positive, decimal comma, two decimals, no thousands separator. */
export function amountField(amountMinor: number): string {
  const minor = Math.abs(Math.round(amountMinor));
  return `${Math.floor(minor / 100)},${String(minor % 100).padStart(2, '0')}`;
}

export function headerLine(header: DatevHeader): string {
  return [
    '"EXTF"',
    '700',
    '21',
    '"Buchungsstapel"',
    '13',
    timestamp(header.createdAt),
    '',
    '"RE"',
    textField(APP_NAME, 25),
    '""',
    String(header.consultantNumber),
    String(header.clientNumber),
    compactDate(header.fiscalYearStart),
    String(header.accountLength),
    compactDate(header.from),
    compactDate(header.to),
    textField(header.label, 30),
    '""',
    '1',
    '0',
    // Not fixed: the adviser checks and corrects before anything is final.
    '0',
    '"EUR"',
    '',
    '""',
    '',
    '',
    `"${header.chart}"`,
    '',
    '',
    '""',
    '""',
  ].join(';');
}

export function bookingLine(booking: DatevBooking): string {
  const fields: string[] = new Array(DATEV_COLUMNS.length).fill('');
  fields[0] = amountField(booking.amountMinor);
  fields[1] = `"${booking.side}"`;
  fields[2] = '""';
  fields[5] = '""';
  fields[6] = booking.account;
  fields[7] = booking.contraAccount;
  fields[8] = booking.taxKey ? `"${booking.taxKey}"` : '""';
  fields[9] = `${booking.date.slice(8, 10)}${booking.date.slice(5, 7)}`;
  fields[10] = documentField(booking.documentNumber);
  fields[11] = '""';
  fields[13] = textField(booking.text, 60);
  return fields.join(';');
}

export function datevFileContent(header: DatevHeader, bookings: DatevBooking[]): string {
  const lines = [headerLine(header), DATEV_COLUMNS.join(';'), ...bookings.map(bookingLine)];
  return `${lines.join('\r\n')}\r\n`;
}

/** Windows-1252 for the characters it has beyond Latin-1. */
const CP1252_EXTRA: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/** Encodes to Windows-1252; a character it cannot hold becomes "?". */
export function encodeWindows1252(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) {
      bytes.push(code);
    } else {
      bytes.push(CP1252_EXTRA[char] ?? 0x3f);
    }
  }
  return Buffer.from(bytes);
}
