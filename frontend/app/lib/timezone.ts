/**
 * Два формата Intl на зону, а зон 418: замер в дев-контейнере — ~0,4 с на
 * весь список при холодном ICU и ~0,2 с при тёплом. Без кэша это повторялось
 * бы на каждый ререндер. Ключ включает язык: тот же Europe/Berlin читается
 * по-разному на каждом.
 */
const timeZoneLabelCache = new Map<string, string>();

const zoneName = (
  zone: string,
  locale: string,
  style: 'longGeneric' | 'longOffset',
): string | null => {
  try {
    return (
      new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style })
        .formatToParts(new Date())
        .find(part => part.type === 'timeZoneName')?.value ?? null
    );
  } catch {
    // Зона, которой не знает ICU: ярлыком остаётся сам идентификатор.
    return null;
  }
};

/**
 * Строка часового пояса на языке читателя: «Europe/Berlin — Центральная Европа (GMT+02:00)».
 *
 * Идентификатор остаётся первым и целиком. Он держит список отсортированным
 * по континентам и различает зоны, которым ICU даёт одно имя на всех: на 418
 * зон приходится лишь ~164 разных названия, так что «Центральная Европа» —
 * это и Берлин, и Париж, и Мадрид. Локализованных названий городов ни один
 * Intl-API не отдаёт, поэтому город и читается из идентификатора.
 */
export const formatTimeZoneLabel = (zone: string, locale: string): string => {
  const cacheKey = `${locale}|${zone}`;
  const cached = timeZoneLabelCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const offset = zoneName(zone, locale, 'longOffset');
  const name = zoneName(zone, locale, 'longGeneric');
  // У зон без собственного имени ICU возвращает вместо него тот же самый
  // сдвиг — печатать его дважды незачем.
  const named = name && name !== offset ? name : null;
  const label = offset ? `${zone}${named ? ` — ${named}` : ''} (${offset})` : (named ?? zone);

  timeZoneLabelCache.set(cacheKey, label);
  return label;
};
