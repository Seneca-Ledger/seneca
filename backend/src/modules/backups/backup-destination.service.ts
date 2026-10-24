import * as path from 'node:path';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { WebDAVClient } from 'webdav';
import { APP_SLUG } from '../../common/brand';
import { decryptText } from '../../common/utils/encryption.util';
import {
  BackupConfiguration,
  BackupDestinationKind,
  Integration,
  IntegrationProvider,
  IntegrationStatus,
} from '../../entities';
import { isBackupFileName } from './backup-archive.service';
import { LocalBackupDestinationService } from './local-backup-destination.service';

@Injectable()
export class BackupDestinationService {
  constructor(
    @Inject('BACKUP_LOCAL_ROOT') private readonly localRoot: string | undefined,
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
  ) {}

  async store(
    configuration: Pick<
      BackupConfiguration,
      'destinationKind' | 'destinationPath' | 'retentionCount' | 'workspaceId'
    >,
    fileName: string,
    contents: Buffer,
  ): Promise<string> {
    if (configuration.destinationKind === BackupDestinationKind.LOCAL) {
      const local = this.localDestination();
      const directory = this.localDirectory(configuration);
      const stored = await local.put(directory, fileName, contents);
      await local.retainNewest(directory, configuration.retentionCount);
      return stored;
    }
    return this.storeNextcloud(configuration, fileName, contents);
  }

  async load(configuration: BackupConfiguration, destinationFile: string): Promise<Buffer> {
    if (configuration.destinationKind === BackupDestinationKind.LOCAL) {
      const local = this.localDestination();
      const [directory, fileName] = destinationFile.split('/');
      if (!(directory && fileName) || destinationFile.split('/').length !== 2) {
        throw new BadRequestException('Invalid local backup reference');
      }
      const paths = await local.list(directory);
      if (!paths.includes(destinationFile)) {
        throw new BadRequestException('Backup file was not found');
      }
      const root = this.localRoot;
      return (await import('node:fs/promises')).readFile(
        path.join(root || '', directory, fileName),
      );
    }
    const { client } = await this.nextcloudClient(configuration.workspaceId);
    const contents = await client.getFileContents(destinationFile, { format: 'binary' });
    return Buffer.isBuffer(contents) ? contents : Buffer.from(contents as ArrayBuffer);
  }

  private async storeNextcloud(
    configuration: Pick<BackupConfiguration, 'destinationPath' | 'retentionCount' | 'workspaceId'>,
    fileName: string,
    contents: Buffer,
  ): Promise<string> {
    const { client, rootPath } = await this.nextcloudClient(configuration.workspaceId);
    const directory = this.remoteDirectory(
      rootPath,
      configuration.destinationPath,
      configuration.workspaceId,
    );
    await client.createDirectory(directory, { recursive: true });
    const destinationFile = `${directory}/${fileName}`;
    const partialFile = `${destinationFile}.partial`;
    await client.putFileContents(partialFile, contents, { overwrite: true });
    await client.moveFile(partialFile, destinationFile, { overwrite: false });
    await this.retainNextcloud(client, directory, configuration.retentionCount);
    return destinationFile;
  }

  private async retainNextcloud(
    client: WebDAVClient,
    directory: string,
    keep: number,
  ): Promise<void> {
    const entries = await client.getDirectoryContents(directory);
    const snapshots = entries
      .filter(entry => entry.type === 'file' && isBackupFileName(entry.filename))
      .sort((a, b) => a.filename.localeCompare(b.filename));
    const stale = snapshots.slice(0, Math.max(0, snapshots.length - keep));
    await Promise.all(stale.map(entry => client.deleteFile(entry.filename)));
  }

  private localDestination(): LocalBackupDestinationService {
    if (!this.localRoot) {
      throw new BadRequestException('BACKUP_LOCAL_ROOT is not configured');
    }
    return new LocalBackupDestinationService(this.localRoot);
  }

  private localDirectory(
    configuration: Pick<BackupConfiguration, 'destinationPath' | 'workspaceId'>,
  ): string {
    const prefix = configuration.destinationPath || `${APP_SLUG}-backups`;
    if (!/^[a-zA-Z0-9_-]+$/.test(prefix)) {
      throw new BadRequestException('Invalid local backup destination');
    }
    return `${prefix}-${configuration.workspaceId}`;
  }

  private async nextcloudClient(
    workspaceId: string,
  ): Promise<{ client: WebDAVClient; rootPath: string }> {
    const integration = await this.integrationRepository.findOne({
      where: { workspaceId, provider: IntegrationProvider.WEBDAV },
      relations: {
        openProtocolSettings: true,
      },
    });
    const settings = integration?.openProtocolSettings;
    if (!integration || integration.status !== IntegrationStatus.CONNECTED || !settings) {
      throw new BadRequestException('Nextcloud WebDAV is not connected');
    }
    const url = this.stringSetting(settings.config.url);
    if (!url) throw new BadRequestException('Nextcloud WebDAV URL is not configured');

    const loadWebdav = new Function('modulePath', 'return import(modulePath)') as (
      modulePath: string,
    ) => Promise<typeof import('webdav')>;
    const { createClient } = await loadWebdav('webdav');
    return {
      client: createClient(url, {
        username: settings.encryptedSecrets.username
          ? decryptText(settings.encryptedSecrets.username)
          : undefined,
        password: settings.encryptedSecrets.password
          ? decryptText(settings.encryptedSecrets.password)
          : undefined,
      }),
      rootPath: this.stringSetting(settings.config.rootPath) || '/',
    };
  }

  private remoteDirectory(rootPath: string, destinationPath: string, workspaceId: string): string {
    const cleanRoot = rootPath.replace(/\/+$/g, '') || '/';
    const cleanDestination = destinationPath || `${APP_SLUG}-backups`;
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanDestination)) {
      throw new BadRequestException('Invalid Nextcloud backup destination');
    }
    return path.posix.join(cleanRoot, cleanDestination, workspaceId);
  }

  private stringSetting(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
