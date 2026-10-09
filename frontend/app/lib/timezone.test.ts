import { describe, expect, it } from 'vitest';
import { formatTimeZoneLabel } from './timezone';

describe('formatTimeZoneLabel', () => {
  // Токио круглый год на +09:00: у зоны с переходом на летнее время сдвиг
  // в ярлыке менялся бы вместе с календарём, и тест падал бы каждую весну.
  it('names the zone in the reader language', () => {
    expect(formatTimeZoneLabel('Asia/Tokyo', 'ru')).toBe(
      'Asia/Tokyo — Япония, стандартное время (GMT+09:00)',
    );
    expect(formatTimeZoneLabel('Asia/Tokyo', 'de')).toBe(
      'Asia/Tokyo — Japanische Normalzeit (GMT+09:00)',
    );
  });

  it('keeps the generic name across the summer-time switch', () => {
    // longGeneric не зависит от даты — меняется только сдвиг в скобках.
    expect(formatTimeZoneLabel('Europe/Berlin', 'ru')).toMatch(
      /^Europe\/Berlin — Центральная Европа \(GMT\+0[12]:00\)$/,
    );
  });

  it('keeps the identifier first so the list stays sorted by continent', () => {
    for (const locale of ['ru', 'ja', 'hi']) {
      expect(formatTimeZoneLabel('Africa/Abidjan', locale).startsWith('Africa/Abidjan')).toBe(true);
    }
  });

  it('does not print the offset twice for zones ICU has no name for', () => {
    // ICU отдаёт вместо названия тот же сдвиг — в ярлыке он должен быть один раз.
    expect(formatTimeZoneLabel('Etc/GMT+5', 'ru')).toBe('Etc/GMT+5 (GMT-05:00)');
    expect(formatTimeZoneLabel('UTC', 'ru')).toBe('UTC (GMT+00:00)');
  });

  it('falls back to the identifier when ICU rejects the zone', () => {
    expect(formatTimeZoneLabel('Not/AZone', 'ru')).toBe('Not/AZone');
  });

  it('answers from cache on the second call, so 418 zones cost one build', () => {
    const first = formatTimeZoneLabel('Asia/Tokyo', 'ru');
    expect(formatTimeZoneLabel('Asia/Tokyo', 'ru')).toBe(first);
    // Другой язык — другой ключ, а не подсунутое из кэша значение.
    expect(formatTimeZoneLabel('Asia/Tokyo', 'ja')).not.toBe(first);
  });
});
