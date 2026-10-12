import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxRateKind } from '../../entities/tax-jurisdiction-rate.entity';
import { TaxRate } from '../../entities/tax-rate.entity';
import { VatStatus, Workspace } from '../../entities/workspace.entity';
import {
  WorkspaceServiceSettings,
  WorkspaceServiceSettingsKey,
} from '../../entities/workspace-service-settings.entity';
import type { OfficialVatRatesChangedEvent } from '../notifications/events/notification-events';
import {
  TEDB_PAGE,
  type TedbSnapshot,
  TedbVatRatesService,
  type TedbVersion,
} from '../reference-data/tedb-vat-rates.service';
import { toDateOnly } from './jurisdictions.service';
import { TaxAssignmentService } from './tax-assignment.service';
import { TaxRatesService } from './tax-rates.service';

export type RateDifferenceKind = 'standard_changed' | 'reduced_missing' | 'reduced_unlisted';

export interface RateDifference {
  /** Stable while the difference lasts; what dismissing and applying refer to. */
  key: string;
  kind: RateDifferenceKind;
  /** The official percentage; NULL for a rate of ours TEDB does not list. */
  official: number | null;
  /** Ours on the day it applies; NULL for a rate we lack. */
  ours: number | null;
  /** From when the official rate applies; NULL when TEDB's range does not show its start. */
  from: string | null;
  /** TEDB's categories for a reduced rate, e.g. FOODSTUFFS. */
  categories: string[];
  /** Whether "apply" can do it: start the new version, or add the missing rate. */
  canApply: boolean;
}

export interface OfficialRatesCheck {
  /** Whether the check means anything here: an EU country, and VAT charged. */
  supported: boolean;
  country: string | null;
  fetchedAt: string | null;
  sourceUrl: string;
  differences: RateDifference[];
  /** Differences the user said to ignore; they can be brought back. */
  dismissed: RateDifference[];
}

interface OfficialRatesState {
  /** Keys already announced in a notification. */
  notified: string[];
  /** Keys the user said to ignore. */
  dismissed: string[];
}

const KEYS_KEPT = 100;
const SINCE_ALWAYS = '1900-01-01';

const same = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** The version in force on `day`; the earliest one when `day` is before all of them. */
function versionOn(versions: TedbVersion[], day: string): TedbVersion | null {
  return [...versions].reverse().find(version => version.from <= day) ?? versions[0] ?? null;
}

/**
 * The first day of the unbroken run of versions ending at `index` in which
 * `holds` is true; NULL when the run reaches back to the first version, since
 * TEDB's range then does not show when it began.
 */
function runStart(versions: TedbVersion[], index: number, holds: (v: TedbVersion) => boolean) {
  let start = index;
  while (start > 0 && holds(versions[start - 1])) {
    start--;
  }
  return start === 0 ? null : versions[start].from;
}

/** Rates of ours in force on `day`. */
function inForce(rates: TaxRate[], day: string): TaxRate[] {
  return rates.filter(
    rate =>
      String(rate.validFrom).slice(0, 10) <= day &&
      (!rate.validTo || String(rate.validTo).slice(0, 10) >= day),
  );
}

/** The official standard rate of version `index`, when none of ours matches it. */
function standardDifference(
  versions: TedbVersion[],
  index: number,
  ours: TaxRate[],
): RateDifference | null {
  const official = versions[index].standard;
  const standards = ours.filter(rate => rate.kind === TaxRateKind.STANDARD);
  if (
    official === null ||
    standards.length === 0 ||
    standards.some(rate => same(Number(rate.rate), official))
  ) {
    return null;
  }
  const from = runStart(versions, index, version => version.standard === official);
  return {
    key: `standard_changed:${official}:${from ?? ''}`,
    kind: 'standard_changed',
    official,
    ours: Number(standards[0].rate),
    from,
    categories: [],
    canApply: from !== null,
  };
}

/** Official reduced rates of version `index` we have no rate for. */
function missingReduced(versions: TedbVersion[], index: number, ours: TaxRate[]): RateDifference[] {
  const reducedOurs = ours.filter(
    rate => rate.kind === TaxRateKind.REDUCED || rate.kind === TaxRateKind.ZERO,
  );
  return versions[index].reduced
    .filter(reduced => !reducedOurs.some(rate => same(Number(rate.rate), reduced.rate)))
    .map(reduced => {
      const from = runStart(versions, index, version =>
        version.reduced.some(item => same(item.rate, reduced.rate)),
      );
      return {
        key: `reduced_missing:${reduced.rate}:${from ?? ''}`,
        kind: 'reduced_missing' as const,
        official: reduced.rate,
        ours: null,
        from,
        categories: reduced.categories,
        canApply: true,
      };
    });
}

