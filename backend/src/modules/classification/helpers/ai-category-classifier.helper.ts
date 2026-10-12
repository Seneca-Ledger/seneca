import { BaseAiHelper } from '../../../common/helpers/base-ai.helper';
import { redactSensitive } from '../../parsing/helpers/ai-runtime.util';

export type TransactionCategoryInput = {
  index: number;
  counterpartyName?: string | null;
  paymentPurpose?: string | null;
};

export type CategoryOption = {
  id: string;
  name: string;
};

export type AiCategoryMatch = {
  index: number;
  categoryName: string;
  categoryId: string;
  confidence: number;
  vendorNormalized?: string;
  categoryHint?: string;
  taxMentioned?: boolean;
  taxRate?: number;
  transactionNature?: string;
};

export type AiCategoryBatchResult = {
  matches: AiCategoryMatch[];
  failedCount: number;
};

export const AI_CATEGORY_BATCH_SIZE = 20;
const AI_CATEGORY_CONFIDENCE_THRESHOLD = 0.9;

export class AiCategoryClassifier extends BaseAiHelper {
  async classifyBatch(
    transactions: TransactionCategoryInput[],
    categories: CategoryOption[],
  ): Promise<AiCategoryBatchResult> {
    if (!transactions.length) {
      return { matches: [], failedCount: 0 };
    }

    if (!(categories.length && this.isAvailable())) {
      return { matches: [], failedCount: transactions.length };
    }

    const matches: AiCategoryMatch[] = [];
    let failedCount = 0;

    for (let start = 0; start < transactions.length; start += AI_CATEGORY_BATCH_SIZE) {
      const chunk = transactions.slice(start, start + AI_CATEGORY_BATCH_SIZE);
      const chunkResult = await this.classifyChunk(chunk, categories);
      matches.push(...chunkResult.matches);
      failedCount += chunkResult.failedCount;
    }

    return { matches, failedCount };
  }

  private async classifyChunk(
    transactions: TransactionCategoryInput[],
    categories: CategoryOption[],
  ): Promise<AiCategoryBatchResult> {
    if (!this.isAvailable()) {
      return { matches: [], failedCount: transactions.length };
    }

    const prompt = this.buildPrompt(transactions, categories);
    const categoryMap = new Map(
      categories.map(category => [category.name.trim().toLowerCase(), category.id]),
    );

    try {
      const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);
      const content = await this.generateJsonContent(
        [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        {
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 20000,
          retries: 1,
          baseDelayMs: 500,
          maxDelayMs: 2000,
        },
      );

      if (!content) {
        return { matches: [], failedCount: transactions.length };
      }

      const parsed = JSON.parse(content);
      const rawClassifications = parsed?.classifications || parsed?.results || [];
      if (!Array.isArray(rawClassifications)) {
        return { matches: [], failedCount: transactions.length };
      }

      const validIndexes = new Set(transactions.map(item => item.index));
      const matchedIndexes = new Set<number>();
      const matches: AiCategoryMatch[] = [];

      for (const item of rawClassifications) {
        const index = Number(item?.index);
        if (!(Number.isFinite(index) && validIndexes.has(index))) {
          continue;
        }

        const categoryName = String(item?.category || item?.categoryName || '').trim();
        if (!categoryName) {
          continue;
        }

        const confidence = Number(item?.confidence);
        if (!Number.isFinite(confidence) || confidence < AI_CATEGORY_CONFIDENCE_THRESHOLD) {
          continue;
        }

        const categoryId = categoryMap.get(categoryName.toLowerCase());
        if (!categoryId || matchedIndexes.has(index)) {
          continue;
        }

        matchedIndexes.add(index);
        matches.push({
          index,
          categoryName,
          categoryId,
          confidence,
          vendorNormalized:
            typeof item?.vendorNormalized === 'string' ? item.vendorNormalized.trim() : undefined,
          categoryHint: typeof item?.categoryHint === 'string' ? item.categoryHint : undefined,
          taxMentioned: typeof item?.taxMentioned === 'boolean' ? item.taxMentioned : undefined,
          taxRate:
            typeof item?.taxRate === 'number' && Number.isFinite(item.taxRate)
              ? item.taxRate
              : undefined,
          transactionNature:
            typeof item?.transactionNature === 'string' ? item.transactionNature : undefined,
        });
      }

      return {
        matches,
        failedCount: transactions.length - matchedIndexes.size,
      };
    } catch (error) {
      console.error('[AiCategoryClassifier] Failed to classify transactions:', error);
      return { matches: [], failedCount: transactions.length };
    }
  }

  private buildPrompt(
    transactions: TransactionCategoryInput[],
    categories: CategoryOption[],
  ): string {
    const sanitizedTransactions = transactions.map(item => ({
      index: item.index,
      counterparty: redactSensitive(String(item.counterpartyName || '')).slice(0, 300),
      purpose: redactSensitive(String(item.paymentPurpose || '')).slice(0, 800),
    }));

    const categoryNames = categories.map(category => category.name);

    return `You classify and enrich financial transactions.
Return ONLY JSON with shape:
{"classifications":[{
  "index": number,
  "category": string,
  "confidence": number,
  "vendorNormalized": string | null,
  "categoryHint": "food"|"transport"|"entertainment"|"shopping"|"utilities"|"health"|"education"|"travel"|"salary"|"rent"|"tax"|"insurance"|"subscription"|"other" | null,
  "taxMentioned": boolean,
  "taxRate": number | null,
  "transactionNature": "goods"|"services"|"salary"|"tax"|"transfer"|"loan"|"commission"|"rent"|"subscription" | null
}]}

Rules:
- Use ONLY category names from the provided list.
- confidence must be between 0 and 1.
- Use confidence >= 0.90 only for very certain classifications.
- If uncertain, return lower confidence.
- vendorNormalized: clean, short vendor name (e.g. "ТОО Магнум Кэш энд Кэрри" → "Magnum").
- taxMentioned: true if purpose mentions НДС/VAT/tax. taxRate: numeric rate if present (e.g. 12 for "НДС 12%").
- transactionNature: the nature of the operation based on counterparty and purpose.
- Omit enrichment fields if not determinable.

Available categories:
${JSON.stringify(categoryNames)}

Transactions:
${JSON.stringify(sanitizedTransactions)}
`;
  }
}
