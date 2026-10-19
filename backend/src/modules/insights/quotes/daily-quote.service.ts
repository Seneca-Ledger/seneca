import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, type Repository } from 'typeorm';
import { Insight, InsightCategory } from '../../../entities/insight.entity';
import { User } from '../../../entities/user.entity';
import { toDateOnly } from '../../goals/goal-money.util';
import { isStoicKey } from '../stoic-texts';
import { QUOTES } from './catalog';
import { SITUATION_THEMES } from './situation-themes';
import { QUOTE_TEXTS } from './texts';
import type { QuoteTheme } from './types';

/** The day's quote is chosen among this many of the user's most pressing situations. */
const SITUATIONS_IN_ROTATION = 3;

export interface DailyQuote {
  /** `YYYY-MM-DD` — the client hides a dismissed quote until this changes. */
  date: string;
  quote: {
    id: string;
    text: string;
    author: string;
    source: string;
    sourceUrl: string;
  };
  theme: QuoteTheme | null;
  /** The advice the quote answers, so the banner can say why it is today's. */
  reason: { insightId: string; type: string; title: string } | null;
}

function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

/**
 * One quote a day from a curated, source-checked catalogue — never generated.
 * Which one depends on the user's current advice: the few most important
 * situations take turns day by day, and within a situation's theme the quotes
 * rotate too, so the banner stays relevant without repeating itself.
 */
@Injectable()
export class DailyQuoteService {
  constructor(
    @InjectRepository(Insight)
    private readonly insightRepository: Repository<Insight>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** `locale` is the interface language; the profile's is the fallback. */
  async forUser(
    userId: string,
    workspaceId: string,
    now = new Date(),
    locale?: string,
  ): Promise<DailyQuote> {
    const [user, situations] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId }, select: ['id', 'locale'] }),
      this.insightRepository.find({
        where: [
          {
            userId,
            workspaceId,
            isDismissed: false,
            category: In([InsightCategory.STOIC, InsightCategory.EXPERT]),
            expiresAt: MoreThan(now),
          },
          {
            userId,
            workspaceId,
            isDismissed: false,
            category: In([InsightCategory.STOIC, InsightCategory.EXPERT]),
            expiresAt: IsNull(),
          },
        ],
      }),
    ]);

    const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
    const ranked = situations
      .filter(row => row.messageKey && isStoicKey(row.messageKey))
      .sort((a, b) => Number(b.data?.priority ?? 0) - Number(a.data?.priority ?? 0))
      .slice(0, SITUATIONS_IN_ROTATION);
    const situation = ranked.length > 0 ? ranked[day % ranked.length] : null;
    const theme =
      situation?.messageKey && isStoicKey(situation.messageKey)
        ? SITUATION_THEMES[situation.messageKey]
        : null;

    const themed = theme ? QUOTES.filter(quote => quote.themes.includes(theme)) : [];
    const pool = themed.length > 0 ? themed : QUOTES;
    const quote = pool[(day + hash(userId)) % pool.length];
    const texts =
      (locale ? QUOTE_TEXTS[locale] : undefined) ??
      QUOTE_TEXTS[user?.locale ?? 'en'] ??
      QUOTE_TEXTS.en;

    return {
      date: toDateOnly(now),
      quote: {
        id: quote.id,
        text: texts.quotes[quote.id] ?? QUOTE_TEXTS.en.quotes[quote.id],
        author: texts.authors[quote.author] ?? quote.author,
        source: quote.source,
        sourceUrl: quote.sourceUrl,
      },
      theme,
      reason: situation
        ? { insightId: situation.id, type: situation.type, title: situation.title }
        : null,
    };
  }
}
