import { BadRequestException, NotFoundException } from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import { Wallet } from '../../../entities/wallet.entity';
import { normalizeCurrencyCode } from '../../exchange-rates/currency-converter';
import { linkedSources } from '../../wallets/linked-sources';
import { pickWalletBySource } from '../../wallets/wallet-account-match';
import type { ImportContext } from './target.types';

type ImportAccount = Pick<Wallet, 'id' | 'ownerMemberId'>;

/** The header row as one string, the way the CSV parser keeps it for a statement. */
export function importHeader(headers: readonly string[]): string | undefined {
  const text = headers
    .map(header => header.trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
  return text || undefined;
}

/**
 * The account an imported sheet's rows belong to: the one the person chose,
 * which must hold the sheet's currency, or else the one earlier imports with
 * the same header row went to.
 */
export async function accountOfImport(
  ctx: ImportContext,
  currency: string,
  source: string | null,
): Promise<ImportAccount | null> {
  if (ctx.walletId) {
    const wallet = await ctx.manager.getRepository(Wallet).findOne({
      where: { id: ctx.walletId, workspaceId: ctx.workspaceId },
    });
    if (!wallet) {
      throw new NotFoundException(appError('WALLET_NOT_FOUND'));
    }
    if (normalizeCurrencyCode(wallet.currency) !== normalizeCurrencyCode(currency)) {
      throw new BadRequestException(
        appError('WALLET_STATEMENT_CURRENCY_MISMATCH', {
          walletCurrency: normalizeCurrencyCode(wallet.currency),
          currency: normalizeCurrencyCode(currency),
        }),
      );
    }
    return wallet;
  }
  if (!source) {
    return null;
  }
  const linked = await linkedSources(ctx.manager, ctx.workspaceId);
  if (linked.length === 0) {
    return null;
  }
  const active = await ctx.manager
    .getRepository(Wallet)
    .find({ where: { workspaceId: ctx.workspaceId, isActive: true } });
  return pickWalletBySource(active, linked, source, currency);
}