/** Reduced rates of ours the member state no longer reports. */
function unlistedReduced(current: TedbVersion, ours: TaxRate[]): RateDifference[] {
  return ours
    .filter(
      rate =>
        rate.kind === TaxRateKind.REDUCED &&
        Number(rate.rate) > 0 &&
        !current.reduced.some(item => same(item.rate, Number(rate.rate))),
    )
    .map(rate => ({
      key: `reduced_unlisted:${Number(rate.rate)}`,
      kind: 'reduced_unlisted' as const,
      official: null,
      ours: Number(rate.rate),
      from: null,
      categories: [],
      canApply: false,
    }));
}

/**
 * Compares a workspace's VAT rates with the ones its member state reports to
 * the European Commission (TEDB), today and for changes already announced.
 * Nothing changes on its own: a difference is shown and announced once, and
 * the user applies it — the new version from its date, or the missing rate —
 * or dismisses it.
 */
@Injectable()
export class OfficialVatRatesService {
  private readonly logger = new Logger(OfficialVatRatesService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(TaxRate)
    private readonly taxRateRepository: Repository<TaxRate>,
    @InjectRepository(WorkspaceServiceSettings)
    private readonly settingsRepository: Repository<WorkspaceServiceSettings>,
    private readonly tedbService: TedbVatRatesService,
    private readonly taxRatesService: TaxRatesService,
    private readonly taxAssignmentService: TaxAssignmentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** The comparison; `refresh` asks TEDB again rather than using the stored answer. */
  async check(
    workspaceId: string,
    options: { refresh?: boolean; today?: string } = {},
  ): Promise<OfficialRatesCheck> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    const jurisdiction = workspace?.taxJurisdiction ?? null;
    const empty: OfficialRatesCheck = {
      supported: false,
      country: jurisdiction?.code ?? null,
      fetchedAt: null,
      sourceUrl: TEDB_PAGE,
      differences: [],
      dismissed: [],
    };
    if (!(workspace && jurisdiction?.isEu && workspace.vatStatus === VatStatus.REGISTERED)) {
      return empty;
    }

    const found = options.refresh
      ? await this.tedbService.snapshot(jurisdiction.code, { force: true })
      : ((await this.tedbService.stored(jurisdiction.code)) ??
        (await this.tedbService.snapshot(jurisdiction.code)));
    if (!found) {
      return { ...empty, supported: true };
    }

    const all = await this.differences(
      workspace,
      found.snapshot,
      options.today ?? toDateOnly(new Date()),
    );
    const state = await this.state(workspaceId);
    const dismissed = new Set(state.dismissed);
    return {
      ...empty,
      supported: true,
      fetchedAt: new Date(found.fetchedAt).toISOString(),
      differences: all.filter(item => !dismissed.has(item.key)),
      dismissed: all.filter(item => dismissed.has(item.key)),
    };
  }

  /** Hides a difference, or shows it again. */
  async dismiss(workspaceId: string, key: string, dismissed: boolean): Promise<void> {
    const state = await this.state(workspaceId);
    const keys = new Set(state.dismissed);
    if (dismissed) {
      keys.add(key);
    } else {
      keys.delete(key);
    }
    await this.saveState(workspaceId, { ...state, dismissed: [...keys].slice(-KEYS_KEPT) });
  }

