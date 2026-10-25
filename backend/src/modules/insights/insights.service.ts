import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, type Repository } from 'typeorm';
import { Insight, InsightCategory } from '../../entities/insight.entity';
import { User } from '../../entities/user.entity';
import type { InsightCandidate } from './analyzers/analyzer.interface';
import { FinancialAnalyzer } from './analyzers/financial.analyzer';
import { OperationalAnalyzer } from './analyzers/operational.analyzer';
import { StoicAnalyzer } from './analyzers/stoic.analyzer';
import {
  INSIGHT_TRANSLATIONS,
  type InsightMessageKey,
  renderInsight,
} from './insight-translations';
import { QUOTE_TEXTS } from './quotes/texts';
import { isStoicKey } from './stoic-texts';

type ListInsightsParams = {
  userId: string;
  workspaceId: string;
  category?: string;
  limit?: number;
  offset?: number;
  /** Interface language of the reader; keyed rows are rendered into it. */
  locale?: string;
};

@Injectable()
export class InsightsService {
  constructor(
    @InjectRepository(Insight)
    private readonly insightRepository: Repository<Insight>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly operationalAnalyzer: OperationalAnalyzer,
    private readonly financialAnalyzer: FinancialAnalyzer,
    private readonly stoicAnalyzer: StoicAnalyzer,
  ) {}

  /**
   * `newInsights` carries the rows that were actually *created* this run —
   * distinct from ones that already existed and just got their numbers
   * refreshed. Telegram's digest push (see TelegramScheduler) reads this to
   * notify once when a warning first appears rather than every time the
   * cron re-confirms it's still true.
   */
  async refresh(
    userId: string,
    workspaceId: string,
    options: { locale?: string } = {},
  ): Promise<{ created: number; updated: number; total: number; newInsights: Insight[] }> {
    const context = { userId, workspaceId };
    const [operational, financial, stoic] = await Promise.all([
      this.operationalAnalyzer.analyze(context),
      this.financialAnalyzer.analyze(context),
      this.stoicAnalyzer.analyze(context),
    ]);
    const candidates = [...operational, ...financial, ...stoic];

    // One refresh writes a handful of insights for the same recipient — read
    // the locale they are phrased in once, not once per insight.
    // The interface language wins over the profile's: the switcher only sets
    // a cookie, so the two can disagree, and the reader sees the interface.
    const locale =
      options.locale && options.locale in INSIGHT_TRANSLATIONS
        ? options.locale
        : await this.resolveLocale(userId);

    let created = 0;
    let updated = 0;
    const newInsights: Insight[] = [];

    for (const candidate of candidates) {
      const result = await this.upsertCandidate(userId, workspaceId, candidate, locale);
      if (result.created) {
        created += 1;
        newInsights.push(result.insight);
      } else {
        updated += 1;
      }
    }

    await this.retireStaleStoic(
      userId,
      workspaceId,
      stoic.map(candidate => candidate.deduplicationKey),
    );

    return {
      created,
      updated,
      total: candidates.length,
      newInsights,
    };
  }

  /**
   * Stoic advice describes the month as it stands, and its kinds exclude each
   * other — praise appears only when nothing needs correcting. A Stoic row
   * whose condition no longer holds is removed rather than left to expire, so
   * yesterday's praise never sits next to today's correction. The analyzer
   * recomputes everything from transactions, so nothing is lost.
   */
  private async retireStaleStoic(
    userId: string,
    workspaceId: string,
    currentKeys: string[],
  ): Promise<void> {
    const query = this.insightRepository
      .createQueryBuilder()
      .delete()
      .from(Insight)
      .where('user_id = :userId', { userId })
      .andWhere('workspace_id = :workspaceId', { workspaceId })
      .andWhere('category IN (:...categories)', {
        categories: [InsightCategory.STOIC, InsightCategory.EXPERT],
      })
      .andWhere('is_dismissed = false');
    if (currentKeys.length > 0) {
      query.andWhere('deduplication_key NOT IN (:...currentKeys)', { currentKeys });
    }
    await query.execute();
  }

  async list(params: ListInsightsParams) {
    const limit = Number.isFinite(params.limit) ? (params.limit as number) : 30;
    const offset = Number.isFinite(params.offset) ? (params.offset as number) : 0;
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);
    const normalizedOffset = Math.max(offset, 0);
    const now = new Date();

    const queryBuilder = this.insightRepository
      .createQueryBuilder('insight')
      .where('insight.userId = :userId', { userId: params.userId })
      .andWhere('insight.isDismissed = false')
      .andWhere('(insight.expiresAt IS NULL OR insight.expiresAt > :now)', { now })
      .orderBy('insight.createdAt', 'DESC')
      .take(normalizedLimit)
      .skip(normalizedOffset);

