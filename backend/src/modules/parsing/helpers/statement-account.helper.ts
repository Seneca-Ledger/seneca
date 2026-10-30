import type { DataSource } from 'typeorm';
import type { Statement } from '../../../entities/statement.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { linkedSources, sourceOfStatement } from '../../wallets/linked-sources';
import {
  pickWalletBySource,
  pickWalletForAccount,
  realAccountNumber,
} from '../../wallets/wallet-account-match';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';

type StatementAccount = Pick<Wallet, 'id' | 'ownerMemberId'>;

/**
 * The account the statement's rows belong to: the one it was uploaded to, or
 * else the single active account carrying its account number and currency,
 * or, with no number, the one earlier statements of the same source went to.
 * Found once, the match is kept on the statement.
 */
export async function accountOfStatement(
  dataSource: DataSource,
  statement: Statement,
  log: (level: string, message: string) => void,
): Promise<StatementAccount | null> {
  const wallets = dataSource.getRepository(Wallet);
  let account: StatementAccount | null = null;
  if (statement.walletId) {
    account = await wallets.findOne({
      where: { id: statement.walletId, workspaceId: statement.workspaceId },
      select: { id: true, ownerMemberId: true },
    });
  } else if (realAccountNumber(statement.accountNumber)) {
    account = pickWalletForAccount(
      await wallets.find({ where: { workspaceId: statement.workspaceId, isActive: true } }),
      statement.accountNumber,
      statement.currency,
    );
  } else {
    account = await accountOfSource(dataSource, statement);
  }
  if (account && !statement.walletId) {
    statement.walletId = account.id;
  }
  if (account) {
    log('info', `Rows go to account ${account.id}`);
  }
  return account;
}

/** With no account number: the account earlier statements of the same source went to. */
async function accountOfSource(
  dataSource: DataSource,
  statement: Statement,
): Promise<Wallet | null> {
  const source = sourceOfStatement(statement);
  if (!source) {
    return null;
  }
  const linked = await linkedSources(dataSource.manager, statement.workspaceId);
  if (linked.length === 0) {
    return null;
  }
  const wallets = await dataSource
    .getRepository(Wallet)
    .find({ where: { workspaceId: statement.workspaceId, isActive: true } });
  return pickWalletBySource(wallets, linked, source, statement.currency);
}

/**
 * A statement is of one account, so its rows are too; a rule may still name the
 * person (`ruleOwner` set, even to null), otherwise the row starts on the
 * account's owner.
 */
export function accountFields(
  account: StatementAccount | null,
  ruleOwner: string | null | undefined,
): { walletId?: string; ownerMemberId?: string | null } {
  if (!account) {
    return {};
  }
  return {
    walletId: account.id,
    ownerMemberId: ruleOwner !== undefined ? ruleOwner : account.ownerMemberId,
  };
}

/**
 * Narrows a parse to the one account this statement holds. A file can print
 * several: the upload holds the first and lists the others in its parsing
 * details, and each other account is a statement of its own that knows its
 * place among the file's accounts. An account no longer found in the file
 * leaves the statement without rows, which validation then reports.
 */
export function takeStatementAccount(
  parsed: ParsedStatement,
  statement: Pick<Statement, 'sourceAccountIndex'>,
  details: NonNullable<Statement['parsingDetails']>,
): void {
  const accounts = [parsed, ...(parsed.otherAccounts ?? [])];
  const index = statement.sourceAccountIndex ?? 0;
  const own = accounts[index];
  parsed.otherAccounts = undefined;
  if (index > 0) {
    parsed.metadata = own?.metadata ?? parsed.metadata;
    parsed.transactions = own?.transactions ?? [];
    parsed.checks = own?.checks;
    return;
  }
  if (accounts.length > 1) {
    details.otherAccounts = accounts.slice(1).map(({ metadata, transactions }, offset) => ({
      index: offset + 1,
      accountNumber: metadata.accountNumber,
      currency: metadata.currency,
      transactions: transactions.length,
    }));
  }
}