  /**
   * Does what a difference asks: a new version of the standard rate (and of
   * its reverse-charge twin) from the official date, after which unfiled rows
   * from that date are assessed again; or the missing reduced rate. A rate
   * TEDB does not list is not removed here — that is the user's call.
   */
  async apply(workspaceId: string, key: string, userId?: string): Promise<OfficialRatesCheck> {
    const check = await this.check(workspaceId);
    const difference = check.differences.find(item => item.key === key);
    if (!difference) {
      throw new NotFoundException('This difference is no longer there');
    }
    if (!(difference.canApply && difference.official !== null)) {
      throw new BadRequestException('This difference cannot be applied automatically');
    }
    const workspace = await this.workspaceRepository.findOneOrFail({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    const jurisdiction = workspace.taxJurisdiction;
    if (!jurisdiction) {
      throw new BadRequestException('The workspace has no tax country');
    }

    if (difference.kind === 'standard_changed' && difference.from) {
      const from = difference.from;
      const standards = (await this.ratesOf(workspace)).filter(
        rate =>
          rate.kind === TaxRateKind.STANDARD &&
          String(rate.validFrom).slice(0, 10) < from &&
          (!rate.validTo || String(rate.validTo).slice(0, 10) >= from),
      );
      if (standards.length === 0) {
        throw new BadRequestException('No standard rate is in force on that date');
      }
      for (const rate of standards) {
        await this.taxRatesService.startNewVersion(
          workspaceId,
          rate.id,
          difference.official,
          from,
          userId,
        );
      }
      await this.taxAssignmentService.reassess(workspaceId, { from });
    } else if (difference.kind === 'reduced_missing') {
      const percent = difference.official;
      await this.taxRatesService.addStatutoryRate(
        workspaceId,
        {
          jurisdictionId: jurisdiction.id,
          code: `${jurisdiction.code}_REDUCED_${String(percent).replace('.', '_')}`,
          name: `${jurisdiction.taxName} ${percent}%`,
          kind: TaxRateKind.REDUCED,
          rate: percent,
          validFrom: difference.from ?? SINCE_ALWAYS,
        },
        userId,
      );
    }
    return this.check(workspaceId);
  }

  /**
   * Asks TEDB again for every EU country a VAT-registered workspace files in,
   * and tells each workspace once about a difference it has not heard of.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async checkAll(): Promise<void> {
    const workspaces = await this.workspaceRepository.find({
      where: { vatStatus: VatStatus.REGISTERED },
      relations: { taxJurisdiction: true },
      select: { id: true, vatStatus: true, taxJurisdiction: { id: true, code: true, isEu: true } },
    });
    const refreshed = new Set<string>();
    for (const workspace of workspaces) {
      const code = workspace.taxJurisdiction?.code;
      if (!(code && workspace.taxJurisdiction?.isEu)) {
        continue;
      }
      try {
        const result = await this.check(workspace.id, { refresh: !refreshed.has(code) });
        refreshed.add(code);
        await this.announce(workspace.id, result);
      } catch (error) {
        // One workspace failing must not cost every other one its check.
        this.logger.error(
          `Official VAT rate check failed for workspace ${workspace.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async announce(workspaceId: string, result: OfficialRatesCheck): Promise<void> {
    const state = await this.state(workspaceId);
    const notified = new Set(state.notified);
    const fresh = result.differences.filter(item => !notified.has(item.key));
    if (fresh.length === 0 || !result.country) {
      return;
    }
    this.eventEmitter.emit('tax.rates.official_changed', {
      workspaceId,
      country: result.country,
      count: fresh.length,
    } satisfies OfficialVatRatesChangedEvent);
    for (const item of fresh) {
      notified.add(item.key);
    }
    await this.saveState(workspaceId, { ...state, notified: [...notified].slice(-KEYS_KEPT) });
  }

  private async ratesOf(workspace: Workspace): Promise<TaxRate[]> {
    if (!workspace.taxJurisdictionId) {
      return [];
    }
    return this.taxRateRepository.find({
      where: { workspaceId: workspace.id, jurisdictionId: workspace.taxJurisdictionId },
    });
  }

  private async differences(
    workspace: Workspace,
    snapshot: TedbSnapshot,
    today: string,
  ): Promise<RateDifference[]> {
    const versions = snapshot.versions;
    const current = versionOn(versions, today);
    if (!current) {
      return [];
    }
    const rates = (await this.ratesOf(workspace)).filter(rate => !rate.isReverseCharge);

    const differences = new Map<string, RateDifference>();
    const add = (item: RateDifference) => {
      const known = differences.get(item.key);
      differences.set(item.key, {
        ...item,
        categories: [...new Set([...(known?.categories ?? []), ...item.categories])],
      });
    };
    // Today's version and every one announced after it.
    for (let index = versions.indexOf(current); index < versions.length; index++) {
      const version = versions[index];
      const ours = inForce(rates, version.from > today ? version.from : today);
      const standard = standardDifference(versions, index, ours);
      if (standard) {
        add(standard);
      }
      missingReduced(versions, index, ours).forEach(add);
    }
    unlistedReduced(current, inForce(rates, today)).forEach(add);
    return [...differences.values()];
  }

  private async state(workspaceId: string): Promise<OfficialRatesState> {
    const row = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.OFFICIAL_RATES },
    });
    const config = (row?.config ?? {}) as Partial<OfficialRatesState>;
    return { notified: config.notified ?? [], dismissed: config.dismissed ?? [] };
  }

  private async saveState(workspaceId: string, state: OfficialRatesState): Promise<void> {
    const row = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.OFFICIAL_RATES },
    });
    await this.settingsRepository.save({
      ...(row ?? {}),
      workspaceId,
      key: WorkspaceServiceSettingsKey.OFFICIAL_RATES,
      config: { ...state },
    });
  }
}
