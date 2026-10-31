import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { CreateManualExpenseBody } from '../../contracts';
import type { Category } from '../../entities';
import { CategoryType } from '../../entities/category.entity';
import type { TaxRate } from '../../entities/tax-rate.entity';
import type { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';

/**
 * The fields of a manual expense, checked in the order the form shows them:
 * a positive amount, a merchant, a currency, a date, an enabled expense
 * category of the workspace, and its tax rate (the one chosen, else the
 * workspace's default). The first wrong one is refused.
 */
export async function readManualExpenseInput(
  payload: CreateManualExpenseBody,
  workspaceId: string,
  deps: {
    workspaceCurrency: WorkspaceCurrencyService;
    categories: Repository<Category>;
    taxRates: Repository<TaxRate>;
  },
) {
  const amountValue = Number(
    String(payload.amount || '')
      .replace(',', '.')
      .trim(),
  );
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    throw new BadRequestException(appError('EXPENSE_AMOUNT_INVALID'));
  }

  const merchant = payload.merchant?.trim();
  if (!merchant) {
    throw new BadRequestException(appError('EXPENSE_MERCHANT_REQUIRED'));
  }

  const currency = await deps.workspaceCurrency.resolveFor(workspaceId, payload.currency);
  if (!currency) {
    throw new BadRequestException(appError('EXPENSE_CURRENCY_REQUIRED'));
  }

  const parsedDate = new Date(payload.date);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new BadRequestException(appError('EXPENSE_DATE_INVALID'));
  }

  const allowDuplicates = payload.allowDuplicates ?? false;
  const description = payload.description?.trim() || '';
  const categoryId = payload.categoryId?.trim();
  if (!categoryId) {
    throw new BadRequestException(appError('EXPENSE_CATEGORY_REQUIRED'));
  }

  const category = await deps.categories.findOne({
    where: { id: categoryId, workspaceId },
  });

  if (!category) {
    throw new BadRequestException(appError('CATEGORY_NOT_FOUND'));
  }

  if (category.isEnabled === false) {
    throw new BadRequestException(appError('EXPENSE_CATEGORY_DISABLED'));
  }

  if (category.type !== CategoryType.EXPENSE) {
    throw new BadRequestException(appError('EXPENSE_CATEGORY_NOT_EXPENSE'));
  }

  const taxRateId = payload.taxRateId?.trim();
  let taxRate: TaxRate | null = null;

  if (taxRateId) {
    taxRate = await deps.taxRates.findOne({
      where: {
        id: taxRateId,
        workspaceId,
        isEnabled: true,
      },
    });

    if (!taxRate) {
      throw new BadRequestException(appError('EXPENSE_TAX_RATE_NOT_FOUND'));
    }
  } else {
    taxRate = await deps.taxRates.findOne({
      where: {
        workspaceId,
        isDefault: true,
        isEnabled: true,
      },
    });
  }

  const transactionDate = new Date(parsedDate.toISOString().slice(0, 10));

  return {
    amountValue,
    merchant,
    currency,
    allowDuplicates,
    description,
    category,
    taxRateId,
    taxRate,
    transactionDate,
  };
}
