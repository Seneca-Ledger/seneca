import * as crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { APP_SLUG } from '../../common/brand';
import { appError } from '../../common/errors/app-error';
import type { UpdateBackupConfigurationBody } from '../../contracts';
import {
  BackupConfiguration,
  BackupDestinationKind,
  BackupRun,
  BackupRunStatus,
  BackupRunTrigger,
  Workspace,
} from '../../entities';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from '../auth/security-audit.util';
import { BACKUP_FILE_EXTENSION, BackupArchiveService } from './backup-archive.service';
import { BackupDataService } from './backup-data.service';
import { BackupDestinationService } from './backup-destination.service';
import { BackupKeyService } from './backup-key.service';

export type UpdateBackupConfiguration = Omit<UpdateBackupConfigurationBody, 'destinationKind'> & {
  destinationKind: BackupDestinationKind;
};

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    @InjectRepository(BackupConfiguration)
    private readonly configurationRepository: Repository<BackupConfiguration>,
    @InjectRepository(BackupRun)
    private readonly runRepository: Repository<BackupRun>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly archiveService: BackupArchiveService,
    private readonly keyService: BackupKeyService,
    private readonly dataService: BackupDataService,
    private readonly destinationService: BackupDestinationService,
    private readonly auditService: AuditService,
  ) {}

  async getConfiguration(user: User, workspaceId: string) {
    const workspace = await this.requireOwner(user, workspaceId);
    const configuration = await this.configurationRepository.findOne({
      where: { workspaceId: workspace.id },
    });
    return configuration ? this.publicConfiguration(configuration) : null;
  }

  async configure(user: User, workspaceId: string, input: UpdateBackupConfiguration) {
    const workspace = await this.requireOwner(user, workspaceId);
    this.validateConfiguration(input);
    const existing = await this.configurationRepository.findOne({
      where: { workspaceId: workspace.id },
    });
    if (!(existing || input.password)) {
      throw new BadRequestException(appError('BACKUP_PASSWORD_REQUIRED'));
    }

    const configuration =
      existing || this.configurationRepository.create({ workspaceId: workspace.id });
    configuration.destinationKind = input.destinationKind;
    configuration.destinationPath = input.destinationPath || `${APP_SLUG}-backups`;
    configuration.dailyTime = input.dailyTime || existing?.dailyTime || '03:00';
    configuration.timeZone = input.timeZone || existing?.timeZone || 'UTC';
    configuration.retentionCount = input.retentionCount ?? existing?.retentionCount ?? 7;
    configuration.enabled = input.enabled ?? existing?.enabled ?? true;
    configuration.lastSuccessfulAt = existing?.lastSuccessfulAt ?? null;

    if (input.password) {
      const encryption = await this.archiveService.initializeEncryption(input.password);
      configuration.encryptedDataKey = this.keyService.encryptDataKey(encryption.dataKey);
      configuration.passwordEnvelope = encryption.passwordEnvelope;
    } else if (existing) {
      configuration.encryptedDataKey = existing.encryptedDataKey;
      configuration.passwordEnvelope = existing.passwordEnvelope;
    }

    const saved = await this.configurationRepository.save(configuration);
    // Whitelisted settings only; the password and the wrapped keys stay out.
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: workspace.id,
      actorId: user.id,
      entityType: EntityType.BACKUP,
      entityId: saved.id,
      action: AuditAction.UPDATE,
      severity: Severity.INFO,
      meta: {
        destinationKind: saved.destinationKind,
        destinationPath: saved.destinationPath,
        dailyTime: saved.dailyTime,
        timeZone: saved.timeZone,
        retentionCount: saved.retentionCount,
        enabled: saved.enabled,
        passwordChanged: Boolean(input.password),
        firstConfiguration: !existing,
      },
    });
    return this.publicConfiguration(saved);
  }

  async listRuns(user: User, workspaceId: string): Promise<BackupRun[]> {
    const workspace = await this.requireOwner(user, workspaceId);
    return this.runRepository.find({
      where: { workspaceId: workspace.id },
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async createRun(
    user: User,
    workspaceId: string,
    trigger: BackupRunTrigger = BackupRunTrigger.MANUAL,
  ): Promise<BackupRun> {
    const workspace = await this.requireOwner(user, workspaceId);
    const configuration = await this.configurationRepository.findOne({
      where: { workspaceId: workspace.id },
    });
    if (!configuration) {
      throw new BadRequestException(appError('BACKUP_NOT_CONFIGURED'));
    }
    const run = await this.runConfiguration(workspace, configuration, trigger);
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: workspace.id,
      actorId: user.id,
      entityType: EntityType.BACKUP,
      entityId: run.id,
      action: AuditAction.CREATE,
      severity: Severity.INFO,
      meta: { trigger, status: run.status },
    });
    return run;
  }

  async downloadRun(
    user: User,
    workspaceId: string,
    runId: string,
  ): Promise<{ fileName: string; contents: Buffer }> {
    const workspace = await this.requireOwner(user, workspaceId);
    const run = await this.runRepository.findOne({
      where: { id: runId, workspaceId: workspace.id },
    });
    if (!run?.destinationFile || run.status !== BackupRunStatus.SUCCEEDED) {
      throw new NotFoundException(appError('BACKUP_RUN_NOT_FOUND'));
    }
    const configuration = await this.configurationRepository.findOne({
      where: { id: run.configurationId, workspaceId: workspace.id },
    });
    if (!configuration) throw new NotFoundException(appError('BACKUP_CONFIG_NOT_FOUND'));

    return {
      fileName: run.destinationFile.split('/').pop() || `backup${BACKUP_FILE_EXTENSION}`,
      contents: await this.destinationService.load(configuration, run.destinationFile),
    };
  }

  async runConfiguration(
    workspace: Workspace,
    configuration: BackupConfiguration,
    trigger: BackupRunTrigger,
  ): Promise<BackupRun> {
    const run = this.runRepository.create({
      workspaceId: workspace.id,
      configurationId: configuration.id,
      trigger,
      status: BackupRunStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      destinationFile: null,
      payloadSha256: null,
      sizeBytes: null,
      errorMessage: null,
    });
    const savedRun = await this.runRepository.save(run);

    try {
      const snapshot = await this.dataService.collect(workspace.id);
      const collections = {
        workspace: [
          {
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
            icon: workspace.icon,
            color: workspace.color,
            backgroundImage: workspace.backgroundImage,
            currency: workspace.currency,
            settings: workspace.settings,
          },
        ],
        ...snapshot.collections,
      };
      const archive = await this.archiveService.create({
        workspace: { id: workspace.id, name: workspace.name },
        collections,
        files: snapshot.files || [],
        encryption: {
          dataKey: this.keyService.decryptDataKey(configuration.encryptedDataKey),
          passwordEnvelope: configuration.passwordEnvelope,
        },
      });
      const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}${BACKUP_FILE_EXTENSION}`;
      savedRun.destinationFile = await this.destinationService.store(
        configuration,
        fileName,
        archive,
      );
      savedRun.payloadSha256 = crypto.createHash('sha256').update(archive).digest('hex');
      savedRun.sizeBytes = String(archive.length);
      savedRun.status = BackupRunStatus.SUCCEEDED;
      savedRun.finishedAt = new Date();
      configuration.lastSuccessfulAt = savedRun.finishedAt;
      await this.configurationRepository.save(configuration);
      return this.runRepository.save(savedRun);
    } catch (error) {
      savedRun.status = BackupRunStatus.FAILED;
      savedRun.finishedAt = new Date();
      savedRun.errorMessage = error instanceof Error ? error.message : 'Backup failed';
      await this.runRepository.save(savedRun);
      throw error;
    }
  }

  /** Backups are the open workspace's, and only its owner manages them. */
  private async requireOwner(user: User, workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    if (workspace.ownerId !== user.id) {
      throw new ForbiddenException(appError('BACKUP_OWNER_ONLY'));
    }
    return workspace;
  }

  private validateConfiguration(input: UpdateBackupConfiguration): void {
    if (!Object.values(BackupDestinationKind).includes(input.destinationKind)) {
      throw new BadRequestException(appError('BACKUP_DESTINATION_UNSUPPORTED'));
    }
    if (input.dailyTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.dailyTime)) {
      throw new BadRequestException(appError('BACKUP_TIME_INVALID'));
    }
    if (input.timeZone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: input.timeZone });
      } catch {
        throw new BadRequestException(appError('BACKUP_TIME_ZONE_INVALID'));
      }
    }
    if (
      input.retentionCount != null &&
      (!Number.isInteger(input.retentionCount) || input.retentionCount < 1)
    ) {
      throw new BadRequestException(appError('BACKUP_RETENTION_INVALID'));
    }
    if (input.destinationPath && !/^[a-zA-Z0-9_-]+$/.test(input.destinationPath)) {
      throw new BadRequestException(appError('BACKUP_DESTINATION_PATH_INVALID'));
    }
  }

  private publicConfiguration(configuration: BackupConfiguration) {
    return {
      id: configuration.id,
      destinationKind: configuration.destinationKind,
      destinationPath: configuration.destinationPath,
      dailyTime: configuration.dailyTime,
      timeZone: configuration.timeZone,
      retentionCount: configuration.retentionCount,
      enabled: configuration.enabled,
      lastSuccessfulAt: configuration.lastSuccessfulAt,
      passwordConfigured: Boolean(configuration.encryptedDataKey && configuration.passwordEnvelope),
    };
  }
}
