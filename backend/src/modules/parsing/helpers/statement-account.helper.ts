import type { DataSource } from 'typeorm';
import type { Statement } from '../../../entities/statement.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { pickWalletForAccount, realAccountNumber } from '../../wallets/wallet-account-match';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';

type StatementAccount = Pick<Wallet, 'id' | 'ownerMemberId'>;

/**
 * The account the statement's rows belong to: the one it was uploaded to, or
 * else the single active account carrying its account number and currency.
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
    if (account) {
      statement.walletId = account.id;
    }
  }
  if (account) {
    log('info', `Rows go to account ${account.id}`);
  }
  return account;
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
 * A file can print several accounts, but a statement holds one: the first is
 * imported and the rest are named here, so they are not lost without a word.
 */
export function otherAccountsWarnings(parsed: ParsedStatement): string[] {
  const others = parsed.otherAccounts ?? [];
  if (others.length === 0) {
    return [];
  }
  const describe = ({ metadata }: Pick<ParsedStatement, 'metadata'>) =>
    `${metadata.accountNumber || 'unnumbered'} (${metadata.currency})`;
  const skipped = others
    .map(({ metadata, transactions }) => {
      const rows = `${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`;
      return `${describe({ metadata })}, ${rows}`;
    })
    .join('; ');
  return [
    `This file prints ${others.length + 1} accounts; only ${describe(parsed)} was imported. ` +
      `Not imported: ${skipped}.`,
  ];
}
