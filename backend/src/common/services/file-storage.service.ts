import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import type { Repository } from 'typeorm';
import { FileType, Statement } from '../../entities';
import { calculateFileHash } from '../utils/file-hash.util';
import { resolveUploadsDir } from '../utils/uploads.util';

export type FileAvailabilityStatus = 'both' | 'disk' | 'db' | 'missing';

export type FileAvailability = {
  onDisk: boolean;
  inDb: boolean;
  status: FileAvailabilityStatus;
};

const uploadBaseDir = resolveUploadsDir();

const extractUploadsSuffix = (rawPath: string): string | null => {
  const normalized = rawPath.replace(/\\/g, '/');
  const marker = '/uploads/';
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) {
    return null;
  }
  const suffix = normalized.slice(idx + marker.length);
  return suffix ? suffix : null;
};

const isRegularFile = (filePath: string): boolean => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

@Injectable()
export class FileStorageService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
  ) {}

  resolveFilePath(rawPath: string | null | undefined): string | null {
    if (!rawPath) {
      return null;
    }

    const cwd = process.cwd();
    const basename = path.basename(rawPath);
    const uploadsSuffix = extractUploadsSuffix(rawPath);

    const candidates = [
      rawPath,
      path.resolve(rawPath),
      path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath),
      path.join(cwd, 'dist', rawPath),
      path.join(cwd, '..', rawPath),
      path.join(uploadBaseDir, basename),
      path.join(uploadBaseDir, rawPath),
      uploadsSuffix ? path.join(uploadBaseDir, uploadsSuffix) : null,
      path.join(cwd, 'uploads', basename),
      path.join(cwd, 'uploads', rawPath),
      uploadsSuffix ? path.join(cwd, 'uploads', uploadsSuffix) : null,
      path.join(__dirname, '../../..', 'uploads', basename), // dist/common/services -> dist/uploads
      path.join(__dirname, '../../../uploads', basename), // dist/common/services -> backend/uploads
      path.join(path.dirname(rawPath), basename),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (isRegularFile(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  isOnDisk(rawPath: string | null | undefined): boolean {
    return Boolean(this.resolveFilePath(rawPath));
  }

  getMimeType(fileType: FileType | string): string {
    const type = (fileType || '').toString().toLowerCase();
    switch (type) {
      case FileType.PDF:
      case 'pdf':
        return 'application/pdf';
      case FileType.XLSX:
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls':
        return 'application/vnd.ms-excel';
      case FileType.CSV:
      case 'csv':
        return 'text/csv';
      case FileType.DOCX:
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case FileType.OFX:
      case FileType.QIF:
      case FileType.MT940:
        return 'text/plain';
      case FileType.CAMT:
        return 'application/xml';
      case FileType.IMAGE:
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return 'application/octet-stream';
    }
  }

  buildAvailability(onDisk: boolean, inDb: boolean): FileAvailability {
    const status: FileAvailabilityStatus =
      onDisk && inDb ? 'both' : onDisk ? 'disk' : inDb ? 'db' : 'missing';
    return { onDisk, inDb, status };
  }

  async getFileAvailability(
    statement: Pick<Statement, 'id' | 'filePath'>,
  ): Promise<FileAvailability> {
    const onDisk = this.isOnDisk(statement.filePath);
    const inDb = await this.hasFileData(statement.id);
    return this.buildAvailability(onDisk, inDb);
  }

  async getStatementsWithFileData(statementIds: string[]): Promise<Set<string>> {
    if (!statementIds.length) {
      return new Set();
    }

    const rows = await this.statementRepository
      .createQueryBuilder('statement')
      .select('statement.id', 'id')
      .where('statement.id IN (:...ids)', { ids: statementIds })
      .andWhere('statement.fileData IS NOT NULL')
      .getRawMany<{ id: string }>();

    return new Set(rows.map(row => row.id));
  }

  async hasFileData(statementId: string): Promise<boolean> {
    const row = await this.statementRepository
      .createQueryBuilder('statement')
      .select('statement.id', 'id')
      .where('statement.id = :id', { id: statementId })
      .andWhere('statement.fileData IS NOT NULL')
      .getRawOne<{ id: string }>();

    return Boolean(row?.id);
  }

  private async getFileData(statementId: string): Promise<Buffer | null> {
    const withData = await this.statementRepository
      .createQueryBuilder('statement')
      .addSelect('statement.fileData')
      .where('statement.id = :id', { id: statementId })
      .getOne();

    return withData?.fileData ?? null;
  }

  private async getFileDataByHash(params: {
    userId: string;
    fileHash: string;
    excludeStatementId?: string;
  }): Promise<Buffer | null> {
    const qb = this.statementRepository
      .createQueryBuilder('statement')
      .addSelect('statement.fileData')
      .where('statement.userId = :userId', { userId: params.userId })
      .andWhere('statement.fileHash = :fileHash', { fileHash: params.fileHash })
      .andWhere('statement.fileData IS NOT NULL')
      .orderBy('statement.createdAt', 'DESC');

    if (params.excludeStatementId) {
      qb.andWhere('statement.id <> :excludeId', {
        excludeId: params.excludeStatementId,
      });
    }

    const other = await qb.getOne();
    return other?.fileData ?? null;
  }

  async getStatementFileStream(
    statement: Pick<Statement, 'id' | 'fileName' | 'filePath' | 'fileType' | 'fileHash' | 'userId'>,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
    source: 'disk' | 'db' | 'restored';
  }> {
    const tryFromDisk = async () => {
      const resolved = this.resolveFilePath(statement.filePath);
      if (!resolved) {
        return null;
      }

      if (statement.fileHash) {
        try {
          const hash = await calculateFileHash(resolved);
          if (hash !== statement.fileHash) {
            return null;
          }
        } catch {
          return null;
        }
      }

      return {
        stream: fs.createReadStream(resolved),
        fileName: statement.fileName,
        mimeType: this.getMimeType(statement.fileType),
        source: 'disk' as const,
      };
    };

    const disk = await tryFromDisk();
    if (disk) {
      return disk;
    }

    const restored = await this.restoreFile(statement);
    if (restored) {
      return restored;
    }

    throw new NotFoundException('File content is unavailable');
  }

  /**
   * Restore file to disk from DB (or another statement with same hash).
   */
  async restoreFile(
    statement: Pick<Statement, 'id' | 'fileName' | 'filePath' | 'fileType' | 'fileHash' | 'userId'>,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
    source: 'db' | 'restored';
  } | null> {
    let fileData = await this.getFileData(statement.id);

    if (!fileData && statement.fileHash && statement.userId) {
      fileData = await this.getFileDataByHash({
        userId: statement.userId,
        fileHash: statement.fileHash,
        excludeStatementId: statement.id,
      });
    }

    if (!fileData) {
      return null;
    }

    const targetPath =
      this.resolveFilePath(statement.filePath) ||
      path.join(uploadBaseDir, path.basename(statement.filePath || statement.fileName));

    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, fileData);
      return {
        stream: fs.createReadStream(targetPath),
        fileName: statement.fileName,
        mimeType: this.getMimeType(statement.fileType),
        source: 'restored',
      };
    } catch {
      return {
        stream: Readable.from(fileData),
        fileName: statement.fileName,
        mimeType: this.getMimeType(statement.fileType),
        source: 'db',
      };
    }
  }
}
