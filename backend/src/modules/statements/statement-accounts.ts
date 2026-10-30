import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Wallet } from '../../entities';

const logger = new Logger('StatementAccounts');

/**
 * The account an upload was sent to (SimpleFIN mapping, a webhook default, the
 * upload form), kept only when it is one of this workspace's: a mapping left
 * pointing at a deleted account must not fail the upload.
 */
export async function accountOfUpload(
  wallets: Repository<Wallet>,
  walletId: string | undefined,
  workspaceId: string,
): Promise<string | null> {
  if (!walletId) {
    return null;
  }
  const exists = await wallets.exists({ where: { id: walletId, workspaceId } });
  if (!exists) {
    logger.warn(`[Statements] Upload named wallet ${walletId}, not in workspace ${workspaceId}`);
  }
  return exists ? walletId : null;
}

/** Who owns the wallet, or null when it is shared. */
export async function walletOwnerMemberId(
  wallets: Repository<Wallet>,
  walletId: string,
  workspaceId: string,
): Promise<string | null> {
  const wallet = await wallets.findOne({
    where: { id: walletId, workspaceId },
    select: {
      ownerMemberId: true,
    },
  });
  return wallet?.ownerMemberId ?? null;
}
