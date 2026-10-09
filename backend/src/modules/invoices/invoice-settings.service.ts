import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DEFAULT_PAYMENT_TERMS_DAYS,
  DEFAULT_REMINDER_OFFSETS,
  InvoiceSettings,
} from '../../entities/invoice-settings.entity';

export interface InvoiceSettingsView {
  remindersEnabled: boolean;
  reminderOffsets: number[];
  paymentTermsDays: number;
  lateFeePercent: number;
}

export interface InvoiceSettingsInput {
  remindersEnabled?: boolean;
  reminderOffsets?: number[];
  paymentTermsDays?: number;
  lateFeePercent?: number;
}

/** Offsets are days from the due date, de-duplicated, sorted, within a year. */
export function normalizeOffsets(input: unknown): number[] {
  const values = Array.isArray(input) ? input : [];
  const whole = values
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value >= -365 && value <= 365);
  return [...new Set(whole)].sort((left, right) => left - right);
}

/**
 * How a workspace invoices, with the defaults applied.
 *
 * A workspace that has never opened these settings has no row, so every read
 * goes through here rather than through the repository: the defaults are one
 * fact in one place, and "reminders off" is one of them.
 */
@Injectable()
export class InvoiceSettingsService {
  constructor(
    @InjectRepository(InvoiceSettings)
    private readonly settingsRepository: Repository<InvoiceSettings>,
  ) {}

  async get(workspaceId: string): Promise<InvoiceSettingsView> {
    const stored = await this.settingsRepository.findOne({ where: { workspaceId } });
    return {
      remindersEnabled: stored?.remindersEnabled ?? false,
      reminderOffsets: normalizeOffsets(stored?.reminderOffsets ?? [...DEFAULT_REMINDER_OFFSETS]),
      paymentTermsDays: stored?.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS,
      lateFeePercent: Number(stored?.lateFeePercent ?? 0),
    };
  }

  async update(workspaceId: string, input: InvoiceSettingsInput): Promise<InvoiceSettingsView> {
    const current = await this.get(workspaceId);
    const next: InvoiceSettingsView = {
      remindersEnabled: input.remindersEnabled ?? current.remindersEnabled,
      reminderOffsets: input.reminderOffsets
        ? normalizeOffsets(input.reminderOffsets)
        : current.reminderOffsets,
      paymentTermsDays: this.clampTerms(input.paymentTermsDays ?? current.paymentTermsDays),
      lateFeePercent: this.clampPercent(input.lateFeePercent ?? current.lateFeePercent),
    };
    await this.settingsRepository.save(this.settingsRepository.create({ workspaceId, ...next }));
    return next;
  }

  /** The workspace's own rows, for the reminder scheduler to walk. */
  async withRemindersEnabled(): Promise<InvoiceSettings[]> {
    return this.settingsRepository.find({ where: { remindersEnabled: true } });
  }

  private clampTerms(days: number): number {
    const whole = Math.round(Number(days));
    return Number.isFinite(whole) ? Math.min(Math.max(whole, 0), 365) : DEFAULT_PAYMENT_TERMS_DAYS;
  }

  private clampPercent(percent: number): number {
    const value = Number(percent);
    return Number.isFinite(value) ? Math.min(Math.max(Math.round(value * 100) / 100, 0), 100) : 0;
  }
}
