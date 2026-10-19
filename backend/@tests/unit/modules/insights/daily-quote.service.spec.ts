import { InsightCategory } from '@/entities/insight.entity';
import { QUOTES } from '@/modules/insights/quotes/catalog';
import { DailyQuoteService } from '@/modules/insights/quotes/daily-quote.service';
import { SITUATION_THEMES } from '@/modules/insights/quotes/situation-themes';
import { QUOTE_TEXTS } from '@/modules/insights/quotes/texts';

function serviceWith(rows: unknown[], locale = 'en') {
  const insights = { find: jest.fn(async () => rows) };
  const users = { findOne: jest.fn(async () => ({ id: 'user-1', locale })) };
  return new DailyQuoteService(insights as any, users as any);
}

const row = (messageKey: string, priority: number, title = messageKey) => ({
  id: `i-${messageKey}`,
  type: 'stoic.plan',
  category: InsightCategory.STOIC,
  messageKey,
  title,
  data: { priority },
});

describe('Quote catalogue', () => {
  it('has unique ids, a source for every quote, and quotes for every theme advice can ask for', () => {
    expect(new Set(QUOTES.map(quote => quote.id)).size).toBe(QUOTES.length);
    for (const quote of QUOTES) {
      expect(quote.source.length).toBeGreaterThan(3);
      expect(quote.sourceUrl).toMatch(/^https?:\/\//);
    }
    for (const theme of new Set(Object.values(SITUATION_THEMES))) {
      expect({ theme, covered: QUOTES.some(quote => quote.themes.includes(theme)) }).toEqual({
        theme,
        covered: true,
      });
    }
  });

  it.each(Object.keys(QUOTE_TEXTS))('%s has every quote and every author', locale => {
    const texts = QUOTE_TEXTS[locale];
    for (const quote of QUOTES) {
      expect({ id: quote.id, text: Boolean(texts.quotes[quote.id]?.trim()) }).toEqual({
        id: quote.id,
        text: true,
      });
      expect(texts.authors[quote.author]).toBeTruthy();
    }
  });
});

describe('DailyQuoteService', () => {
  const day = new Date(2026, 8, 29, 8, 0);

  it('answers the most pressing situation with a quote on its theme', async () => {
    const service = serviceWith([row('stoic.small_purchases', 40, 'Coffee Bar, 12 times')]);

    const result = await service.forUser('user-1', 'ws-1', day);

    expect(result.theme).toBe('small_things');
    expect(QUOTES.find(quote => quote.id === result.quote.id)?.themes).toContain('small_things');
    expect(result.reason).toEqual({
      insightId: 'i-stoic.small_purchases',
      type: 'stoic.plan',
      title: 'Coffee Bar, 12 times',
    });
    expect(result.date).toBe('2026-09-29');
  });

  it('changes the quote from one day to the next', async () => {
    const rows = [row('stoic.small_purchases', 40)];
    const today = await serviceWith(rows).forUser('user-1', 'ws-1', day);
    const tomorrow = await serviceWith(rows).forUser('user-1', 'ws-1', new Date(2026, 8, 30, 8));
    expect(tomorrow.quote.id).not.toBe(today.quote.id);
  });

  it('rotates between the top situations day by day', async () => {
    const rows = [
      row('stoic.shortfall', 100),
      row('stoic.generosity_gap', 38),
      row('stoic.unclassified', 10),
    ];
    const themes = new Set<string | null>();
    for (let offset = 0; offset < 3; offset += 1) {
      const result = await serviceWith(rows).forUser(
        'user-1',
        'ws-1',
        new Date(2026, 8, 29 + offset, 8),
      );
      themes.add(result.theme);
    }
    expect(themes).toEqual(new Set(['foresight', 'generosity', 'discipline']));
  });

  it('still has a quote for someone with no advice yet', async () => {
    const result = await serviceWith([]).forUser('user-1', 'ws-1', day);
    expect(result.theme).toBeNull();
    expect(result.reason).toBeNull();
    expect(result.quote.text.length).toBeGreaterThan(0);
  });

  it('prefers the interface language over the profile one', async () => {
    const result = await serviceWith([row('stoic.small_purchases', 40)], 'en').forUser(
      'user-1',
      'ws-1',
      day,
      'de',
    );
    expect(result.quote.text).toBe(QUOTE_TEXTS.de.quotes[result.quote.id]);
    expect(result.quote.author).toBe(QUOTE_TEXTS.de.authors[QUOTES.find(q => q.id === result.quote.id)!.author]);
  });

  it('speaks the reader language', async () => {
    const result = await serviceWith([row('stoic.small_purchases', 40)], 'ru').forUser(
      'user-1',
      'ws-1',
      day,
    );
    expect(result.quote.text).toBe(QUOTE_TEXTS.ru.quotes[result.quote.id]);
  });
});
