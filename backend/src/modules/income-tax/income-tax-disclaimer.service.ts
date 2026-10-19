import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { IncomeTaxDisclaimerAcceptance } from '../../entities/income-tax-disclaimer-acceptance.entity';

/**
 * Revision of the tax-declaration disclaimer.
 *
 * Bump it whenever the wording changes what the user agrees to — most
 * importantly that accuracy depends on daily use and disciplined tracking of
 * every income and expense. The text itself lives in the client bundle so it
 * can be shown in the user's language.
 */
export const CURRENT_TAX_DISCLAIMER_VERSION = '2026-09-13';

export interface TaxDisclaimerStatus {
  version: string;
  accepted: boolean;
  acceptedAt: Date | null;
}

@Injectable()
export class IncomeTaxDisclaimerService {
  constructor(
    @InjectRepository(IncomeTaxDisclaimerAcceptance)
    private readonly acceptanceRepository: Repository<IncomeTaxDisclaimerAcceptance>,
  ) {}

  async getStatus(userId: string): Promise<TaxDisclaimerStatus> {
    const acceptance = await this.acceptanceRepository.findOne({
      where: { userId, version: CURRENT_TAX_DISCLAIMER_VERSION },
    });
    return {
      version: CURRENT_TAX_DISCLAIMER_VERSION,
      accepted: acceptance !== null,
      acceptedAt: acceptance?.acceptedAt ?? null,
    };
  }

  /**
   * Idempotent: accepting the same revision again keeps the first timestamp,
   * which is the moment consent was actually given.
   */
  async accept(userId: string): Promise<TaxDisclaimerStatus> {
    await this.acceptanceRepository
      .createQueryBuilder()
      .insert()
      .into(IncomeTaxDisclaimerAcceptance)
      .values({ userId, version: CURRENT_TAX_DISCLAIMER_VERSION })
      .orIgnore()
      .execute();
    return this.getStatus(userId);
  }

  /** Finalizing or exporting a draft without the current acknowledgement is refused. */
  async assertAccepted(userId: string): Promise<void> {
    const { accepted } = await this.getStatus(userId);
    if (!accepted) {
      throw new ForbiddenException({
        code: 'TAX_DISCLAIMER_REQUIRED',
        message: 'Accept the current tax-declaration disclaimer first.',
      });
    }
  }
}
