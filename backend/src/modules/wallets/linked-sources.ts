import type { EntityManager } from 'typeorm';
import { Statement } from '../../entities/statement.entity';
import { statementSource } from './wallet-account-match';

export interface LinkedSource {
  walletId: string;
  source: string | null;
  currency: string | null;
}

/** The source of a statement, read from what parsing kept of it. */
export function sourceOfStatement(
  statement: Pick<Statement, 'bankName' | 'parsingDetails'>,
): string | null {
  const metadata = statement.parsingDetails?.metadataExtracted;
  return statementSource(statement.bankName, metadata?.institution, metadata?.normalizedHeader);
}

/**
 * Statements with no account number that already sit in an account, by source:
 * what a new statement of the same export is matched against.
 */
export async function linkedSources(
  manager: EntityManager,
  workspaceId: string,
): Promise<LinkedSource[]> {
  const rows: {
    walletId: string;
    bankName: string | null;
    currency: string | null;
    institution: string | null;
    header: string | null;
  }[] = await manager
    .getRepository(Statement)
    .createQueryBuilder('statement')
    .select('statement.walletId', 'walletId')
    .addSelect('statement.bankName', 'bankName')
    .addSelect('statement.currency', 'currency')
    .addSelect("statement.parsingDetails -> 'metadataExtracted' ->> 'institution'", 'institution')
    .addSelect("statement.parsingDetails -> 'metadataExtracted' ->> 'normalizedHeader'", 'header')
    .where('statement.workspaceId = :workspaceId', { workspaceId })
    .andWhere('statement.walletId IS NOT NULL')
    .andWhere('statement.deletedAt IS NULL')
    .andWhere("(statement.accountNumber IS NULL OR statement.accountNumber IN ('', 'Unknown'))")
    .andWhere("statement.fileName NOT LIKE 'manual-expense-%'")
    .getRawMany();
  return rows.map(row => ({
    walletId: row.walletId,
    source: statementSource(row.bankName, row.institution, row.header),
    currency: row.currency,
  }));
}
