import { InsightCategory } from '@/entities/insight.entity';
import { QUOTES } from '@/modules/insights/quotes/catalog';
import { DailyQuoteService } from '@/modules/insights/quotes/daily-quote.service';
import { pickQuote } from '@/modules/insights/quotes/quote-preference';
import { SITUATION_THEMES } from '@/modules/insights/quotes/situation-themes';
import { QUOTE_TEXTS } from '@/modules/insights/quotes/texts';

type Stored = Record<string, { vote: 1 | -1; on: string }>;

function serviceWith(rows: unknown[], locale = 'en', quoteVotes: Stored = {}) {
  const insights = { find: vi.fn(async () => rows) };
  const users = {
    findOne: vi.fn(async () => ({ id: 'user-1', locale, quoteVotes })),
    query: vi.fn(async () => []),
  };
  return Object.assign(new DailyQuoteService(insights as any, users as any), { users });
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

describe('Quote thumbs', () => {
  // Long enough for every rotation to come round many times.
  const seeds = Array.from({ length: 5000 }, (_, index) => index);
  const shown = (votes: Record<string, 1 | -1>) =>
    seeds.map(seed => pickQuote(QUOTES, votes, seed));
  const share = (picks: typeof QUOTES, author: string) =>
    picks.filter(quote => quote.author === author).length / picks.length;

  it('without thumbs shows every quote equally often, a different one each day', () => {
    const counts = new Map<string, number>();
    for (const quote of shown({})) {
      counts.set(quote.id, (counts.get(quote.id) ?? 0) + 1);
    }
    expect(counts.size).toBe(QUOTES.length);
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
    for (const seed of seeds.slice(0, 30)) {
      expect(pickQuote(QUOTES, {}, seed + 1).id).not.toBe(pickQuote(QUOTES, {}, seed).id);
    }
  });

  it('never brings back a thumbed-down quote, and shows its look-alikes less', () => {
    const disliked = QUOTES[0];
    const picks = shown({ [disliked.id]: -1 });
    expect(picks.some(quote => quote.id === disliked.id)).toBe(false);
    expect(share(picks, disliked.author)).toBeLessThan(share(shown({}), disliked.author));
  });

  it('shows quotes like a thumbed-up one more often, and keeps that one in rotation', () => {
    const liked = QUOTES[0];
    const picks = shown({ [liked.id]: 1 });
    expect(share(picks, liked.author)).toBeGreaterThan(share(shown({}), liked.author));
    expect(picks.some(quote => quote.id === liked.id)).toBe(true);
  });

  it('still answers when every candidate was thumbed down', () => {
    const pool = QUOTES.slice(0, 2);
    const votes = Object.fromEntries(pool.map(quote => [quote.id, -1 as const]));
    expect(pool).toContain(pickQuote(pool, votes, 3));
  });

  it('keeps today\'s quote after a thumb on it; the thumb steers from the next day', async () => {
    const today = new Date(2026, 8, 29, 8);
    const before = await serviceWith([]).forUser('user-1', 'ws-1', today);
    const disliked: Stored = { [before.quote.id]: { vote: -1, on: '2026-09-29' } };

    const after = await serviceWith([], 'en', disliked).forUser('user-1', 'ws-1', today);
    expect(after.quote.id).toBe(before.quote.id);
    expect(after.vote).toBe(-1);

    const later = await Promise.all(
      Array.from({ length: 60 }, (_, offset) =>
        serviceWith([], 'en', disliked).forUser('user-1', 'ws-1', new Date(2026, 8, 30 + offset, 8)),
      ),
    );
    expect(later.some(result => result.quote.id === before.quote.id)).toBe(false);
  });

  it('tells the banner the thumb on the quote it shows', async () => {
    const liked = QUOTES[0].id;
    const service = serviceWith([], 'en', { [liked]: { vote: 1, on: '2026-08-01' } });
    const days = await Promise.all(
      Array.from({ length: 120 }, (_, offset) =>
        service.forUser('user-1', 'ws-1', new Date(2026, 8, 1 + offset, 8)),
      ),
    );
    expect(days.find(result => result.quote.id === liked)?.vote).toBe(1);
    expect(days.find(result => result.quote.id !== liked)?.vote).toBeNull();
  });

  it('stores a thumb with one jsonb update and takes it back with 0', async () => {
    const service = serviceWith([]);
    const quoteId = QUOTES[0].id;

    expect(await service.vote('user-1', quoteId, -1, new Date(2026, 8, 29, 12))).toEqual({
      vote: -1,
    });
    expect(service.users.query).toHaveBeenLastCalledWith(
      expect.stringContaining('jsonb_build_object'),
      ['user-1', quoteId, -1, QUOTES.length, '2026-09-29'],
    );
    expect(await service.vote('user-1', quoteId, 0)).toEqual({ vote: null });
    expect(service.users.query).toHaveBeenLastCalledWith(
      expect.stringContaining('"quote_votes" - $2::text'),
      ['user-1', quoteId],
    );
  });

  it('refuses a quote that is not in the catalogue', async () => {
    const service = serviceWith([]);
    await expect(service.vote('user-1', 'no-such-quote', 1)).rejects.toThrow();
    expect(service.users.query).not.toHaveBeenCalled();
  });
});
