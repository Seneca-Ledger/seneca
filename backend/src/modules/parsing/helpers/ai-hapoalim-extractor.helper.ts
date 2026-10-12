import { BaseAiHelper } from '../../../common/helpers/base-ai.helper';
import { mapParsedTransaction, unwrapAiJson } from '../../../common/utils/ai-response.util';
import { normalizeDate, normalizeNumber } from '../../../common/utils/number-normalizer.util';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { isAiCircuitOpen, redactSensitive } from './ai-runtime.util';

const HAPOALIM_PROMPT = `You are a financial document parser specializing in Israeli bank statements.
This is a credit card statement from Bank Hapoalim (בנק הפועלים) / Isracard (ישראכרט).
The document contains Hebrew (RTL) and English text mixed together.

The statement has two main sections:
1. "רכישות בחו"ל" (Foreign Purchases) — transactions in USD/EUR with exchange rates to ILS
2. "עסקות שחויבו / זוכו - בארץ" (Domestic Transactions) — transactions in ILS (Israeli New Shekel)

Extract ALL transactions from BOTH sections. Return ONLY JSON:
{"transactions":[{
  "date": "YYYY-MM-DD",
  "counterparty_name": "merchant name",
  "debit": number or null,
  "credit": number or null,
  "purpose": "description including category and installment info if present",
  "currency": "ILS",
  "amount_foreign": number or null,
  "exchange_rate": number or null
}]}

Rules:
- Dates in the document are DD/MM/YY format. Convert to ISO YYYY-MM-DD.
- For foreign transactions: "debit" is the final NIS charge (סכום החיוב). "amount_foreign" is the original currency amount (סכום מקורי).
- For domestic transactions: "debit" is the charge in NIS (סכום החיוב בש"ח).
- Negative amounts are credits/refunds — put absolute value in "credit", leave "debit" null.
- Include installment info like "תשלום 11 מתוך 11" (payment 11 of 11) in "purpose".
- Skip summary/total rows (סה"כ חיוב לתאריך).
- Skip commission detail sub-rows (lines with עמלה percentages).
- Skip credit card terms section (מסגרת הכרטיס ותנאי האשראי).
- Preserve merchant names exactly as written (Hebrew or English).
- All monetary values must be positive numbers. Use "debit" for charges, "credit" for refunds.`;

export class AiHapoalimExtractor extends BaseAiHelper {
  async extractTransactions(text: string): Promise<ParsedTransaction[]> {
    if (!this.isAvailable() || isAiCircuitOpen()) {
      return [];
    }

    const statementText = text.length > 20000 ? text.substring(0, 20000) : text;
    const redactedText = redactSensitive(statementText);

    try {
      const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);
      const content = await this.generateJsonContent(
        [
          {
            role: 'user',
            parts: [{ text: `${HAPOALIM_PROMPT}\n\nDocument text:\n${redactedText}` }],
          },
        ],
        {
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 20000,
          retries: 2,
          baseDelayMs: 500,
          maxDelayMs: 5000,
        },
      );
      return this.parseResponse(content);
    } catch (error) {
      this.logger.error('Text extraction failed:', error);
      return [];
    }
  }

  async extractFromImage(imageBuffer: Buffer): Promise<ParsedTransaction[]> {
    if (!this.isAvailable() || isAiCircuitOpen()) {
      return [];
    }

    try {
      const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);
      const content = await this.generateJsonContent(
        [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBuffer.toString('base64'),
                },
              },
              { text: HAPOALIM_PROMPT },
            ],
          },
        ],
        {
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 30000,
          retries: 1,
          baseDelayMs: 1000,
          maxDelayMs: 5000,
        },
      );
      return this.parseResponse(content);
    } catch (error) {
      this.logger.error('Image extraction failed:', error);
      return [];
    }
  }

  private parseResponse(content: string | null): ParsedTransaction[] {
    if (!content) {
      return [];
    }

    try {
      const parsed = JSON.parse(unwrapAiJson(content));
      const rawTransactions = parsed?.transactions || [];

      if (!Array.isArray(rawTransactions)) {
        return [];
      }

      return rawTransactions
        .map((tx: Record<string, unknown>): ParsedTransaction | null => {
          const mapped = mapParsedTransaction(tx, { normalizeDate, normalizeNumber });
          if (!mapped) {
            return null;
          }

          // Carry over foreign amount and exchange rate if present
          const amountForeign =
            typeof tx.amount_foreign === 'number' ? Math.abs(tx.amount_foreign) : undefined;
          const exchangeRate = typeof tx.exchange_rate === 'number' ? tx.exchange_rate : undefined;

          return {
            ...mapped,
            currency: 'ILS',
            amountForeign,
            exchangeRate,
          };
        })
        .filter((tx): tx is ParsedTransaction => tx !== null);
    } catch (error) {
      this.logger.error('Failed to parse AI response:', error);
      return [];
    }
  }
}
