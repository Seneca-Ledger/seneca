import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { Insight, InsightCategory } from '../../../entities/insight.entity';
import { User } from '../../../entities/user.entity';
import { toDateOnly } from '../../goals/goal-money.util';
import { isStoicKey } from '../stoic-texts';
import { QUOTES } from './catalog';
import { pickQuote, votesBefore } from './quote-preference';
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
  /** The reader's thumb on this quote, so the banner shows it pressed. */
  vote: 1 | -1 | null;
}

/** More thumbs than the catalogue holds quotes can only be someone filling the column. */
const MAX_VOTES = QUOTES.length;

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
 * rotate too, so the banner stays relevant without repeating itself. The
 * reader's thumbs steer the rotation: a thumbed-down quote stays away, and
 * quotes like the ones they thumbed up come round more often.
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
      this.userRepository.findOne({
        where: { id: userId },
        select: {
          id: true,
          locale: true,
          quoteVotes: true,
        },
      }),
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
    const date = toDateOnly(now);
    const stored = user?.quoteVotes ?? {};
    const quote = pickQuote(pool, votesBefore(stored, date), day + hash(userId));
    const texts =
      (locale ? QUOTE_TEXTS[locale] : undefined) ??
      QUOTE_TEXTS[user?.locale ?? 'en'] ??
      QUOTE_TEXTS.en;

    return {
      date,
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
      vote: stored[quote.id]?.vote ?? null,
    };
  }

  /**
   * Stores a thumb on a catalogue quote (0 takes it back), dated with the
   * reader's day so it steers the picks from the next day on. One jsonb UPDATE,
   * so no other column is read back and rewritten; an unknown id is refused.
   */
  async vote(
    userId: string,
    quoteId: string,
    vote: 1 | -1 | 0,
    now = new Date(),
  ): Promise<{ vote: 1 | -1 | null }> {
    if (!QUOTES.some(quote => quote.id === quoteId)) {
      throw new NotFoundException(appError('ENTRY_NOT_FOUND'));
    }
    if (vote === 0) {
      await this.userRepository.query(
        `UPDATE "users" SET "quote_votes" = "quote_votes" - $2::text WHERE "id" = $1`,
        [userId, quoteId],
      );
      return { vote: null };
    }
    await this.userRepository.query(
      `UPDATE "users"
       SET "quote_votes" = "quote_votes" || jsonb_build_object(
         $2::text,
         jsonb_build_object('vote', $3::int, 'on', $5::text)
       )
       WHERE "id" = $1
         AND (
           ("quote_votes" -> $2::text) IS NOT NULL
           OR (SELECT count(*) FROM jsonb_object_keys("quote_votes")) < $4
         )`,
      [userId, quoteId, vote, MAX_VOTES, toDateOnly(now)],
    );
    return { vote };
  }
}
