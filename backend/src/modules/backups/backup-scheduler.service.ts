import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import { BackupConfiguration, BackupRunTrigger, Workspace } from '../../entities';
import { BackupsService } from './backups.service';

@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private readonly claimedSlots = new Set<string>();

  constructor(
    @InjectRepository(BackupConfiguration)
    private readonly configurationRepository: Repository<BackupConfiguration>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly backupsService: BackupsService,
  ) {}

  @Cron('* * * * *')
  async scheduledTick(): Promise<void> {
    await this.runDueBackups(new Date());
  }

  async runDueBackups(now: Date): Promise<void> {
    // A past version runs nothing on its own: its copied backup settings stay inert.
    const configurations = await this.configurationRepository.find({
      where: { workspace: STANDARD_WORKSPACE },
    });
    for (const configuration of configurations) {
      if (!configuration.enabled) continue;
      const localSlot = this.localSlot(now, configuration.timeZone);
      if (`${localSlot.hour}:${localSlot.minute}` !== configuration.dailyTime) continue;

      const slotKey = `${configuration.id}:${localSlot.date}:${configuration.dailyTime}`;
      if (this.claimedSlots.has(slotKey)) continue;
      this.claimedSlots.add(slotKey);

      try {
        const workspace = await this.workspaceRepository.findOne({
          where: { id: configuration.workspaceId },
        });
        if (workspace) {
          await this.backupsService.runConfiguration(
            workspace,
            configuration,
            BackupRunTrigger.SCHEDULED,
          );
        }
      } catch (error) {
        this.logger.error(
          `Scheduled backup failed for workspace ${configuration.workspaceId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private localSlot(now: Date, timeZone: string): { date: string; hour: string; minute: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(part => part.type === type)?.value || '';
    return {
      date: `${value('year')}-${value('month')}-${value('day')}`,
      hour: value('hour'),
      minute: value('minute'),
    };
  }
}
