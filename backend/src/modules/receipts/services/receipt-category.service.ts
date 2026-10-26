import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, Receipt } from '../../../entities';
import { TransactionCategorySource, TransactionType } from '../../../entities/transaction.entity';
import { ClassificationService } from '../../classification/services/classification.service';

/**
 * Keyword -> category name fragments used to deterministically match a receipt
 * line item (a product description, not a payee) to a category in ru/en/kk.
 * Category names are matched against these fragments (not against English type keys),
 * so the Russian default categories ("Продукты", "Транспорт", ...) are found.
 */
const KEYWORD_CATEGORY_FRAGMENTS: Record<string, string[]> = {
  food: [
    'продукт',
    'еда',
    'питание',
    'ресторан',
    'кафе',
    'бакале',
    'grocery',
    'supermarket',
    'food',
  ],
  transport: [
    'транспорт',
    'топлив',
    'бензин',
    'заправк',
    'такси',
    'азс',
    'fuel',
    'transport',
    'taxi',
    'gas',
  ],
  entertainment: ['развлечение', 'кино', 'театр', 'концерт', 'досуг', 'entertainment', 'cinema'],
  shopping: ['магазин', 'покупк', 'торгов', 'маркет', 'shopping', 'store', 'shop', 'mall'],
  utilities: [
    'коммунальн',
    'коммуналь',
    'электро',
    'вода',
    'utility',
    'utilities',
    'electric',
    'water',
    'жкх',
  ],
  health: [
    'аптек',
    'клиник',
    'больниц',
    'лекар',
    'здоров',
    'медицин',
    'врач',
    'pharmacy',
    'health',
    'clinic',
  ],
  education: ['обучение', 'курс', 'учеб', 'школ', 'образование', 'education', 'study'],
  travel: [
    'путешеств',
    'гостиниц',
    'отель',
    'авиа',
    'билет',
    'отпуск',
    'travel',
    'hotel',
    'flight',
  ],
};

const VENDOR_KEYWORDS: Record<string, string[]> = {
  food: [
    'ресторан',
    'кафе',
    'кофе',
    'пицца',
    'бургер',
    'супермаркет',
    'продукт',
    'grocery',
    'supermarket',
    'restaurant',
    'cafe',
    'pizza',
    'burger',
  ],
  transport: ['такси', 'uber', 'яндекс такси', 'заправк', 'бензин', 'азс', 'taxi', 'fuel', 'gas'],
  entertainment: ['кино', 'театр', 'концерт', 'кинотеатр', 'cinema', 'theater', 'movie'],
  shopping: ['магазин', 'торгов', 'shop', 'store', 'mall', 'market'],
  utilities: ['коммунальн', 'электро', 'жкх', 'electric', 'utility'],
  health: ['аптек', 'клиник', 'больниц', 'pharmacy', 'clinic', 'hospital'],
  education: ['курс', 'учеб', 'школ', 'обучение', 'course', 'education'],
  travel: ['гостиниц', 'отель', 'авиа', 'hotel', 'flight', 'travel'],
};

/** A category for a receipt, with the step that found it (shown as "why"). */
export type ReceiptCategorySuggestion = {
  category: Category;
  source: TransactionCategorySource;
  reason: string | null;
};

@Injectable()
export class ReceiptCategoryService {
  private readonly logger = new Logger(ReceiptCategoryService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly classificationService: ClassificationService,
  ) {}

  /**
   * The category a receipt's vendor gets, by the same rules as a bank row: the
   * user's rules, then what this payee was filed as before. Nothing is guessed from the vendor's own name:
   * "Travelodge" is not Travel and "Rentokil" is not Rent.
   */
  async suggest(receipt: Receipt): Promise<ReceiptCategorySuggestion | null> {
    try {
      const vendor = receipt.parsedData?.vendor?.trim();
      if (!vendor) {
        return null;
      }

      const transactionType =
        receipt.parsedData?.transactionType === 'income'
          ? TransactionType.INCOME
          : TransactionType.EXPENSE;
      const match = await this.classificationService.suggestForPayee({
        workspaceId: receipt.workspaceId,
        userId: receipt.userId,
        counterpartyName: vendor,
        paymentPurpose: vendor,
        transactionType,
        amount: receipt.parsedData?.amount ?? null,
      });
      if (!match) {
        return null;
      }

      const category = await this.categoryRepository.findOne({
        where: { id: match.categoryId, workspaceId: receipt.workspaceId, isEnabled: true },
      });
      return category ? { category, source: match.source, reason: match.reason } : null;
    } catch (error) {
      this.logger.error('Failed to suggest category', error);
      return null;
    }
  }

  /** Writes the suggestion onto the receipt's parsed data; returns the category, if any. */
  async categorize(receipt: Receipt): Promise<Category | null> {
    const suggestion = await this.suggest(receipt);
    if (suggestion) {
      receipt.parsedData = {
        ...receipt.parsedData,
        category: suggestion.category.name,
        categoryId: suggestion.category.id,
        categorySource: suggestion.source,
        categoryReason: suggestion.reason,
      };
    }
    return suggestion?.category ?? null;
  }

  matchByKeywords(vendor: string, categories: Category[]): Category | null {
    const vendorLower = vendor.toLowerCase();

    for (const [type, keywords] of Object.entries(VENDOR_KEYWORDS)) {
      for (const keyword of keywords) {
        if (vendorLower.includes(keyword)) {
          const category = this.findCategoryByFragments(categories, type, keyword);
          if (category) {
            return category;
          }
        }
      }
    }

    return null;
  }

  private findCategoryByFragments(
    categories: Category[],
    type: string,
    keyword: string,
  ): Category | null {
    const fragments = KEYWORD_CATEGORY_FRAGMENTS[type] ?? [];

    for (const category of categories) {
      const categoryLower = category.name.toLowerCase();
      // Direct hit: the category name literally contains the matched keyword
      // (covers user-created categories such as "Кафе и рестораны").
      if (categoryLower.includes(keyword)) {
        return category;
      }

      // Known-language hit: category name contains a ru/en/kk fragment for the type.
      for (const fragment of fragments) {
        if (categoryLower.includes(fragment)) {
          return category;
        }
      }
    }

    return null;
  }
}
