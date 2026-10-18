const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>' };

/**
 * Turns an HTML email body into one line of plain text for parsing; the result
 * is never rendered as HTML. Entities are decoded in one pass, so `&amp;lt;`
 * stays `&lt;`.
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/&(?:(nbsp|amp|lt|gt)|#\d+);/g, (_entity, name?: string) =>
      name ? ENTITIES[name] : ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
