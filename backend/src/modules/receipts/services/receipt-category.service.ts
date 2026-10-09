import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, CategoryType, Receipt, Transaction } from '../../../entities';
import { ApplicationSettingsService } from '../../application-settings/application-settings.service';
import { AiCategoryClassifier } from '../../classification/helpers/ai-category-classifier.helper';

type CategoryQueryMode = 'direct' | 'via-statement';

/**
 * Keyword -> category name fragments used to deterministically match a vendor
 * to a category in ru/en/kk when the AI classifier is unavailable. Category
 * names are matched against these fragments (not against English type keys),
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

@Injectable()
export class ReceiptCategoryService {
  private readonly logger = new Logger(ReceiptCategoryService.name);
  private readonly aiCategoryClassifier = new AiCategoryClassifier();

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @Optional()
    private readonly applicationSettingsService?: ApplicationSettingsService,
  ) {}

  async suggestCategory(
    receipt: Receipt,
    _queryMode: CategoryQueryMode = 'direct',
  ): Promise<Category | null> {
    try {
      const vendor = receipt.parsedData?.vendor;
      if (!vendor) {
        return null;
      }

      const categories = await this.getCategories(
        receipt.workspaceId,
        receipt.parsedData?.transactionType,
      );

      if (categories.length === 0) {
        return null;
      }

      const historicalMatch = await this.matchByHistoricalData(
        vendor,
        receipt.workspaceId,
        categories,
      );
      if (historicalMatch) {
        return historicalMatch;
      }

      const aiMatch = await this.matchByAi(receipt, categories);
      if (aiMatch) {
        return aiMatch;
      }

      // Nothing is guessed from the vendor's own name. The keyword lexicon
      // below matches by substring, so "Travelodge" hit "travel" and
      // "Rentokil" hit the Rent category; it stays only for receipt line
      // items (`receipt-split.service.ts`), where the text really is a
      // product description and there is no payee to learn from.
      return null;
    } catch (error) {
      this.logger.error('Failed to suggest category', error);
      return null;
    }
  }

  /**
   * Categories are workspace-scoped directly via workspace_id, so both the
   * regular and the (legacy) gmail/'via-statement' flows query by workspaceId.
   * Receipts are filtered by income/expense type when the parsed type is known.
   */
  private getCategories(workspaceId: string, transactionType?: string): Promise<Category[]> {
    const where: {
      workspaceId: string;
      isEnabled: boolean;
      type?: CategoryType;
    } = { workspaceId, isEnabled: true };

    if (transactionType === 'income') {
      where.type = CategoryType.INCOME;
    } else if (transactionType === 'expense') {
      where.type = CategoryType.EXPENSE;
    }

    return this.categoryRepository.find({ where });
  }

  private async matchByHistoricalData(
    vendor: string,
    workspaceId: string,
    categories: Category[],
  ): Promise<Category | null> {
    const normalizedVendor = vendor.trim().toLowerCase();
    if (!normalizedVendor) {
      return null;
    }

    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.categoryId IS NOT NULL')
      .andWhere(
        '(LOWER(transaction.counterpartyName) LIKE :vendor OR LOWER(transaction.paymentPurpose) LIKE :vendor)',
        { vendor: `%${normalizedVendor}%` },
      )
      .limit(10)
      .getMany();

    if (transactions.length === 0) {
      return null;
    }

    const categoryCounts: Record<string, number> = {};
    for (const transaction of transactions) {
      if (transaction.categoryId) {
        categoryCounts[transaction.categoryId] = (categoryCounts[transaction.categoryId] || 0) + 1;
      }
    }

    const mostCommonCategoryId = Object.entries(categoryCounts).sort(
      ([, a], [, b]) => b - a,
    )[0]?.[0];

    if (mostCommonCategoryId) {
      return categories.find(category => category.id === mostCommonCategoryId) || null;
    }

    return null;
  }

  /**
   * One model call for several line descriptions; `null` where the model had
   * no confident answer or is not configured. Index-aligned with the input.
   */
  async classifyDescriptions(
    receipt: Receipt,
    descriptions: string[],
    categories: Category[],
  ): Promise<Array<string | null>> {
    const empty = descriptions.map(() => null);
    if (descriptions.length === 0 || categories.length === 0) {
      return empty;
    }
    try {
      const aiSettings = await this.applicationSettingsService?.getAiSettingsForWorkspaceId(
        receipt.workspaceId,
      );
      if (aiSettings) {
        this.aiCategoryClassifier.configureAiClient(aiSettings);
      }
      if (!this.aiCategoryClassifier.isAvailable()) {
        return empty;
      }
      const vendor = receipt.parsedData?.vendor ?? '';
      const result = await this.aiCategoryClassifier.classifyBatch(
        descriptions.map((description, index) => ({
          index,
          counterpartyName: vendor,
          paymentPurpose: description,
        })),
        categories.map(category => ({ id: category.id, name: category.name })),
      );
      const known = new Set(categories.map(category => category.id));
      const byIndex = new Map(result.matches.map(match => [match.index, match.categoryId]));
      return descriptions.map((_, index) => {
        const categoryId = byIndex.get(index);
        return categoryId && known.has(categoryId) ? categoryId : null;
      });
    } catch (error) {
      this.logger.warn('AI line-item classification failed', error);
      return empty;
    }
  }

  private async matchByAi(receipt: Receipt, categories: Category[]): Promise<Category | null> {
    try {
      const aiSettings = await this.applicationSettingsService?.getAiSettingsForWorkspaceId(
        receipt.workspaceId,
      );
      if (aiSettings) {
        this.aiCategoryClassifier.configureAiClient(aiSettings);
      }

      if (!this.aiCategoryClassifier.isAvailable()) {
        return null;
      }

      const vendor = receipt.parsedData?.vendor ?? '';
      const purpose = (receipt.parsedData?.lineItems ?? [])
        .map(item => item.description)
        .filter(Boolean)
        .join(' ')
        .slice(0, 800);

      const result = await this.aiCategoryClassifier.classifyBatch(
        [{ index: 0, counterpartyName: vendor, paymentPurpose: purpose }],
        categories.map(category => ({ id: category.id, name: category.name })),
      );

      const match = result.matches?.[0];
      if (!match) {
        return null;
      }

      return categories.find(category => category.id === match.categoryId) || null;
    } catch (error) {
      this.logger.warn('AI category classification failed', error);
      return null;
    }
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
