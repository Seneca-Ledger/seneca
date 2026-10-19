export interface MentionCandidate {
  id: string;
  name: string;
}

export interface ActiveMentionQuery {
  /** Позиция символа `@`. */
  start: number;
  /** Текст между `@` и кареткой. */
  query: string;
}

/** Имена бывают из двух слов, поэтому подсказку ищем максимум по двум. */
const MAX_QUERY_WORDS = 2;

/**
 * Определяет, набирает ли пользователь упоминание прямо сейчас.
 * `@` считается началом упоминания только в начале строки или после пробела —
 * иначе почта вида ivan@example.com открывала бы подсказку.
 */
export function findActiveMention(text: string, caret: number): ActiveMentionQuery | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) {
    return null;
  }
  if (at > 0 && !/\s/.test(before[at - 1] ?? '')) {
    return null;
  }

  const query = before.slice(at + 1);
  if (query.includes('\n') || query.split(/\s+/).length > MAX_QUERY_WORDS) {
    return null;
  }
  return { start: at, query };
}

/** Подставляет выбранное имя вместо набранного `@...` и возвращает новую позицию каретки. */
export function applyMention(
  text: string,
  mention: ActiveMentionQuery,
  name: string,
): { text: string; caret: number } {
  const tail = text.slice(mention.start + mention.query.length + 1);
  // Пробел после имени нужен, чтобы упоминание закрылось, но удваивать его нельзя.
  const separator = /^\s/.test(tail) ? '' : ' ';
  const caret = mention.start + name.length + 1 + separator.length;
  return { text: `${text.slice(0, mention.start)}@${name}${separator}${tail}`, caret };
}

export function filterCandidates(
  candidates: MentionCandidate[],
  query: string,
  limit = 6,
): MentionCandidate[] {
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? candidates.filter(candidate => candidate.name.toLowerCase().includes(needle))
    : candidates;
  return matches.slice(0, limit);
}

/**
 * Кого реально упомянули в итоговом тексте: имя могли стереть после выбора,
 * поэтому список собираем из текста, а не из истории кликов.
 */
export function collectMentionedIds(text: string, candidates: MentionCandidate[]): string[] {
  const lower = text.toLowerCase();
  const ids = candidates
    .filter(candidate => candidate.name && lower.includes(`@${candidate.name.toLowerCase()}`))
    .map(candidate => candidate.id);
  return [...new Set(ids)];
}

export interface BodySegment {
  text: string;
  isMention: boolean;
}

/**
 * Режет текст заметки на куски для подсветки. Совпадения ищем от самых длинных
 * имён, иначе «@Анна» съела бы начало «@Анна Петрова».
 */
export function splitByMentions(body: string, names: string[]): BodySegment[] {
  const sorted = names.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!sorted.length) {
    return [{ text: body, isMention: false }];
  }

  const segments: BodySegment[] = [];
  let rest = body;

  while (rest.length) {
    const lower = rest.toLowerCase();
    let bestIndex = -1;
    let bestName = '';

    for (const name of sorted) {
      const index = lower.indexOf(`@${name.toLowerCase()}`);
      if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
        bestIndex = index;
        bestName = name;
      }
    }

    if (bestIndex === -1) {
      segments.push({ text: rest, isMention: false });
      break;
    }

    if (bestIndex > 0) {
      segments.push({ text: rest.slice(0, bestIndex), isMention: false });
    }
    segments.push({
      text: rest.slice(bestIndex, bestIndex + bestName.length + 1),
      isMention: true,
    });
    rest = rest.slice(bestIndex + bestName.length + 1);
  }

  return segments;
}
