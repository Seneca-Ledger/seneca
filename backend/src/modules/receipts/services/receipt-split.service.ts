import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Category } from '../../../entities/category.entity';
import { Receipt } from '../../../entities/receipt.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { TransactionsService } from '../../transactions/transactions.service';
import { ReceiptCategoryService } from './receipt-category.service';
import { groupLineItemsIntoParts, type SplitLineItem, type SplitPart } from './receipt-split.util';

export interface ReceiptSplitSuggestion {
  transactionId: string;
  total: number;
  currency: string;
  parts: Array<SplitPart & { categoryName: string | null }>;
  /** False when everything landed in one category: nothing to split. */
  splittable: boolean;
  /** The line items with the category the suggestion assigned to each. */
  items: SplitLineItem[];
  /** The transaction is split already: undo that first, nothing is suggested. */
  alreadySplit: boolean;
  /** Where items without a category go: the receipt's, else the transaction's category. */
  fallbackCategoryId: string | null;
}

/** A line with the category the user settled on in the preview. */
export interface ReviewedSplitItem {
  description: string;
  amount: number;
  categoryId?: string | null;
}

/**
 * Turns a receipt's line items into a category split of the transaction it is
 * attached to: "Target, 80 €" becomes groceries 52 €, household 28 €.
 */
@Injectable()
export class ReceiptSplitService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly categoryService: ReceiptCategoryService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async suggest(receiptId: string, workspaceId: string): Promise<ReceiptSplitSuggestion> {
    return this.build(receiptId, workspaceId);
  }

  /**
   * Applies the split through the ordinary transaction split and remembers each
   * line's category. `reviewed` is the preview as the user corrected it; it must
   * be the receipt's own lines, only the categories may differ.
   */
  async apply(
    receiptId: string,
    workspaceId: string,
    userId: string,
    reviewed?: ReviewedSplitItem[],
  ) {
    const suggestion = await this.build(receiptId, workspaceId, reviewed);
    if (suggestion.alreadySplit) {
      throw new BadRequestException('The transaction is already split');
    }
    if (!suggestion.splittable) {
      throw new BadRequestException('All line items fall into one category');
    }
    const vendor = (await this.receiptRepository.findOne({ where: { id: receiptId, workspaceId } }))
      ?.parsedData?.vendor;
    const transactions = await this.transactionsService.split(
      suggestion.transactionId,
      workspaceId,
      userId,
      {
        parts: suggestion.parts.map(part => ({
          amount: part.amount,
          categoryId: part.categoryId ?? undefined,
          paymentPurpose: `${vendor ? `${vendor}: ` : ''}${part.items.join(', ')}`.slice(0, 500),
        })),
      },
    );
    await this.receiptRepository.update(
      { id: receiptId, workspaceId },
      {
        parsedData: () =>
          `parsed_data || '${JSON.stringify({ lineItems: suggestion.items }).replace(/'/g, "''")}'::jsonb`,
      },
    );
    return { suggestion, transactions };
  }

  private async build(
    receiptId: string,
    workspaceId: string,
    reviewed?: ReviewedSplitItem[],
  ): Promise<ReceiptSplitSuggestion> {
    const receipt = await this.receiptRepository.findOne({ where: { id: receiptId, workspaceId } });
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    if (!receipt.transactionId) {
      throw new BadRequestException('Approve the receipt first so there is a transaction to split');
    }
    const transaction = await this.transactionRepository.findOne({
      where: { id: receipt.transactionId, workspaceId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    const total = Math.abs(
      Number(transaction.amount) || Number(transaction.debit) || Number(transaction.credit) || 0,
    );
    if (transaction.splitGroupId) {
      // Checked before categorising, which may ask the model: nothing to suggest.
      return {
        transactionId: transaction.id,
        total,
        currency: transaction.currency,
        parts: [],
        splittable: false,
        items: [],
        alreadySplit: true,
        fallbackCategoryId: null,
      };
    }
    const lines = (receipt.parsedData?.lineItems ?? []).filter(
      item => item.description?.trim() && Number(item.amount) > 0,
    );
    if (lines.length < 2) {
      throw new BadRequestException('The receipt needs at least two line items');
    }

    const categories = await this.categoryRepository.find({ where: { workspaceId } });
    const enabled = categories.filter(category => category.isEnabled !== false);
    const items = reviewed
      ? this.checkReviewed(lines, reviewed, enabled)
      : await this.categorise(receipt, lines, enabled);
    const fallback = receipt.parsedData?.categoryId ?? transaction.categoryId ?? null;
    const parts = groupLineItemsIntoParts(items, total, fallback);
    const nameOf = new Map(categories.map(category => [category.id, category.name]));

    return {
      transactionId: transaction.id,
      total,
      currency: transaction.currency,
      parts: parts.map(part => ({
        ...part,
        categoryName: part.categoryId ? (nameOf.get(part.categoryId) ?? null) : null,
      })),
      splittable: parts.length >= 2,
      items,
      alreadySplit: false,
      fallbackCategoryId: fallback,
    };
  }

  /** The reviewed preview must be the receipt's own lines, in order; only categories may change. */
  private checkReviewed(
    lines: NonNullable<Receipt['parsedData']>['lineItems'] & object,
    reviewed: ReviewedSplitItem[],
    categories: Category[],
  ): SplitLineItem[] {
    const known = new Set(categories.map(category => category.id));
    const sameLines =
      reviewed.length === lines.length &&
      lines.every(
        (line, index) =>
          line.description.trim() === reviewed[index].description.trim() &&
          Math.abs(Number(line.amount) - reviewed[index].amount) < 0.005,
      );
    if (!sameLines) {
      throw new BadRequestException('The receipt lines changed; reload the split preview');
    }
    return reviewed.map(item => {
      const categoryId = item.categoryId ?? null;
      if (categoryId && !known.has(categoryId)) {
        throw new BadRequestException('Unknown category');
      }
      return { description: item.description.trim(), amount: item.amount, categoryId };
    });
  }

  /** Keeps an existing category, then keywords, then the model, then the fallback. */
  private async categorise(
    receipt: Receipt,
    lines: NonNullable<Receipt['parsedData']>['lineItems'] & object,
    categories: Category[],
  ): Promise<SplitLineItem[]> {
    const known = new Set(categories.map(category => category.id));
    const items: SplitLineItem[] = (lines ?? []).map(line => ({
      description: line.description.trim(),
      amount: Number(line.amount),
      categoryId: line.categoryId && known.has(line.categoryId) ? line.categoryId : null,
    }));
    for (const item of items) {
      if (item.categoryId) continue;
      item.categoryId =
        this.categoryService.matchByKeywords(item.description, categories)?.id ?? null;
    }
    const pending = items.filter(item => !item.categoryId);
    if (pending.length > 0) {
      const matches = await this.categoryService.classifyDescriptions(
        receipt,
        pending.map(item => item.description),
        categories,
      );
      for (const [index, item] of pending.entries()) {
        item.categoryId = matches[index] ?? null;
      }
    }
    return items;
  }

  /** Loads the categories referenced by a receipt's split, for display. */
  async categoriesFor(workspaceId: string, ids: string[]): Promise<Category[]> {
    return ids.length ? this.categoryRepository.find({ where: { workspaceId, id: In(ids) } }) : [];
  }
}
