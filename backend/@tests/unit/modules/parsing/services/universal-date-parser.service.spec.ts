import { UniversalDateParser } from '@/modules/parsing/services/universal-date-parser.service';

describe('UniversalDateParser', () => {
  let service: UniversalDateParser;

  beforeEach(() => {
    service = new UniversalDateParser();
  });

  // ─── ISO 8601 ─────────────────────────────────────────────

  describe('ISO 8601 format', () => {
    it('parses YYYY-MM-DD', async () => {
      await expect(service.parseDate('2026-04-04')).resolves.toMatchObject({
        format: 'ISO8601',
        confidence: 0.95,
        date: new Date(2026, 3, 4),
      });
    });

    it('parses YYYY-MM-DD with time suffix (ignores time)', async () => {
      await expect(service.parseDate('2026-04-04T12:30:00')).resolves.toMatchObject({
        format: 'ISO8601',
        date: new Date(2026, 3, 4),
      });
    });

    it('parses first day of year', async () => {
      await expect(service.parseDate('2026-01-01')).resolves.toMatchObject({
        date: new Date(2026, 0, 1),
      });
    });

    it('parses last day of year', async () => {
      await expect(service.parseDate('2026-12-31')).resolves.toMatchObject({
        date: new Date(2026, 11, 31),
      });
    });
  });

  // ─── Numeric YYYYMMDD ─────────────────────────────────────

  describe('numeric format YYYYMMDD', () => {
    it('parses compact date', async () => {
      await expect(service.parseDate('20260404')).resolves.toMatchObject({
        format: 'NUMERIC',
        confidence: 0.9,
        date: new Date(2026, 3, 4),
      });
    });

    it('parses compact date with time suffix YYYYMMDDHHMMSS', async () => {
      await expect(service.parseDate('20260404123000')).resolves.toMatchObject({
        format: 'NUMERIC',
        date: new Date(2026, 3, 4),
      });
    });
  });

  // ─── Dotted formats ───────────────────────────────────────

  describe('dotted formats', () => {
    it('parses DD.MM.YYYY', async () => {
      await expect(service.parseDate('04.04.2026')).resolves.toMatchObject({
        format: 'DOTTED',
        confidence: 0.8,
        date: new Date(2026, 3, 4),
      });
    });

    it('parses YYYY.MM.DD', async () => {
      await expect(service.parseDate('2026.04.04')).resolves.toMatchObject({
        format: 'DOTTED',
        date: new Date(2026, 3, 4),
      });
    });

    it('parses DD.MM.YY (2-digit year)', async () => {
      const result = await service.parseDate('04.04.26');
      expect(result).not.toBeNull();
      expect(result!.format).toBe('DOTTED');
      // 2-digit year should be expanded to current century
      expect(result!.date.getMonth()).toBe(3); // April
      expect(result!.date.getDate()).toBe(4);
    });

    it('parses single-digit day and month (4.4.2026)', async () => {
      await expect(service.parseDate('4.4.2026')).resolves.toMatchObject({
        format: 'DOTTED',
        date: new Date(2026, 3, 4),
      });
    });
  });

  // ─── Slashed formats ──────────────────────────────────────

  describe('slashed formats', () => {
    it('parses MM/DD/YYYY (US format)', async () => {
      await expect(service.parseDate('04/15/2026')).resolves.toMatchObject({
        format: 'SLASHED',
        confidence: 0.8,
        date: new Date(2026, 3, 15),
      });
    });

    it('parses YYYY/MM/DD', async () => {
      await expect(service.parseDate('2026/04/15')).resolves.toMatchObject({
        format: 'SLASHED',
        date: new Date(2026, 3, 15),
      });
    });
  });

  // ─── Textual month names ──────────────────────────────────

  describe('textual month names', () => {
    it('parses English "Month DD, YYYY"', async () => {
      await expect(service.parseDate('April 15, 2026')).resolves.toMatchObject({
        format: 'TEXTUAL_MONTH',
        confidence: 0.85,
        date: new Date(2026, 3, 15),
      });
    });

    it('parses English abbreviated "Apr 15, 2026"', async () => {
      await expect(service.parseDate('Apr 15, 2026')).resolves.toMatchObject({
        format: 'TEXTUAL_MONTH',
        date: new Date(2026, 3, 15),
      });
    });

    it('parses English "DD Month YYYY"', async () => {
      await expect(service.parseDate('15 April 2026')).resolves.toMatchObject({
        format: 'TEXTUAL_MONTH',
        date: new Date(2026, 3, 15),
      });
    });

    it('parses Russian/Cyrillic month names', async () => {
      await expect(service.parseDate('15 январь 2026', 'ru')).resolves.toMatchObject({
        format: 'TEXTUAL_MONTH',
        date: new Date(2026, 0, 15),
      });
    });

    it('parses German month names', async () => {
      await expect(service.parseDate('15 januar 2026', 'de')).resolves.toMatchObject({
        format: 'TEXTUAL_MONTH',
        date: new Date(2026, 0, 15),
      });
    });

    it('parses Turkish month names', async () => {
      await expect(service.parseDate('15 nisan 2026', 'tr')).resolves.toMatchObject({
        format: 'TEXTUAL_MONTH',
        date: new Date(2026, 3, 15),
      });
    });
  });

  // ─── Spaced formats ───────────────────────────────────────

  describe('spaced formats', () => {
    it('parses "DD MM YYYY"', async () => {
      await expect(service.parseDate('15 04 2026')).resolves.toMatchObject({
        format: 'SPACED',
        confidence: 0.7,
        date: new Date(2026, 3, 15),
      });
    });
  });

  // ─── Edge cases ───────────────────────────────────────────

  describe('edge cases', () => {
    it('returns null for empty string', async () => {
      await expect(service.parseDate('')).resolves.toBeNull();
    });

    it('returns null for null/undefined', async () => {
      await expect(service.parseDate(null as any)).resolves.toBeNull();
      await expect(service.parseDate(undefined as any)).resolves.toBeNull();
    });

    it('returns null for non-string input', async () => {
      await expect(service.parseDate(123 as any)).resolves.toBeNull();
    });

    it('returns null for pure text', async () => {
      await expect(service.parseDate('hello world')).resolves.toBeNull();
    });

    it('trims whitespace', async () => {
      await expect(service.parseDate('  2026-04-04  ')).resolves.toMatchObject({
        date: new Date(2026, 3, 4),
      });
    });

    it('rejects year before 1900', async () => {
      await expect(service.parseDate('1899-01-01')).resolves.toBeNull();
    });

    it('rejects year after 2099', async () => {
      await expect(service.parseDate('2100-01-01')).resolves.toBeNull();
    });
  });

  // ─── Utility methods ──────────────────────────────────────

  describe('getSupportedLocales', () => {
    it('returns supported locales including en, ru, de', () => {
      const locales = service.getSupportedLocales();
      expect(locales).toContain('en');
      expect(locales).toContain('ru');
      expect(locales).toContain('de');
      expect(locales).toContain('fr');
      expect(locales).toContain('kk');
    });
  });

  describe('addMonthNames', () => {
    it('adds custom locale and can parse with it', async () => {
      service.addMonthNames('custom', { testmonth: 6 });
      await expect(service.parseDate('15 testmonth 2026', 'custom')).resolves.toMatchObject({
        format: 'TEXTUAL_MONTH',
        date: new Date(2026, 5, 15),
      });
    });
  });
});
