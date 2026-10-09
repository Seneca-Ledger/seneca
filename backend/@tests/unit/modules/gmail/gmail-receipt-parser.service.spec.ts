jest.mock('pdf-parse', () => {
  const mock = jest.fn();
  (mock as any).__esModule = true;
  return mock;
});

const { GmailReceiptParserService, normalizeDateHeader } =
  require('../../../../src/modules/gmail/services/gmail-receipt-parser.service') as typeof import('../../../../src/modules/gmail/services/gmail-receipt-parser.service');
const { UniversalAmountParser } =
  require('../../../../src/modules/parsing/services/universal-amount-parser.service') as typeof import('../../../../src/modules/parsing/services/universal-amount-parser.service');
const pdfParse = require('pdf-parse') as jest.MockedFunction<typeof import('pdf-parse')>;

describe('GmailReceiptParserService', () => {
  let service: InstanceType<typeof GmailReceiptParserService>;
  let pdfParseMock: jest.MockedFunction<typeof pdfParse>;

  beforeEach(() => {
    pdfParseMock = pdfParse as jest.MockedFunction<typeof pdfParse>;
    pdfParseMock.mockReset();
    service = new GmailReceiptParserService(new UniversalAmountParser());
  });

  it('skips generic page markers when extracting vendor', () => {
    const vendor = (service as any).extractVendor('Page 1 of 1\nGitHub\nReceipt');

    expect(vendor).toBe('GitHub');
  });

  it('falls back to sender name when vendor line is generic', () => {
    const vendor = (service as any).extractVendor('Receipt\nInvoice', 'GitHub');

    expect(vendor).toBe('GitHub');
  });

  it('prefers sender brand when pdf line is long sentence', () => {
    const vendor = (service as any).extractVendor(
      'We received payment for your sponsorship. Thanks for your support of Open Source Software!',
      'GitHub <noreply@github.com>',
    );

    expect(vendor).toBe('GitHub');
  });

  it('normalizes sender support suffix into brand', () => {
    const vendor = (service as any).extractVendor(
      'Page 1 of 1',
      'Bitwage Support <support@bitwage.com>',
    );

    expect(vendor).toBe('Bitwage');
  });

  it('normalizes sender no-reply suffix into brand', () => {
    const vendor = (service as any).extractVendor(
      'Receipt\nInvoice',
      'Stripe No Reply <no-reply@stripe.com>',
    );

    expect(vendor).toBe('Stripe');
  });

  it('extracts brand from sender email domain when display name is absent', () => {
    const vendor = (service as any).extractVendor('Invoice', '<billing@lidl.com>');

    expect(vendor).toBe('Lidl');
  });

  it('skips date-like lines when extracting vendor', () => {
    const vendor = (service as any).extractVendor(
      'Date2026-02-16 10:57AM PST\nGitHub\nTotal: $10.00',
    );

    expect(vendor).toBe('GitHub');
  });

  it('skips lines that look like timestamps', () => {
    const vendor = (service as any).extractVendor('2026-02-16\n10:57 AM PST\nSpotify');

    expect(vendor).toBe('Spotify');
  });

  it('skips numeric-only lines', () => {
    const vendor = (service as any).extractVendor('12345\nNetflix');

    expect(vendor).toBe('Netflix');
  });

  it('skips amount-like lines', () => {
    const vendor = (service as any).extractVendor('$49.99\nAdobe Creative Cloud');

    expect(vendor).toBe('Adobe Creative Cloud');
  });

  it('skips email address lines', () => {
    const vendor = (service as any).extractVendor(
      'noreply@github.com\nGitHub',
      'GitHub <noreply@github.com>',
    );

    expect(vendor).toBe('GitHub');
  });

  it('falls back to sender brand when candidate lines are id-like', () => {
    const vendor = (service as any).extractVendor(
      'ABCDEF-12345\n12345',
      'Notion <team@makenotion.com>',
    );

    expect(vendor).toBe('Notion');
  });

  describe('AI-powered merchant extraction', () => {
    it('uses AI result when available and confidence is high', async () => {
      const aiMock = {
        isAvailable: jest.fn().mockReturnValue(true),
        extractMerchant: jest.fn().mockResolvedValue({ merchant: 'GitHub', confidence: 0.95 }),
      };

      const aiService = new GmailReceiptParserService(new UniversalAmountParser(), aiMock as any);

      const vendor = await (aiService as any).extractVendorWithAi(
        'Date2026-02-16 10:57AM PST\nGitHub',
        {
          sender: 'GitHub <noreply@github.com>',
          subject: '[GitHub] Receipt',
          emailBody: '<p>Thanks for your payment</p>',
        },
      );

      expect(vendor).toBe('GitHub');
      expect(aiMock.extractMerchant).toHaveBeenCalled();
    });

    it('falls back to heuristics when AI returns null', async () => {
      const aiMock = {
        isAvailable: jest.fn().mockReturnValue(true),
        extractMerchant: jest.fn().mockResolvedValue(null),
      };

      const aiService = new GmailReceiptParserService(new UniversalAmountParser(), aiMock as any);

      const vendor = await (aiService as any).extractVendorWithAi(
        'Spotify\nReceipt for your subscription',
        {
          sender: 'no-reply@spotify.com',
          subject: 'Receipt',
        },
      );

      expect(vendor).toBe('Spotify');
    });

    it('falls back to heuristics when AI is unavailable', async () => {
      const aiMock = {
        isAvailable: jest.fn().mockReturnValue(false),
        extractMerchant: jest.fn(),
      };

      const aiService = new GmailReceiptParserService(new UniversalAmountParser(), aiMock as any);

      const vendor = await (aiService as any).extractVendorWithAi('Netflix\nMonthly subscription', {
        sender: 'info@netflix.com',
      });

      expect(vendor).toBe('Netflix');
      expect(aiMock.extractMerchant).not.toHaveBeenCalled();
    });

    it('extracts merchant from email-only parsing flow', async () => {
      const aiMock = {
        isAvailable: jest.fn().mockReturnValue(true),
        extractMerchant: jest.fn().mockResolvedValue({ merchant: 'Notion', confidence: 0.8 }),
      };

      const aiService = new GmailReceiptParserService(new UniversalAmountParser(), aiMock as any);

      const parsed = await aiService.parseFromEmailOnly({
        sender: 'Notion <billing@makenotion.com>',
        subject: 'Your invoice',
        dateHeader: '2026-02-16',
        emailBody: '<p>Amount paid: $12.00</p>',
      });

      expect(parsed.vendor).toBe('Notion');
      expect(parsed.currency).toBe('USD');
    });
  });

  it('extracts USD amount and currency from amount due line', async () => {
    const parsed = await (service as any).extractAmountWithCurrency('Amount Due: $1,234.56');

    expect(parsed).toEqual({ amount: 1234.56, currency: 'USD' });
  });

  it('extracts KZT amount from a total line with KZT suffix', async () => {
    const parsed = await (service as any).extractAmountWithCurrency('TOTAL 90,000.00KZT');

    expect(parsed).toEqual({ amount: 90000, currency: 'KZT' });
  });

  it('extracts CZK amount and currency from localized total line', async () => {
    const parsed = await (service as any).extractAmountWithCurrency('Celkem: 1 500,00 CZK');

    expect(parsed).toEqual({ amount: 1500, currency: 'CZK' });
  });

  describe('receipts in the email body', () => {
    it('takes line items from the stripped body and normalises the Date header', async () => {
      const extractor = {
        extractFromText: jest.fn(async () => ({
          lineItems: [
            { description: 'Echo Dot', amount: 49.99 },
            { description: 'HDMI cable', amount: 9.99 },
            { description: 'Broken', amount: 0 },
          ],
          totalAmount: 59.98,
        })),
      };
      const bodyService = new GmailReceiptParserService(
        new UniversalAmountParser(),
        undefined,
        extractor as any,
      );

      const parsed = await bodyService.parseFromEmailOnly({
        sender: 'order-update@amazon.de',
        subject: 'Your order',
        dateHeader: 'Mon, 11 May 2026 10:15:00 +0200',
        emailBody: '<p>Echo Dot 49.99 EUR</p><p>HDMI cable 9.99 EUR</p><p>Total 59.98 EUR</p>',
      });

      expect(parsed?.lineItems).toEqual([
        { description: 'Echo Dot', amount: 49.99 },
        { description: 'HDMI cable', amount: 9.99 },
      ]);
      expect(parsed?.date).toBe('2026-05-11');
      expect(typeof parsed?.amount).toBe('number');
    });

    it('keeps an unparseable Date header as it is', () => {
      expect(normalizeDateHeader('yesterday-ish')).toBe('yesterday-ish');
      expect(normalizeDateHeader('2026-05-11')).toBe('2026-05-11');
      expect(normalizeDateHeader(undefined)).toBeUndefined();
    });
  });

  describe('line item extraction filters', () => {
    it('skips date-range-like descriptions', async () => {
      const lineItems = await (service as any).extractLineItems(
        'Feb 27, 2026-Mar 15,2026 202.00\nTotal 202.00',
      );

      expect(lineItems).toEqual([]);
    });

    it('skips address-like descriptions', async () => {
      const lineItems = await (service as any).extractLineItems(
        'San Francisco, CA 94107 941.00\nTotal 941.00',
      );

      expect(lineItems).toEqual([]);
    });

    it('skips sentence-like descriptions', async () => {
      const lineItems = await (service as any).extractLineItems(
        'Thanks for your purchase! 202.00\nTotal 202.00',
      );

      expect(lineItems).toEqual([]);
    });

    it('accepts a normal line item', async () => {
      const lineItems = await (service as any).extractLineItems('GitHub Actions 10.00');

      expect(lineItems).toEqual([{ description: 'GitHub Actions', amount: 10 }]);
    });
  });

  it('drops line items when their sum dwarfs the total', async () => {
    pdfParseMock.mockResolvedValue({
      text: [
        'GitHub',
        'Line Item A 600.00',
        'Line Item B 500.00',
        'Total $10.00',
      ].join('\n'),
    } as any);

    const parsed = await (service as any).parsePdfReceipt(Buffer.from(''), {
      sender: 'GitHub <noreply@github.com>',
    });

    expect(parsed.amount).toBe(10);
    expect(parsed.lineItems).toEqual([]);
  });

  it('keeps GitHub receipt date/address lines out of line items', async () => {
    pdfParseMock.mockResolvedValue({
      text: [
        'GitHub',
        'Thanks for your purchase',
        'Feb 27, 2026 - Mar 15, 2026',
        'San Francisco, CA 94107',
        'Total: $17.61',
      ].join('\n'),
    } as any);

    const parsed = await (service as any).parsePdfReceipt(Buffer.from(''), {
      sender: 'GitHub <noreply@github.com>',
    });

    expect(parsed.amount).toBe(17.61);
    expect(parsed.lineItems).toEqual([]);
  });
});

describe('GmailReceiptParserService.extractDate', () => {
  const extract = (text: string): string | undefined =>
    (
      new GmailReceiptParserService(new UniversalAmountParser()) as unknown as {
        extractDate(input: string): string | undefined;
      }
    ).extractDate(text);

  it('returns a plausible receipt date in either common layout', () => {
    expect(extract('Receipt\nDate: 16.02.2026\nTotal 12.00')).toBe('16.02.2026');
    expect(extract('Issued 2026-02-16 10:31')).toBe('2026-02-16');
  });

  it('ignores digit runs inside DOIs, page references and impossible dates', () => {
    expect(extract('doi:10.1145/1250734.1250752 pp. 465-478')).toBeUndefined();
    expect(extract('ref 11.11.9301 something')).toBeUndefined();
    expect(extract('31.02.2026 is not a date')).toBeUndefined();
    expect(extract('see 99.99.2026 or 2026-13-01')).toBeUndefined();
  });

  it('skips a bogus candidate and keeps looking for a real one', () => {
    expect(extract('code 12.12.9999\nDate 05.03.2026')).toBe('05.03.2026');
  });
});
