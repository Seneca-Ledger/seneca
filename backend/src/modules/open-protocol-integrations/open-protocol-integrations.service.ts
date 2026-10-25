import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { Repository } from 'typeorm';
import { Like } from 'typeorm';
import type { FileStat, WebDAVClient } from 'webdav';
import { FileStorageService } from '../../common/services/file-storage.service';
import {
  assertPublicEgressHost,
  assertPublicEgressUrl,
  createPublicEgressHttpAgents,
} from '../../common/utils/egress-url.util';
import { decryptText, encryptText } from '../../common/utils/encryption.util';
import { validateFile } from '../../common/utils/file-validator.util';
import { normalizeFilename } from '../../common/utils/filename.util';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import {
  ActorType,
  AuditAction,
  EntityType,
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  OpenProtocolSettings,
  Receipt,
  ReceiptSource,
  ReceiptStatus,
  Statement,
  User,
} from '../../entities';
import { AuditService } from '../audit/audit.service';
import { sniffStatementFormat } from '../parsing/parsers/statement-formats.util';
import { EmailReceiptParserService } from '../receipts/services/email-receipt-parser.service';
import { ReceiptCategoryService } from '../receipts/services/receipt-category.service';
import { ReceiptDuplicateService } from '../receipts/services/receipt-duplicate.service';
import { StatementsService } from '../statements/statements.service';

type ProtocolStatusResponse = {
  connected: boolean;
  status: IntegrationStatus;
  settings: Record<string, string | number | boolean | null>;
  scopes: string[];
};

type ProtocolFile = {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  modifiedAt: string | null;
};

type ImportResult = {
  fileId: string;
  status: 'ok' | 'error';
  message?: string;
};

type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
  autoBackup: boolean;
};

type WebdavConfig = {
  url: string;
  rootPath: string;
  username?: string;
  password?: string;
};

type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  mailbox: string;
  user: string;
  pass: string;
};

type S3SettingsInput = {
  endpoint?: string;
  region?: string;
  bucket?: string;
  prefix?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  autoBackup?: boolean;
};

type WebdavSettingsInput = {
  url?: string;
  rootPath?: string;
  username?: string;
  password?: string;
};

type ImapSettingsInput = {
  host?: string;
  port?: number;
  secure?: boolean;
  mailbox?: string;
  user?: string;
  pass?: string;
};

@Injectable()
export class OpenProtocolIntegrationsService {
  private readonly logger = new Logger(OpenProtocolIntegrationsService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(OpenProtocolSettings)
    private readonly openProtocolSettingsRepository: Repository<OpenProtocolSettings>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    private readonly statementsService: StatementsService,
    private readonly fileStorageService: FileStorageService,
    private readonly receiptParserService: EmailReceiptParserService,
    private readonly receiptDuplicateService: ReceiptDuplicateService,
    private readonly receiptCategoryService: ReceiptCategoryService,
    private readonly auditService: AuditService,
  ) {}

  async s3Status(workspaceId: string): Promise<ProtocolStatusResponse> {
    const { integration, settings } = await this.findProtocolIntegration(
      workspaceId,
      IntegrationProvider.S3_COMPATIBLE,
    );
    const config = settings
      ? this.getS3ConfigFromSettings(settings)
      : this.getS3ConfigFromEnv(false);

    return this.buildStatus(Boolean(config?.endpoint && config.bucket), {
      endpoint: config?.endpoint ?? null,
      region: config?.region ?? null,
      bucket: config?.bucket ?? null,
      prefix: config?.prefix ?? null,
      forcePathStyle: config?.forcePathStyle ?? true,
      accessKeyConfigured: Boolean(config?.accessKeyId),
      secretKeyConfigured: Boolean(config?.secretAccessKey),
      source: settings ? 'user' : config ? 'env' : null,
      integrationStatus: integration?.status ?? null,
    });
  }

