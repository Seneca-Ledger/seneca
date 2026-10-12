import { BaseAiHelper } from '../../../common/helpers/base-ai.helper';
import { redactSensitive } from '../../parsing/helpers/ai-runtime.util';

export interface AiColumnInput {
  id: string;
  /** Значения строки в виде «Заголовок: значение», уже урезанные по длине. */
  text: string;
}

export interface AiColumnResult {
  id: string;
  value: string | null;
}

/** Ограничения нужны, чтобы один клик не превратился в неограниченный счёт. */
const MAX_TEXT_LENGTH = 1500;
const MAX_VALUE_LENGTH = 200;

/**
 * Обобщение классификатора «оплачено/не оплачено» на произвольный промпт.
 *
 * Отличие от формулы: результат СОХРАНЯЕТСЯ в ячейку. Запрос к модели стоит
 * денег и не детерминирован, поэтому пересчитывать его на каждое чтение
 * нельзя — и пользователь должен иметь возможность поправить ответ руками.
 */
export class AiColumnFiller extends BaseAiHelper {
  isReady(): boolean {
    return this.isAvailable();
  }

  async fill(prompt: string, inputs: AiColumnInput[]): Promise<AiColumnResult[]> {
    if (!inputs.length) {
      return [];
    }
    // Без настроенной модели возвращаем пустые значения, а не выдумываем их:
    // молча записать мусор в таблицу с финданными хуже, чем не заполнить.
    if (!this.isAvailable()) {
      return inputs.map(input => ({ id: input.id, value: null }));
    }

    // Данные уходят во внешнюю модель — чувствительное вырезаем.
    const sanitized = inputs.map(input => ({
      id: input.id,
      text: redactSensitive(String(input.text || '')).slice(0, MAX_TEXT_LENGTH),
    }));

    const timeoutMs = Number.parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);

    try {
      const content = await this.generateJsonContent(
        [
          {
            role: 'user',
            parts: [
              {
                text: `You fill one spreadsheet column for each row, following the user's instruction.
Return ONLY JSON with shape {"results":[{"id":"...","value":"..."}]}.
Use null for value when the row does not give enough information.
Keep every value under ${MAX_VALUE_LENGTH} characters and return plain text, not markdown.

Instruction from the user:
${redactSensitive(prompt).slice(0, 1000)}

Rows:
${JSON.stringify(sanitized)}`,
              },
            ],
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
        return inputs.map(input => ({ id: input.id, value: null }));
      }
      const parsed = JSON.parse(content) as { results?: Array<{ id?: string; value?: unknown }> };
      const byId = new Map<string, string | null>();
      for (const item of parsed.results ?? []) {
        if (typeof item?.id !== 'string') {
          continue;
        }
        const value =
          item.value === null || item.value === undefined
            ? null
            : String(item.value).slice(0, MAX_VALUE_LENGTH);
        byId.set(item.id, value);
      }
      // Модель может вернуть не все строки — недостающие остаются пустыми.
      return inputs.map(input => ({ id: input.id, value: byId.get(input.id) ?? null }));
    } catch {
      return inputs.map(input => ({ id: input.id, value: null }));
    }
  }
}
