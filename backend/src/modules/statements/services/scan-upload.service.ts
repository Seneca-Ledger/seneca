import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import type { CaptureLocation } from '../../../common/utils/capture-location.util';
import {
  assertReceiptFileSupported,
  unlinkAll,
  validateFiles,
} from '../../../common/utils/file-validator.util';
import { Statement } from '../../../entities/statement.entity';
import type { User } from '../../../entities/user.entity';
import { isBankStatementScan } from '../../parsing/helpers/scan-statement.helper';
import { ParserFactoryService } from '../../parsing/services/parser-factory.service';
import { StatementsService } from '../statements.service';
import { ReceiptStatementService } from './receipt-statement.service';

/**
 * The scan is the one place files come in. A bank statement among them is
 * parsed for every transaction it lists; anything else is read as a receipt
 * or an invoice. Results come back in the order the files were sent.
 */
@Injectable()
export class ScanUploadService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly statementsService: StatementsService,
    private readonly receiptStatementService: ReceiptStatementService,
    private readonly parserFactory: ParserFactoryService,
  ) {}

  async upload(params: {
    user: User;
    workspaceId: string;
    files: Express.Multer.File[];
    language?: string;
    captureLocation?: CaptureLocation;
  }): Promise<Statement[]> {
    const { files } = params;
    let isStatement: boolean[];
    try {
      isStatement = await Promise.all(
        files.map(file => isBankStatementScan(file, this.parserFactory)),
      );
      for (const [index, file] of files.entries()) {
        if (isStatement[index]) {
          await validateFiles([file]);
        } else {
          assertReceiptFileSupported(file);
        }
      }
    } catch (error) {
      await unlinkAll(files);
      throw error;
    }

    const results: Statement[] = [];
    for (const [index, file] of files.entries()) {
      if (isStatement[index]) {
        results.push(await this.uploadStatement(params.user, params.workspaceId, file));
      } else {
        results.push(
          ...(await this.receiptStatementService.createFromReceiptScan({
            ...params,
            files: [file],
          })),
        );
      }
    }
    return results;
  }

  /**
   * The same statement again is the one already filed, as for receipts: the
   * scan hands it back instead of refusing the upload. A trashed copy does not
   * count, so a statement deleted from the list can be uploaded again.
   */
  private async uploadStatement(
    user: User,
    workspaceId: string,
    file: Express.Multer.File,
  ): Promise<Statement> {
    try {
      return await this.statementsService.create(user, workspaceId, file);
    } catch (error) {
      const duplicateId = duplicateStatementIdOf(error);
      const duplicate = duplicateId
        ? await this.statementRepository.findOne({ where: { id: duplicateId, workspaceId } })
        : null;
      if (!duplicate) {
        throw error;
      }
      const filed = duplicate.deletedAt
        ? await this.statementRepository.findOne({
            where: { workspaceId, fileHash: duplicate.fileHash, deletedAt: IsNull() },
          })
        : duplicate;
      if (!filed) {
        return this.statementsService.create(user, workspaceId, file, undefined, undefined, true);
      }
      await unlinkAll([file]);
      return filed;
    }
  }
}

function duplicateStatementIdOf(error: unknown): string | null {
  if (!(error instanceof ConflictException)) {
    return null;
  }
  const response = error.getResponse();
  const id =
    typeof response === 'object' && response !== null && 'duplicateStatementId' in response
      ? response.duplicateStatementId
      : null;
  return typeof id === 'string' ? id : null;
}