  async saveS3Settings(
    user: User,
    workspaceId: string,
    input: S3SettingsInput,
  ): Promise<ProtocolStatusResponse> {
    const existing = await this.findProtocolIntegration(
      workspaceId,
      IntegrationProvider.S3_COMPATIBLE,
    );
    const config = this.mergeS3Config(existing.settings, input);
    await assertPublicEgressUrl(config.endpoint);
    await this.assertS3Connection(config);
    await this.saveProtocolSettings(user, workspaceId, IntegrationProvider.S3_COMPATIBLE, {
      config: this.publicS3Config(config),
      secrets: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    return this.s3Status(workspaceId);
  }

  async webdavStatus(workspaceId: string): Promise<ProtocolStatusResponse> {
    const { integration, settings } = await this.findProtocolIntegration(
      workspaceId,
      IntegrationProvider.WEBDAV,
    );
    const config = settings
      ? this.getWebdavConfigFromSettings(settings)
      : this.getWebdavConfigFromEnv(false);

    return this.buildStatus(Boolean(config?.url), {
      url: config?.url ?? null,
      rootPath: config?.rootPath ?? null,
      usernameConfigured: Boolean(config?.username),
      passwordConfigured: Boolean(config?.password),
      source: settings ? 'user' : config ? 'env' : null,
      integrationStatus: integration?.status ?? null,
    });
  }

  async saveWebdavSettings(
    user: User,
    workspaceId: string,
    input: WebdavSettingsInput,
  ): Promise<ProtocolStatusResponse> {
    const existing = await this.findProtocolIntegration(workspaceId, IntegrationProvider.WEBDAV);
    const config = this.mergeWebdavConfig(existing.settings, input);
    await assertPublicEgressUrl(config.url);
    await this.assertWebdavConnection(config);
    await this.saveProtocolSettings(user, workspaceId, IntegrationProvider.WEBDAV, {
      config: {
        url: config.url,
        rootPath: config.rootPath,
      },
      secrets: {
        username: config.username,
        password: config.password,
      },
    });
    return this.webdavStatus(workspaceId);
  }

  async imapStatus(workspaceId: string): Promise<ProtocolStatusResponse> {
    const { integration, settings } = await this.findProtocolIntegration(
      workspaceId,
      IntegrationProvider.IMAP,
    );
    const config = settings
      ? this.getImapConfigFromSettings(settings)
      : this.getImapConfigFromEnv(false);

    return this.buildStatus(Boolean(config?.host && config.user), {
      host: config?.host ?? null,
      port: config?.port ?? 993,
      secure: config?.secure ?? true,
      mailbox: config?.mailbox ?? 'INBOX',
      usernameConfigured: Boolean(config?.user),
      passwordConfigured: Boolean(config?.pass),
      source: settings ? 'user' : config ? 'env' : null,
      integrationStatus: integration?.status ?? null,
    });
  }

  async saveImapSettings(
    user: User,
    workspaceId: string,
    input: ImapSettingsInput,
  ): Promise<ProtocolStatusResponse> {
    const existing = await this.findProtocolIntegration(workspaceId, IntegrationProvider.IMAP);
    const config = this.mergeImapConfig(existing.settings, input);
    await assertPublicEgressHost(config.host);
    await this.assertImapConnection(config);
    await this.saveProtocolSettings(user, workspaceId, IntegrationProvider.IMAP, {
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        mailbox: config.mailbox,
      },
      secrets: {
        user: config.user,
        pass: config.pass,
      },
    });
    return this.imapStatus(workspaceId);
  }

  async listImapFolders(input: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  }): Promise<string[]> {
    await assertPublicEgressHost(input.host);
    const { lookup } = createPublicEgressHttpAgents();
    const client = new ImapFlow({
      host: input.host,
      port: input.port,
      secure: input.secure,
      auth: { user: input.user, pass: input.pass },
      tls: { lookup, rejectUnauthorized: true },
      logger: false,
    });
    await client.connect();
    try {
      const list = await client.list();
      return list.map((m: { path: string }) => m.path);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  async disconnect(workspaceId: string, provider: IntegrationProvider): Promise<{ ok: true }> {
    const { integration } = await this.findProtocolIntegration(workspaceId, provider);
    if (integration) {
      integration.status = IntegrationStatus.DISCONNECTED;
      await this.integrationRepository.save(integration);
    }
    return { ok: true };
  }

  async listS3Files(workspaceId: string): Promise<{ files: ProtocolFile[] }> {
    const { client, config } = await this.createS3Client(workspaceId);
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: config.prefix || undefined,
        MaxKeys: Number(process.env.S3_LIST_LIMIT ?? 100),
      }),
    );

    const files = (response.Contents || [])
      .filter(item => item.Key && !item.Key.endsWith('/'))
      .map(item => ({
        id: item.Key || '',
        name: path.posix.basename(item.Key || ''),
        path: item.Key || '',
        size: item.Size || 0,
        mimeType: this.getMimeType(item.Key || ''),
        modifiedAt: item.LastModified?.toISOString() ?? null,
      }));

