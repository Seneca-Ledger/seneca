import { BaseAiHelper } from '../../../common/helpers/base-ai.helper';
import { mapParsedTransaction, unwrapAiJson } from '../../../common/utils/ai-response.util';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { normalizeDate, normalizeNumber } from '../../../common/utils/number-normalizer.util';
import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { isAiCircuitOpen, redactSensitive } from './ai-runtime.util';

export class AiParseValidator extends BaseAiHelper {
  async reconcileFromPdf(
    filePath: string,
    parsed: ParsedStatement,
  ): Promise<{ corrected: ParsedStatement; notes: string[] }> {
    if (isAiCircuitOpen()) {
      return {
        corrected: parsed,
        notes: ['AI temporarily disabled (circuit breaker)'],
      };
    }

    if (!this.isAvailable()) {
      return { corrected: parsed, notes: [] };
    }

    const pdfTextRaw = await extractTextFromPdf(filePath);
    const pdfText = pdfTextRaw.length > 18000 ? pdfTextRaw.substring(0, 18000) : pdfTextRaw;
    const parsedPreview = JSON.stringify(parsed.transactions.slice(0, 20));
    const redactedPdf = redactSensitive(pdfText);
    const redactedPreview = redactSensitive(parsedPreview);

    try {
      const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);
      const content = await this.generateJsonContent(
        [
          {
            role: 'user',
            parts: [
              {
                text: `You are an auditor for Bereke Bank statements. Compare PDF text with parsed transactions and correct mistakes or missing rows. Return ONLY JSON with shape {"transactions":[...],"notes":[...],"metadata":{...}}. Dates must be ISO (YYYY-MM-DD). Numbers should be decimal (dot). Use KZT currency.

PDF text snippet (redacted):
${redactedPdf}

Parsed transactions preview (redacted):
${redactedPreview}`,
              },
            ],
          },
        ],
        {
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 20000,
          timeoutMessage: 'AI request timed out',
          retries: 2,
          baseDelayMs: 500,
          maxDelayMs: 5000,
        },
      );
      if (!content) {
        return { corrected: parsed, notes: ['AI returned empty content'] };
      }

      // Same markdown-fence-stripping as the other AI helpers — some
      // OpenAI-compatible backends wrap JSON replies in ```json fences
      // despite response_format:json_object, which would otherwise throw
      // here and silently skip reconciliation for that backend only.
      const data = JSON.parse(unwrapAiJson(content));
      const rawTransactions = data?.transactions || data?.data?.transactions || parsed.transactions;

      const mapped = Array.isArray(rawTransactions)
        ? rawTransactions
            .map((tx: Record<string, unknown>) =>
              mapParsedTransaction(tx, {
                normalizeDate,
                normalizeNumber,
              }),
            )
            .filter((tx): tx is ParsedTransaction => tx !== null)
        : parsed.transactions;

      const notes = Array.isArray(data?.notes) ? data.notes.map((n: unknown) => String(n)) : [];

      // ponytail: guard against the AI silently discarding most of a good
      // deterministic parse (truncated context, hallucinated short answer).
      // Undershoot keeps the original transactions; a same-size-or-larger AI
      // result is still trusted wholesale — no per-row reconciliation.
      const original = parsed.transactions;
      const aiUndershoots = original.length > 0 && mapped.length < original.length * 0.5;
      if (aiUndershoots) {
        notes.push(
          `AI reconciliation returned ${mapped.length} transactions vs ${original.length} parsed — keeping original parse`,
        );
      }
      const finalTransactions = mapped.length && !aiUndershoots ? mapped : original;

      const meta = data?.metadata || {};
      const corrected: ParsedStatement = {
        metadata: {
          ...parsed.metadata,
          accountNumber: meta.accountNumber || parsed.metadata.accountNumber,
          dateFrom:
            normalizeDate(meta.dateFrom || meta.date_from || '') || parsed.metadata.dateFrom,
          dateTo: normalizeDate(meta.dateTo || meta.date_to || '') || parsed.metadata.dateTo,
          balanceStart:
            normalizeNumber(meta.balanceStart || meta.balance_start) ??
            parsed.metadata.balanceStart,
          balanceEnd:
            normalizeNumber(meta.balanceEnd || meta.balance_end) ?? parsed.metadata.balanceEnd,
          currency: meta.currency || parsed.metadata.currency || appDefaultCurrency(),
        },
        transactions: finalTransactions,
      };

      return { corrected, notes };
    } catch (error) {
      this.logger.error('Failed to reconcile via AI:', error);
      return { corrected: parsed, notes: ['AI reconciliation failed'] };
    }
  }
}
