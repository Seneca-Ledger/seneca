import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Statement, StatementStatus } from '../../../entities/statement.entity';
import { StatementParsingQueue } from '../queue/statement-parsing.queue';

/**
 * Imports the other accounts of a file that prints several. Parsing the upload
 * keeps its first account and lists the rest in its parsing details; each of
 * those becomes a statement of its own on the same file, which parsing then
 * narrows to that account.
 */
@Injectable()
export class StatementSiblingsService {
  constructor(
    @InjectRepository(Statement)
    private readonly statements: Repository<Statement>,
    private readonly parsingQueue: StatementParsingQueue,
  ) {}

  /**
   * Creates and queues a statement for every listed account that has none
   * yet, so reprocessing the upload does not duplicate them. A statement that
   * is itself one of those accounts lists none.
   */
  async importOtherAccounts(uploadId: string): Promise<Statement[]> {
    const upload = await this.statements.findOne({ where: { id: uploadId } });
    const others = upload?.parsingDetails?.otherAccounts ?? [];
    if (!upload || upload.sourceStatementId || others.length === 0) {
      return [];
    }

    const existing = await this.statements.find({
      where: { workspaceId: upload.workspaceId, sourceStatementId: upload.id },
      select: { id: true, sourceAccountIndex: true },
    });
    const imported = new Set(existing.map(statement => statement.sourceAccountIndex));

    const created: Statement[] = [];
    for (const account of others.filter(other => !imported.has(other.index))) {
      const statement = await this.statements.save(
        this.statements.create({
          userId: upload.userId,
          workspaceId: upload.workspaceId,
          folderId: upload.folderId,
          fileName: upload.fileName,
          filePath: upload.filePath,
          fileType: upload.fileType,
          fileSize: upload.fileSize,
          fileHash: upload.fileHash,
          bankName: upload.bankName,
          stage: upload.stage,
          status: StatementStatus.UPLOADED,
          accountNumber: account.accountNumber || null,
          currency: account.currency,
          // The upload's chosen account holds its first account only; this
          // one is matched by its own number and currency.
          walletId: null,
          sourceStatementId: upload.id,
          sourceAccountIndex: account.index,
        }),
      );
      await this.parsingQueue.enqueue(statement.id);
      created.push(statement);
    }
    return created;
  }
}