    return { files };
  }

  async importS3Files(
    user: User,
    workspaceId: string,
    fileIds: string[],
  ): Promise<{ ok: true; results: ImportResult[] }> {
    const { client, config } = await this.createS3Client(workspaceId);
    const results: ImportResult[] = [];

    for (const key of fileIds) {
      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        const buffer = await this.bodyToBuffer(response.Body);
        await this.importStatementFile(user, workspaceId, {
          id: key,
          originalName: path.posix.basename(key),
          mimeType: response.ContentType || this.getMimeType(key),
          contents: buffer,
        });
        results.push({ fileId: key, status: 'ok' });
      } catch (error) {
        results.push({ fileId: key, status: 'error', message: this.getErrorMessage(error) });
      }
    }

    return { ok: true, results };
  }

  async syncS3(user: User, workspaceId: string): Promise<{ ok: true; uploaded: number }> {
    const { client, config } = await this.createS3Client(workspaceId);
    const statements = await this.getSyncStatements(workspaceId);
    let uploaded = 0;

    for (const statement of statements) {
      try {
        const file = await this.fileStorageService.getStatementFileStream(statement);
        const buffer = await this.streamToBuffer(file.stream);
        const key = this.joinRemotePath(config.prefix, file.fileName);
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: buffer,
            ContentType: file.mimeType,
            ContentDisposition: buildContentDisposition('attachment', file.fileName),
          }),
        );
        uploaded += 1;
      } catch (error) {
        this.logger.warn(
          `S3 sync skipped statement ${statement.id}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    await this.auditProtocolSync(user, workspaceId, IntegrationProvider.S3_COMPATIBLE, uploaded);
    return { ok: true, uploaded };
  }

  async autoBackupStatementToS3(workspaceId: string, statementId: string): Promise<void> {
    const integration = await this.integrationRepository.findOne({
      where: { workspaceId, provider: IntegrationProvider.S3_COMPATIBLE },
      relations: {
        openProtocolSettings: true,
      },
    });
    if (!integration?.openProtocolSettings) {
      return;
    }
    const config = this.getS3ConfigFromSettings(integration.openProtocolSettings);
    if (!config.autoBackup) {
      return;
    }
    await assertPublicEgressUrl(config.endpoint);
    const statement = await this.statementRepository.findOne({ where: { id: statementId } });
    if (!statement) {
      return;
    }
    const { client } = this.createS3ClientFromConfig(config);
    const file = await this.fileStorageService.getStatementFileStream(statement);
    const buffer = await this.streamToBuffer(file.stream);
    const key = this.joinRemotePath(config.prefix, file.fileName);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: file.mimeType,
        ContentDisposition: buildContentDisposition('attachment', file.fileName),
      }),
    );
  }

  async listWebdavFiles(workspaceId: string): Promise<{ files: ProtocolFile[] }> {
    const { client, config } = await this.createWebdavClient(workspaceId);
    const contents = await client.getDirectoryContents(config.rootPath);
    const entries = Array.isArray(contents) ? contents : [contents];

    return {
      files: entries
        .filter((entry): entry is FileStat => Boolean(entry) && entry.type === 'file')
        .map(entry => ({
          id: entry.filename,
          name: path.posix.basename(entry.filename),
          path: entry.filename,
          size: entry.size || 0,
          mimeType: this.getMimeType(entry.filename),
          modifiedAt: entry.lastmod ? new Date(entry.lastmod).toISOString() : null,
        })),
    };
  }

  async importWebdavFiles(
    user: User,
    workspaceId: string,
    fileIds: string[],
  ): Promise<{ ok: true; results: ImportResult[] }> {
    const { client } = await this.createWebdavClient(workspaceId);
    const results: ImportResult[] = [];

    for (const filePath of fileIds) {
      try {
        const contents = await client.getFileContents(filePath, { format: 'binary' });
        const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents as ArrayBuffer);
        await this.importStatementFile(user, workspaceId, {
          id: filePath,
          originalName: path.posix.basename(filePath),
          mimeType: this.getMimeType(filePath),
          contents: buffer,
        });
        results.push({ fileId: filePath, status: 'ok' });
      } catch (error) {
        results.push({ fileId: filePath, status: 'error', message: this.getErrorMessage(error) });
      }
    }

    return { ok: true, results };
  }

  async syncWebdav(user: User, workspaceId: string): Promise<{ ok: true; uploaded: number }> {
    const { client, config } = await this.createWebdavClient(workspaceId);
    const statements = await this.getSyncStatements(workspaceId);
    let uploaded = 0;

    for (const statement of statements) {
      try {
        const file = await this.fileStorageService.getStatementFileStream(statement);
        const buffer = await this.streamToBuffer(file.stream);
        await client.putFileContents(this.joinRemotePath(config.rootPath, file.fileName), buffer, {
          overwrite: false,
        });
        uploaded += 1;
      } catch (error) {
        this.logger.warn(
          `WebDAV sync skipped statement ${statement.id}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    await this.auditProtocolSync(user, workspaceId, IntegrationProvider.WEBDAV, uploaded);
    return { ok: true, uploaded };
  }

  async syncImap(
    user: User,
    workspaceId: string,
  ): Promise<{ ok: true; scanned: number; imported: number }> {
    const config = await this.getImapConfig(workspaceId);
    const { lookup } = createPublicEgressHttpAgents();
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: { lookup, rejectUnauthorized: true },
      logger: false,
    });

    let scanned = 0;
    let imported = 0;

    try {
      await client.connect();
      await client.mailboxOpen(config.mailbox);
      const searchResult = await client.search({});
      const uids = Array.isArray(searchResult) ? searchResult : [];
      const limitedUids = uids.slice(0, Number(process.env.IMAP_SYNC_LIMIT ?? 50));

      for (const uid of limitedUids) {
        scanned += 1;
        try {
          const message = await client.fetchOne(
            uid,
            { source: true, envelope: true, flags: true },
            { uid: true },
          );
          if (!message) {
            continue;
          }
          const source = message.source;
          if (!source) {
            continue;
          }

          const parsed = await simpleParser(source);
          const receiptId = await this.importImapMessage(user, workspaceId, uid, parsed, config);
          if (receiptId) {
            imported += 1;
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          }
        } catch (msgError) {
          const e = msgError as Record<string, unknown>;
          this.logger.warn(
            `IMAP: failed to process uid ${uid}: ${String(e.message)} | responseStatus: ${String(e.responseStatus)} | response: ${JSON.stringify(e.response)}`,
          );
        }
      }
    } finally {
      await client.logout().catch(() => undefined);
    }

    return { ok: true, scanned, imported };
  }

  private async importImapMessage(
    user: User,
    workspaceId: string,
    uid: number,
    parsed: Awaited<ReturnType<typeof simpleParser>>,
    config: ImapConfig,
  ): Promise<string | null> {
    const messageId = parsed.messageId || `uid-${uid}`;
    const syntheticId = `imap:${config.host}:${config.mailbox}:${messageId}`;
    // Per workspace: the same inbox may be set up in several workspaces.
    const existing = await this.receiptRepository.findOne({
      where: { workspaceId, messageId: syntheticId },
    });
    if (existing) {
      return null;
    }

    // A forwarded bank export goes to statement import, not to the receipt pile.
    const statementAttachment = parsed.attachments.find(attachment =>
      isStatementAttachment(attachment.filename, attachment.content),
    );
    if (statementAttachment) {
      return this.importStatementAttachment(user, workspaceId, syntheticId, statementAttachment);
    }

    const attachments = parsed.attachments.map(attachment => ({
      id: randomUUID(),
      filename: attachment.filename || 'attachment',
      mimeType: attachment.contentType || 'application/octet-stream',
      size: attachment.size || attachment.content.length,
    }));
    const attachmentPaths = await this.saveReceiptAttachments(parsed.attachments);
    const bodyText = parsed.html?.toString() || parsed.text || null;

    let parsedData = null;
    let status = ReceiptStatus.NEEDS_REVIEW;
    if (attachmentPaths[0]) {
      parsedData = await this.receiptParserService.parseReceipt(attachmentPaths[0], {
        sender: parsed.from?.text,
        subject: parsed.subject,
        dateHeader: parsed.date?.toISOString(),
        emailBody: bodyText,
      });
    } else if (bodyText) {
      parsedData = await this.receiptParserService.parseFromEmailOnly({
        sender: parsed.from?.text,
        subject: parsed.subject,
        dateHeader: parsed.date?.toISOString(),
        emailBody: bodyText,
      });
    }

    if (parsedData?.amount !== undefined && Number.isFinite(Number(parsedData.amount))) {
      status = ReceiptStatus.PARSED;
    }

    const receipt = await this.receiptRepository.save(
      this.receiptRepository.create({
        userId: user.id,
        workspaceId,
        source: ReceiptSource.IMAP,
        messageId: syntheticId,
        subject: parsed.subject || '(no subject)',
        sender: parsed.from?.text || '',
        receivedAt: parsed.date || new Date(),
        status,
        metadata: {
          attachments,
          labels: ['imap'],
          snippet: parsed.text?.slice(0, 500),
        },
        // Saving turns the omitted column into null, as before.
        parsedData: parsedData ?? undefined,
        attachmentPaths,
        taxAmount: parsedData?.tax || null,
        isDuplicate: false,
      }),
    );

    if (parsedData && receipt.status === ReceiptStatus.PARSED) {
      const duplicates = await this.receiptDuplicateService.findPotentialDuplicates(receipt);
      if (duplicates.length > 0) {
        receipt.metadata = {
          ...receipt.metadata,
          potentialDuplicates: duplicates.map(duplicate => duplicate.id),
        };
        receipt.status = ReceiptStatus.NEEDS_REVIEW;
      } else {
        receipt.status = ReceiptStatus.DRAFT;
      }
    }

    if (parsedData && receipt.status !== ReceiptStatus.FAILED) {
      await this.receiptCategoryService.categorize(receipt);
    }

    const saved = await this.receiptRepository.save(receipt);
    await this.auditReceiptImport(user, workspaceId, saved);
    return saved.id;
  }

  /**
   * Writes the attachment where uploads live and runs it through the same
   * path as a file dropped on the statements page. Returns the statement id,
   * which marks the message as handled; the inbox id travels in the file name.
   */
  private async importStatementAttachment(
    user: User,
    workspaceId: string,
    syntheticId: string,
    attachment: Awaited<ReturnType<typeof simpleParser>>['attachments'][number],
  ): Promise<string | null> {
    const existing = await this.statementRepository.findOne({
      where: { workspaceId, fileName: Like(`%${syntheticId.slice(-24)}%`) },
      select: {
        id: true,
      },
    });
    if (existing) {
      return null;
    }
    const originalName = normalizeFilename(attachment.filename || `statement-${randomUUID()}`);
    const extension = path.extname(originalName) || '.bin';
    const filePath = path.join(resolveUploadsDir(), `${randomUUID()}${extension}`);
    await fs.promises.writeFile(filePath, attachment.content);
    const file = {
      fieldname: 'files',
      originalname: `${path.basename(originalName, extension)}-${syntheticId.slice(-24)}${extension}`,
      encoding: '7bit',
      mimetype: attachment.contentType || 'application/octet-stream',
      size: attachment.content.length,
      destination: resolveUploadsDir(),
      filename: path.basename(filePath),
      path: filePath,
      buffer: attachment.content,
    } as Express.Multer.File;
    try {
      const statement = await this.statementsService.create(user, workspaceId, file);
      return statement.id;
    } catch (error) {
      this.logger.warn(`IMAP: statement attachment skipped: ${this.getErrorMessage(error)}`);
      await fs.promises.unlink(filePath).catch(() => undefined);
      return null;
    }
  }

  private async saveReceiptAttachments(
    attachments: Awaited<ReturnType<typeof simpleParser>>['attachments'],
  ): Promise<string[]> {
    const receiptsDir = path.join(resolveUploadsDir(), 'receipts');
    await fs.promises.mkdir(receiptsDir, { recursive: true });

    const paths: string[] = [];
    for (const attachment of attachments) {
      const safeName = normalizeFilename(attachment.filename || `imap-${randomUUID()}`);
      const filePath = path.join(receiptsDir, `${Date.now()}-${randomUUID()}-${safeName}`);
      await fs.promises.writeFile(filePath, attachment.content);
      paths.push(filePath);
    }
    return paths;
  }

  private async importStatementFile(
    user: User,
    workspaceId: string,
    file: { id: string; originalName: string; mimeType: string; contents: Buffer },
  ) {
    const uploadsDir = resolveUploadsDir();
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const safeBaseName = path.basename(normalizeFilename(file.originalName));
    const fileName = `${Date.now()}-${randomUUID()}-${safeBaseName}`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.promises.writeFile(filePath, file.contents);

    const upload: Express.Multer.File = {
      fieldname: 'file',
      originalname: safeBaseName,
      encoding: '7bit',
      mimetype: file.mimeType,
      size: file.contents.length,
      destination: uploadsDir,
      filename: fileName,
      path: filePath,
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    validateFile(upload);
    return this.statementsService.create(user, workspaceId, upload);
  }

  private async getSyncStatements(workspaceId: string): Promise<Statement[]> {
    return this.statementRepository
      .createQueryBuilder('statement')
      .where('statement.deletedAt IS NULL')
      .andWhere('statement.workspaceId = :workspaceId', { workspaceId })
      .orderBy('statement.createdAt', 'ASC')
      .getMany();
  }

  private buildStatus(
    connected: boolean,
    settings: ProtocolStatusResponse['settings'],
  ): ProtocolStatusResponse {
    return {
      connected,
      status: connected ? IntegrationStatus.CONNECTED : IntegrationStatus.DISCONNECTED,
      settings,
      scopes: [],
    };
  }

  private createS3ClientFromConfig(config: S3Config): { client: S3Client } {
    const { httpAgent, httpsAgent } = createPublicEgressHttpAgents();
    return {
      client: new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        requestHandler: new NodeHttpHandler({ httpAgent, httpsAgent }),
        credentials:
          config.accessKeyId && config.secretAccessKey
            ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
            : undefined,
      }),
    };
  }

  private async createS3Client(
    workspaceId: string,
  ): Promise<{ client: S3Client; config: S3Config }> {
    const config = await this.getS3Config(workspaceId);
    return { config, ...this.createS3ClientFromConfig(config) };
  }

  private async getS3Config(workspaceId: string): Promise<S3Config> {
    const { settings } = await this.findProtocolIntegration(
      workspaceId,
      IntegrationProvider.S3_COMPATIBLE,
    );
    if (settings) {
      const config = this.getS3ConfigFromSettings(settings);
      await assertPublicEgressUrl(config.endpoint);
      return config;
    }
    const config = this.getS3ConfigFromEnv(true);
    if (!config) {
      throw new BadRequestException('S3-compatible storage is not configured');
    }
    return config;
  }

  private getS3ConfigFromEnv(required: true): S3Config;
  private getS3ConfigFromEnv(required: false): S3Config | null;
  private getS3ConfigFromEnv(required: boolean): S3Config | null {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    if (!(endpoint && bucket)) {
      if (required) {
        throw new BadRequestException('S3-compatible storage is not configured');
      }
      return null;
    }
    return {
      endpoint,
      bucket,
      region: process.env.S3_REGION || 'us-east-1',
      prefix: process.env.S3_PREFIX || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      autoBackup: false,
    };
  }

  private getS3ConfigFromSettings(settings: OpenProtocolSettings): S3Config {
    const config = settings.config || {};
    const secrets = settings.encryptedSecrets || {};
    const endpoint = this.stringValue(config.endpoint);
    const bucket = this.stringValue(config.bucket);
    if (!(endpoint && bucket)) {
      throw new BadRequestException('S3-compatible storage is not configured');
    }
    return {
      endpoint,
      bucket,
      region: this.stringValue(config.region) || 'us-east-1',
      prefix: this.stringValue(config.prefix) || '',
      accessKeyId: secrets.accessKeyId ? decryptText(secrets.accessKeyId) : undefined,
      secretAccessKey: secrets.secretAccessKey ? decryptText(secrets.secretAccessKey) : undefined,
      forcePathStyle: config.forcePathStyle !== false,
      autoBackup: config.autoBackup === true,
    };
  }

  private async createWebdavClient(
    workspaceId: string,
  ): Promise<{ client: WebDAVClient; config: WebdavConfig }> {
    const config = await this.getWebdavConfig(workspaceId);
    return this.createWebdavClientFromConfig(config);
  }

  private async getWebdavConfig(workspaceId: string): Promise<WebdavConfig> {
    const { settings } = await this.findProtocolIntegration(
      workspaceId,
      IntegrationProvider.WEBDAV,
    );
    if (settings) {
      const config = this.getWebdavConfigFromSettings(settings);
      await assertPublicEgressUrl(config.url);
      return config;
    }
    const config = this.getWebdavConfigFromEnv(true);
    if (!config) {
      throw new BadRequestException('WebDAV storage is not configured');
    }
    return config;
  }

  private getWebdavConfigFromEnv(required: true): WebdavConfig;
  private getWebdavConfigFromEnv(required: false): WebdavConfig | null;
  private getWebdavConfigFromEnv(required: boolean): WebdavConfig | null {
    const url = process.env.WEBDAV_URL;
    if (!url) {
      if (required) {
        throw new BadRequestException('WebDAV storage is not configured');
      }
      return null;
    }
    return {
      url,
      rootPath: process.env.WEBDAV_ROOT_PATH || '/',
      username: process.env.WEBDAV_USERNAME,
      password: process.env.WEBDAV_PASSWORD,
    };
  }

  private getWebdavConfigFromSettings(settings: OpenProtocolSettings): WebdavConfig {
    const config = settings.config || {};
    const secrets = settings.encryptedSecrets || {};
    const url = this.stringValue(config.url);
    if (!url) {
      throw new BadRequestException('WebDAV storage is not configured');
    }
    return {
      url,
      rootPath: this.stringValue(config.rootPath) || '/',
      username: secrets.username ? decryptText(secrets.username) : undefined,
      password: secrets.password ? decryptText(secrets.password) : undefined,
    };
  }

  private async getImapConfig(workspaceId: string): Promise<ImapConfig> {
    const { settings } = await this.findProtocolIntegration(workspaceId, IntegrationProvider.IMAP);
    if (settings) {
      const config = this.getImapConfigFromSettings(settings);
      await assertPublicEgressHost(config.host);
      return config;
    }
    const config = this.getImapConfigFromEnv(true);
    if (!config) {
      throw new BadRequestException('IMAP inbox is not configured');
    }
    return config;
  }

  private getImapConfigFromEnv(required: true): ImapConfig;
  private getImapConfigFromEnv(required: false): ImapConfig | null;
  private getImapConfigFromEnv(required: boolean): ImapConfig | null {
    const host = process.env.IMAP_HOST;
    const user = process.env.IMAP_USER;
    const pass = process.env.IMAP_PASS;
    if (!(host && user && pass)) {
      if (required) {
        throw new BadRequestException('IMAP inbox is not configured');
      }
      return null;
    }
    return {
      host,
      user,
      pass,
      port: Number(process.env.IMAP_PORT ?? 993),
      secure: process.env.IMAP_SECURE !== 'false',
      mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    };
  }

  private getImapConfigFromSettings(settings: OpenProtocolSettings): ImapConfig {
    const config = settings.config || {};
    const secrets = settings.encryptedSecrets || {};
    const host = this.stringValue(config.host);
    const user = secrets.user ? decryptText(secrets.user) : '';
    const pass = secrets.pass ? decryptText(secrets.pass) : '';
    if (!(host && user && pass)) {
      throw new BadRequestException('IMAP inbox is not configured');
    }
    return {
      host,
      user,
      pass,
      port: Number(config.port ?? 993),
      secure: config.secure !== false,
      mailbox: this.stringValue(config.mailbox) || 'INBOX',
    };
  }

  /**
   * The integration of the workspace open in the request. It used to be the
   * user's registration workspace, so settings saved while another workspace
   * was open, and everything imported through them, landed there.
   */
  private async findProtocolIntegration(workspaceId: string, provider: IntegrationProvider) {
    const integration = await this.integrationRepository.findOne({
      where: { workspaceId, provider },
      relations: {
        openProtocolSettings: true,
      },
    });

    return {
      integration,
      settings: integration?.openProtocolSettings || null,
    };
  }

  private async saveProtocolSettings(
    user: User,
    workspaceId: string,
    provider: IntegrationProvider,
    payload: {
      config: Record<string, unknown>;
      secrets: Record<string, string | undefined>;
    },
  ): Promise<OpenProtocolSettings> {
    const existing = await this.findProtocolIntegration(workspaceId, provider);
    const integration =
      existing.integration ||
      this.integrationRepository.create({
        workspaceId,
        provider,
        status: IntegrationStatus.CONNECTED,
        scopes: [],
        connectedByUserId: user.id,
      });

    integration.status = IntegrationStatus.CONNECTED;
    integration.connectedByUserId = user.id;
    const savedIntegration = await this.integrationRepository.save(integration);

    const previousSettings = existing.settings;
    const encryptedSecrets = { ...(previousSettings?.encryptedSecrets || {}) };
    for (const [key, value] of Object.entries(payload.secrets)) {
      if (value !== undefined && value !== '') {
        encryptedSecrets[key] = encryptText(value);
      }
    }

    const settings =
      previousSettings ||
      this.openProtocolSettingsRepository.create({
        integrationId: savedIntegration.id,
        lastSyncAt: null,
      });
    settings.config = payload.config;
    settings.encryptedSecrets = encryptedSecrets;
    return this.openProtocolSettingsRepository.save(settings);
  }

  private mergeS3Config(settings: OpenProtocolSettings | null, input: S3SettingsInput): S3Config {
    const current = settings
      ? this.getS3ConfigFromSettings(settings)
      : this.getS3ConfigFromEnv(false);
    const endpoint = input.endpoint?.trim() || current?.endpoint;
    const bucket = input.bucket?.trim() || current?.bucket;
    if (!(endpoint && bucket)) {
      throw new BadRequestException('S3 endpoint and bucket are required');
    }
    return {
      endpoint,
      bucket,
      region: input.region?.trim() || current?.region || 'us-east-1',
      prefix: input.prefix?.trim() ?? current?.prefix ?? '',
      accessKeyId: input.accessKeyId?.trim() || current?.accessKeyId,
      secretAccessKey: input.secretAccessKey?.trim() || current?.secretAccessKey,
      forcePathStyle: input.forcePathStyle ?? current?.forcePathStyle ?? true,
      autoBackup: input.autoBackup ?? current?.autoBackup ?? false,
    };
  }

  private publicS3Config(config: S3Config): Record<string, unknown> {
    return {
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      prefix: config.prefix,
      forcePathStyle: config.forcePathStyle,
      autoBackup: config.autoBackup,
    };
  }

  private mergeWebdavConfig(
    settings: OpenProtocolSettings | null,
    input: WebdavSettingsInput,
  ): WebdavConfig {
    const current = settings
      ? this.getWebdavConfigFromSettings(settings)
      : this.getWebdavConfigFromEnv(false);
    const url = input.url?.trim() || current?.url;
    if (!url) {
      throw new BadRequestException('WebDAV URL is required');
    }
    return {
      url,
      rootPath: input.rootPath?.trim() || current?.rootPath || '/',
      username: input.username?.trim() || current?.username,
      password: input.password || current?.password,
    };
  }

  private mergeImapConfig(
    settings: OpenProtocolSettings | null,
    input: ImapSettingsInput,
  ): ImapConfig {
    const current = settings
      ? this.getImapConfigFromSettings(settings)
      : this.getImapConfigFromEnv(false);
    const host = input.host?.trim() || current?.host;
    const user = input.user?.trim() || current?.user;
    const pass = input.pass || current?.pass;
    if (!(host && user && pass)) {
      throw new BadRequestException('IMAP host, user, and password are required');
    }
    return {
      host,
      user,
      pass,
      port: Number(input.port ?? current?.port ?? 993),
      secure: input.secure ?? current?.secure ?? true,
      mailbox: input.mailbox?.trim() || current?.mailbox || 'INBOX',
    };
  }

  private async assertS3Connection(config: S3Config): Promise<void> {
    // The same pinned-lookup agents as the runtime client: the endpoint was just
    // checked, and the probe must not connect wherever it resolves next (DNS rebinding).
    const { httpAgent, httpsAgent } = createPublicEgressHttpAgents();
    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      requestHandler: new NodeHttpHandler({ httpAgent, httpsAgent }),
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    } catch (error) {
      throw new BadRequestException(
        `Failed to connect S3-compatible storage: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async assertWebdavConnection(config: WebdavConfig): Promise<void> {
    try {
      const { client } = await this.createWebdavClientFromConfig(config);
      await client.getDirectoryContents(config.rootPath);
    } catch (error) {
      throw new BadRequestException(
        `Failed to connect WebDAV storage: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async createWebdavClientFromConfig(
    config: WebdavConfig,
  ): Promise<{ client: WebDAVClient; config: WebdavConfig }> {
    const loadWebdav = new Function('modulePath', 'return import(modulePath)') as (
      modulePath: string,
    ) => Promise<typeof import('webdav')>;
    const { createClient } = await loadWebdav('webdav');
    const { httpAgent, httpsAgent } = createPublicEgressHttpAgents();
    return {
      config,
      client: createClient(config.url, {
        username: config.username,
        password: config.password,
        httpAgent,
        httpsAgent,
      }),
    };
  }

  private async assertImapConnection(config: ImapConfig): Promise<void> {
    const { lookup } = createPublicEgressHttpAgents();
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: { lookup, rejectUnauthorized: true },
      logger: false,
    });
    try {
      await client.connect();
      await client.mailboxOpen(config.mailbox);
    } catch (error) {
      throw new BadRequestException(`Failed to connect IMAP inbox: ${this.getErrorMessage(error)}`);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.csv':
        return 'text/csv';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.ods':
        return 'application/vnd.oasis.opendocument.spreadsheet';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream';
    }
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private async bodyToBuffer(body: unknown): Promise<Buffer> {
    if (!body) {
      return Buffer.alloc(0);
    }

    const transformable = body as { transformToByteArray?: () => Promise<Uint8Array> };
    if (typeof transformable.transformToByteArray === 'function') {
      return Buffer.from(await transformable.transformToByteArray());
    }

    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private joinRemotePath(prefix: string, fileName: string): string {
    const safeName = path.posix.basename(fileName);
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
    return normalizedPrefix ? `${normalizedPrefix}/${safeName}` : safeName;
  }

  private async auditProtocolSync(
    user: User,
    workspaceId: string,
    provider: IntegrationProvider,
    uploaded: number,
  ): Promise<void> {
    try {
      const { integration } = await this.findProtocolIntegration(workspaceId, provider);
      // Storage configured from the environment has no integration row to log against.
      if (!integration) {
        return;
      }
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.INTEGRATION,
        actorId: user.id,
        actorLabel: `${provider} Sync`,
        entityType: EntityType.INTEGRATION,
        entityId: integration.id,
        action: AuditAction.EXPORT,
        meta: { provider, uploaded },
      });
    } catch (error) {
      this.logger.warn(`Audit event failed: ${this.getErrorMessage(error)}`);
    }
  }

  private async auditReceiptImport(
    user: User,
    workspaceId: string,
    receipt: Receipt,
  ): Promise<void> {
    await this.auditService
      .createEvent({
        workspaceId,
        actorType: ActorType.INTEGRATION,
        actorId: user.id,
        actorLabel: 'IMAP Import',
        entityType: EntityType.RECEIPT,
        entityId: receipt.id,
        action: AuditAction.IMPORT,
        diff: { before: null, after: receipt },
        meta: {
          provider: IntegrationProvider.IMAP,
          messageId: receipt.messageId,
        },
      })
      .catch(error => this.logger.warn(`Audit event failed: ${this.getErrorMessage(error)}`));
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

const STATEMENT_EXTENSIONS = new Set([
  '.csv',
  '.xlsx',
  '.xls',
  '.ofx',
  '.qfx',
  '.qif',
  '.mt940',
  '.sta',
  '.940',
  '.swi',
  '.xml',
]);

/** Bank exports by extension; an .xml only when it is camt, PDFs stay receipts. */
function isStatementAttachment(filename: string | undefined, content: Buffer): boolean {
  const extension = path.extname(filename || '').toLowerCase();
  if (!STATEMENT_EXTENSIONS.has(extension)) return false;
  if (extension === '.xml') {
    return sniffStatementFormat(content.subarray(0, 8192).toString('utf-8')) === 'camt';
  }
  return true;
}
