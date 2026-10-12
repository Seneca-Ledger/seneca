import { BaseAiHelper } from '../../../common/helpers/base-ai.helper';
import { stripHtmlForAi, unwrapAiJson } from '../../../common/utils/ai-response.util';
import { redactSensitive } from '../../parsing/helpers/ai-runtime.util';

export type MerchantExtractionInput = {
  pdfText?: string | null;
  emailBody?: string | null;
  sender?: string | null;
  subject?: string | null;
  dateHeader?: string | null;
};

export type MerchantExtractionResult = {
  merchant: string;
  confidence: number;
};

const MIN_MERCHANT_CONFIDENCE = 0.3;

const DATE_LIKE_PATTERN =
  /^(date\s*)?\d{4}[-/.]\d{2}[-/.]\d{2}|^\d{2}[-/.]\d{2}[-/.]\d{4}|\d{1,2}:\d{2}\s*(am|pm)\s*(pst|est|utc|gmt|cst|mst)?$/i;

const JUNK_VENDOR_PATTERN =
  /^(page\s+\d+(\s+of\s+\d+)?|receipt|invoice|order|payment|confirmation|date|unknown|n\/a|na|\d+)$/i;

export class AiMerchantExtractor extends BaseAiHelper {
  async extractMerchant(input: MerchantExtractionInput): Promise<MerchantExtractionResult | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = this.buildPrompt(input);

    try {
      const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS || '15000', 10);
      const content = await this.generateJsonContent(
        [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        {
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
          retries: 1,
          baseDelayMs: 300,
          maxDelayMs: 2000,
        },
      );
      if (!content) {
        return null;
      }

      const result = this.parseResponse(content);
      return result;
    } catch (error) {
      console.error('[AiMerchantExtractor] Failed:', error);
      return null;
    }
  }

  private buildPrompt(input: MerchantExtractionInput): string {
    const blocks: string[] = [];

    if (input.sender) {
      blocks.push(`Email sender (From header): ${redactSensitive(input.sender)}`);
    }

    if (input.subject) {
      blocks.push(
        `Email subject: ${redactSensitive(input.subject)
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500)}`,
      );
    }

    if (input.dateHeader) {
      blocks.push(`Email date: ${input.dateHeader}`);
    }

    if (input.emailBody) {
      blocks.push(
        `Email body (first 3000 chars):\n${redactSensitive(stripHtmlForAi(input.emailBody)).slice(0, 3000)}`,
      );
    }

    if (input.pdfText) {
      blocks.push(
        `PDF attachment text (first 5000 chars):\n${redactSensitive(input.pdfText).slice(0, 5000)}`,
      );
    }

    return `You are a financial document analyst. Extract the merchant/vendor/company name from this receipt email.

Return ONLY JSON with shape {"merchant": "CompanyName", "confidence": 0.95}.

Rules:
- "merchant" is the company/brand that charged the customer (for example: "GitHub", "Amazon", "Spotify").
- Return short brand name, not legal suffixes.
- Do NOT return dates, email addresses, amounts, or generic words like "Receipt"/"Invoice".
- If uncertain, return {"merchant": "", "confidence": 0}.
- confidence must be a number in [0, 1].

${blocks.join('\n\n')}`;
  }

  private parseResponse(content: string): MerchantExtractionResult | null {
    try {
      const parsed = JSON.parse(unwrapAiJson(content));
      const merchant = String(parsed?.merchant || '').trim();
      const confidence = Number(parsed?.confidence);

      if (!merchant || merchant.length > 100) {
        return null;
      }

      if (!Number.isFinite(confidence) || confidence < MIN_MERCHANT_CONFIDENCE) {
        return null;
      }

      if (DATE_LIKE_PATTERN.test(merchant)) {
        return null;
      }

      if (JUNK_VENDOR_PATTERN.test(merchant)) {
        return null;
      }

      return {
        merchant,
        confidence,
      };
    } catch {
      return null;
    }
  }
}
