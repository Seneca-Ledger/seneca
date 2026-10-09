import { BaseAiHelper } from '../../../common/helpers/base-ai.helper';
import { redactSensitive } from '../../parsing/helpers/ai-runtime.util';
import { IMPORT_TARGET_KINDS, type ImportTargetKind, TARGET_FIELDS } from '../target-aliases';

export interface AiMappingSuggestion {
  target: ImportTargetKind | 'table';
  columns: Array<{ index: number; role: string | null }>;
}

const MAX_HEADERS = 40;
const MAX_SAMPLES = 5;
const MAX_CELL = 60;

/**
 * Second opinion for headers the alias tables do not recognise. The model
 * only picks from the fields we list; anything else in its answer is dropped.
 */
export class AiImportMapperHelper extends BaseAiHelper {
  async suggest(headers: string[], samples: string[][]): Promise<AiMappingSuggestion | null> {
    if (!(this.isAvailable() && headers.length)) {
      return null;
    }
    const trimmedHeaders = headers
      .slice(0, MAX_HEADERS)
      .map(h => redactSensitive(h).slice(0, MAX_CELL));
    const trimmedSamples = samples
      .slice(0, MAX_SAMPLES)
      .map(row =>
        row
          .slice(0, MAX_HEADERS)
          .map(cell => redactSensitive(String(cell ?? '')).slice(0, MAX_CELL)),
      );
    const targets = IMPORT_TARGET_KINDS.map(kind => ({
      target: kind,
      fields: TARGET_FIELDS[kind].map(field => field.key),
    }));
    const prompt = [
      'You map spreadsheet columns onto one of the record types of a personal finance app.',
      'Return ONLY JSON: {"target": "<one of the targets or table>", "columns": [{"index": <column index>, "role": "<field key or null>"}]}.',
      'Rules: choose "table" when the sheet is not clearly one of the targets; use each role at most once; use null for columns that fit no field.',
      `Targets and their fields: ${JSON.stringify(targets)}`,
      `Headers (by index): ${JSON.stringify(trimmedHeaders)}`,
      `Sample rows: ${JSON.stringify(trimmedSamples)}`,
    ].join('\n');
    const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);
    const content = await this.generateJsonContent([{ role: 'user', parts: [{ text: prompt }] }], {
      timeoutMs,
      timeoutMessage: 'AI import mapping timed out',
      retries: 1,
      baseDelayMs: 500,
      maxDelayMs: 2000,
    });
    if (!content) {
      return null;
    }
    try {
      const parsed = JSON.parse(content) as { target?: unknown; columns?: unknown };
      const target = String(parsed.target ?? '');
      const kind = (IMPORT_TARGET_KINDS as string[]).includes(target)
        ? (target as ImportTargetKind)
        : target === 'table'
          ? 'table'
          : null;
      if (!kind) {
        return null;
      }
      const allowed = new Set(kind === 'table' ? [] : TARGET_FIELDS[kind].map(f => f.key));
      const used = new Set<string>();
      const columns: AiMappingSuggestion['columns'] = [];
      for (const item of Array.isArray(parsed.columns) ? parsed.columns : []) {
        const index = Number((item as { index?: unknown })?.index);
        const role = (item as { role?: unknown })?.role;
        if (!Number.isInteger(index) || index < 0 || index >= headers.length) {
          continue;
        }
        const cleanRole =
          typeof role === 'string' && allowed.has(role) && !used.has(role) ? role : null;
        if (cleanRole) {
          used.add(cleanRole);
        }
        columns.push({ index, role: cleanRole });
      }
      return { target: kind, columns };
    } catch {
      return null;
    }
  }
}
