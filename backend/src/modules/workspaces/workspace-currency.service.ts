import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { Workspace } from '../../entities/workspace.entity';

/**
 * The one place that answers "what currency does this workspace work in".
 *
 * Seven services used to keep their own copy of this lookup, each ending in the
 * same hardcoded fallback; now they share this one, so a workspace cannot show
 * one currency on the dashboard and store another on a transaction.
 */
@Injectable()
export class WorkspaceCurrencyService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  async resolve(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['currency'],
    });
    return currencyCodeOrDefault(workspace?.currency);
  }

  /**
   * The currency an amount should be stored in: its own, when it has one, and
   * the workspace's otherwise. Saves callers an unused query when the amount
   * already carries a code.
   */
  async resolveFor(workspaceId: string, currency: string | null | undefined): Promise<string> {
    const given = currencyCodeOrDefault(currency, '');
    return given || this.resolve(workspaceId);
  }
}
