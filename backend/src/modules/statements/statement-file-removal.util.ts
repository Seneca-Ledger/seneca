import type { Logger } from '@nestjs/common';
import * as fs from 'fs';
import { Not, type Repository } from 'typeorm';
import type { Statement } from '../../entities/statement.entity';

/**
 * Deletes a statement's file from disk unless another statement still reads
 * it: every account of a file that prints several is a statement of its own
 * on the same file. A failure is logged; the statement goes either way.
 */
export async function removeStatementFile(
  statements: Repository<Statement>,
  statement: Pick<Statement, 'id' | 'workspaceId' | 'filePath'>,
  logger: Logger,
): Promise<void> {
  const sharedWith = await statements.count({
    where: {
      workspaceId: statement.workspaceId,
      filePath: statement.filePath,
      id: Not(statement.id),
    },
  });
  if (sharedWith > 0 || !fs.existsSync(statement.filePath)) {
    return;
  }
  try {
    fs.unlinkSync(statement.filePath);
  } catch (error) {
    logger.error(`Failed to delete file ${statement.filePath}:`, error);
  }
}