    queryBuilder.andWhere('insight.workspaceId = :workspaceId', {
      workspaceId: params.workspaceId,
    });

    if (params.category) {
      queryBuilder.andWhere('insight.category = :category', {
        category: params.category,
      });
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items: items.map(item => this.localize(item, params.locale)),
      total,
      limit: normalizedLimit,
      offset: normalizedOffset,
    };
  }

  /**
   * The stored title and message are in the language of whichever write wrote
   * them last, which is not necessarily the one the reader is looking at now:
   * a row written by the cron, or before the reader switched languages, would
   * otherwise stay in the old language until the next refresh happens to run.
   * The key and params are kept alongside exactly so the text can be built
   * again here, in the reader's language, on every read.
   *
   * Left alone: rows without a key (nothing to render from) and rows whose
   * stored text is already in this language.
   */
  private localize(insight: Insight, locale?: string): Insight {
    if (!locale) {
      return insight;
    }
    const text = this.localizeText(insight, locale);
    const data = this.localizeExpert(insight.data, locale);
    if (!text && data === insight.data) {
      return insight;
    }
    return { ...insight, ...text, data } as Insight;
  }

  /** Template text in the reader's language, or null when the row keeps its own. */
  private localizeText(
    insight: Insight,
    locale: string,
  ): { title: string; message: string } | null {
    const key = insight.messageKey;
    const params = insight.messageParams;
    if (!(key && params) || params.locale === locale) {
      return null;
    }
    if (!(isStoicKey(key) || key in INSIGHT_TRANSLATIONS.en)) {
      return null;
    }
    return renderInsight(locale, key as InsightMessageKey, params);
  }

  /**
   * Expert cards credit a named author, and those names are already translated
   * for the quote of the day — the same table serves both, so the credit line
   * does not stay English under a card that is otherwise translated. The work
   * keeps its published title, the way the quote banner cites its source.
   */
  private localizeExpert(
    data: Record<string, unknown> | null,
    locale: string,
  ): Record<string, unknown> | null {
    const expert = data?.expert;
    if (typeof expert !== 'string') {
      return data;
    }
    const translated = QUOTE_TEXTS[locale]?.authors[expert];
    return translated && translated !== expert ? { ...data, expert: translated } : data;
  }

  async getSummary(userId: string, workspaceId: string) {
    const now = new Date();
    const queryBuilder = this.insightRepository
      .createQueryBuilder('insight')
      .select('insight.category', 'category')
      .addSelect('COUNT(insight.id)', 'count')
      .where('insight.userId = :userId', { userId })
      .andWhere('insight.isDismissed = false')
      .andWhere('(insight.expiresAt IS NULL OR insight.expiresAt > :now)', { now })
      .groupBy('insight.category');

    queryBuilder.andWhere('insight.workspaceId = :workspaceId', { workspaceId });

    const rows = await queryBuilder.getRawMany<{ category: string; count: string }>();
    const byCategory = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = Number.parseInt(row.count, 10) || 0;
      return acc;
    }, {});

    const total = Object.values(byCategory).reduce((sum, count) => sum + count, 0);
    return {
      total,
      byCategory,
    };
  }

  async dismiss(userId: string, workspaceId: string, id: string) {
    const result = await this.insightRepository.update(
      {
        id,
        userId,
        workspaceId,
        isDismissed: false,
      },
      {
        isDismissed: true,
        dismissedAt: new Date(),
      },
    );

    return {
      updated: result.affected ?? 0,
    };
  }

  async dismissAll(userId: string, workspaceId: string, category?: string) {
    const updateQuery = this.insightRepository
      .createQueryBuilder()
      .update(Insight)
      .set({ isDismissed: true, dismissedAt: () => 'NOW()' })
      .where('user_id = :userId', { userId })
      .andWhere('workspace_id = :workspaceId', { workspaceId })
      .andWhere('is_dismissed = false');

    if (category) {
      updateQuery.andWhere('category = :category', { category });
    }

    const result = await updateQuery.execute();
    return {
      updated: result.affected ?? 0,
    };
  }

  async cleanupExpired() {
    const now = new Date();
    const result = await this.insightRepository.delete({
      expiresAt: LessThan(now),
      isDismissed: false,
    });

    return {
      deleted: result.affected ?? 0,
      checkedAt: now.toISOString(),
    };
  }

  private async resolveLocale(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        locale: true,
      },
    });
    return user?.locale ?? 'en';
  }

  /**
   * Resolves a candidate to the text stored on the row. Candidates are
   * rendered in the recipient's locale, the same way NotificationsService does
   * it; the key and params are kept alongside so the client can re-render the
   * text if the user switches language later.
   */
  private async resolveText(userId: string, candidate: InsightCandidate, locale?: string) {
    const renderLocale = locale ?? (await this.resolveLocale(userId));
    const { title, message } = renderInsight(
      renderLocale,
      candidate.messageKey,
      candidate.messageParams,
    );

    return {
      title,
      message,
      messageKey: candidate.messageKey,
      // The language the stored text is in, so a later refresh in another
      // language knows the text must be written again.
      messageParams: { ...candidate.messageParams, locale: renderLocale },
    };
  }

  /** The latest close of this insight by the person, if it still holds. */
  private async findSnoozed(userId: string, candidate: InsightCandidate): Promise<Insight | null> {
    const dismissed = await this.insightRepository.findOne({
      where: { userId, deduplicationKey: candidate.deduplicationKey, isDismissed: true },
      order: { dismissedAt: { direction: 'DESC', nulls: 'LAST' } },
    });
    return dismissed && isStillSnoozed(dismissed, candidate, new Date()) ? dismissed : null;
  }

  private async upsertCandidate(
    userId: string,
    workspaceId: string,
    candidate: InsightCandidate,
    locale?: string,
  ): Promise<{ created: boolean; insight: Insight }> {
    const text = await this.resolveText(userId, candidate, locale);
    const findActive = () =>
      this.insightRepository.findOne({
        where: {
          userId,
          deduplicationKey: candidate.deduplicationKey,
          isDismissed: false,
        },
      });
    let existing = await findActive();

    if (!existing) {
      // Closed recently, and nothing has grown since: it stays closed.
      const snoozed = await this.findSnoozed(userId, candidate);
      if (snoozed) {
        return { created: false, insight: snoozed };
      }
      const created = this.insightRepository.create({
        userId,
        workspaceId,
        type: candidate.type,
        category: candidate.category,
        severity: candidate.severity,
        title: text.title,
        message: text.message,
        messageKey: text.messageKey,
        messageParams: text.messageParams,
        data: candidate.data ?? null,
        actions: candidate.actions ? candidate.actions.map(action => ({ ...action })) : null,
        deduplicationKey: candidate.deduplicationKey,
        expiresAt: candidate.expiresAt ?? null,
      });

      try {
        const saved = await this.insightRepository.save(created);
        return { created: true, insight: saved };
      } catch (error) {
        // Two refreshes at once (the Advice page asks on open, a tab may ask too):
        // the other one wrote the row first, so this one updates it instead.
        existing = isUniqueViolation(error) ? await findActive() : null;
        if (!existing) {
          throw error;
        }
      }
    }

    existing.workspaceId = workspaceId;
    existing.type = candidate.type;
    existing.category = candidate.category;
    existing.severity = candidate.severity;
    existing.title = text.title;
    existing.message = text.message;
    existing.messageKey = text.messageKey;
    existing.messageParams = text.messageParams;
    existing.data = candidate.data ?? null;
    existing.actions = candidate.actions ? candidate.actions.map(action => ({ ...action })) : null;
    existing.expiresAt = candidate.expiresAt ?? null;
    const saved = await this.insightRepository.save(existing);
    return { created: false, insight: saved };
  }
}

/** Postgres 23505: another insert took the active row's unique slot first. */
const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string; driverError?: { code?: string } })?.code === '23505' ||
  (error as { driverError?: { code?: string } })?.driverError?.code === '23505';

/** How long a closed insight stays away when nothing about it grows. */
export const INSIGHT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const countIn = (data: Record<string, unknown> | null | undefined): number | null =>
  typeof data?.count === 'number' ? data.count : null;

/**
 * Closing an insight means "not now", not "never": it comes back a week after the
 * close, or sooner when the number it counts (unconfirmed rows, duplicates…) grows,
 * so a closed problem cannot be forgotten while it gets worse.
 */
export function isStillSnoozed(
  dismissed: Pick<Insight, 'dismissedAt' | 'data'>,
  candidate: Pick<InsightCandidate, 'data'>,
  now: Date,
): boolean {
  if (
    !dismissed.dismissedAt ||
    now.getTime() - dismissed.dismissedAt.getTime() >= INSIGHT_SNOOZE_MS
  ) {
    return false;
  }
  const before = countIn(dismissed.data);
  const after = countIn(candidate.data);
  return before === null || after === null || after <= before;
}

/** JSON with sorted keys — jsonb does not keep the order the row was written in. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}
