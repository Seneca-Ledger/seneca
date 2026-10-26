import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, type Repository } from 'typeorm';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import { Statement } from '../../entities';
import { StatementsService } from '../statements/statements.service';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_TRASH_TTL_DAYS = 30;

@Injectable()
export class StorageTrashScheduler {
  private readonly logger = new Logger(StorageTrashScheduler.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly statementsService: StatementsService,
  ) {}

  @Cron('0 3 * * *')
  async purgeExpiredTrash(): Promise<void> {
    const ttlDays = this.getTrashTtlDays();
    if (ttlDays <= 0) {
      return;
    }

    const cutoff = new Date(Date.now() - ttlDays * MS_PER_DAY);
    const expired = await this.statementRepository.find({
      // A past version's trash is part of the copy and stays as it was.
      where: { deletedAt: LessThanOrEqual(cutoff), workspace: STANDARD_WORKSPACE },
      select: {
        id: true,
        userId: true,
        workspaceId: true,
        fileName: true,
        deletedAt: true,
      },
    });

    if (!expired.length) {
      return;
    }

    for (const statement of expired) {
      try {
        await this.statementsService.remove(statement.id, statement.userId, statement.workspaceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to purge trashed file ${statement.id} (${statement.fileName}): ${message}`,
        );
      }
    }
  }

  private getTrashTtlDays(): number {
    const raw = process.env.STORAGE_TRASH_TTL_DAYS;
    const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_TRASH_TTL_DAYS;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_TRASH_TTL_DAYS;
    }
    return parsed;
  }
}
