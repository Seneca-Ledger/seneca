import { INSIGHT_TRANSLATIONS, renderInsight } from '@/modules/insights/insight-translations';
import { STOIC_TEXTS } from '@/modules/insights/stoic-texts';

const placeholders = (text: string) =>
  [...text.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort();

describe('Stoic texts', () => {
  const en = STOIC_TEXTS.en;

  it('has all 35 locales', () => {
    expect(Object.keys(STOIC_TEXTS)).toHaveLength(35);
  });

  // Советы без стоических ключей (operational.*, trend.*, pattern.*) живут
  // в другой карте — её никто не сторожил, хотя рисуется она тем же renderInsight.
  it.each(Object.keys(STOIC_TEXTS))('%s: non-stoic advice is translated too', locale => {
    const map = INSIGHT_TRANSLATIONS[locale];
    expect(map).toBeDefined();
    for (const key of Object.keys(INSIGHT_TRANSLATIONS.en)) {
      const entry = map[key as keyof typeof map];
      expect({ key, has: Boolean(entry?.title && entry?.message) }).toEqual({ key, has: true });
      expect({ key, got: placeholders(entry.title + entry.message) }).toEqual({
        key,
        got: placeholders(
          INSIGHT_TRANSLATIONS.en[key as keyof typeof map].title +
            INSIGHT_TRANSLATIONS.en[key as keyof typeof map].message,
        ),
      });
    }
  });

  it.each(Object.keys(STOIC_TEXTS))(
    '%s: every wording uses exactly the placeholders of its English twin',
    locale => {
      const map = STOIC_TEXTS[locale];
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(map[key]).toHaveLength(5);
        map[key].forEach((variant, index) => {
          const source = en[key][index];
          expect({ key, index, got: placeholders(variant.title + variant.message) }).toEqual({
            key,
            index,
            got: placeholders(source.title + source.message),
          });
        });
      }
    },
  );

  it('picks the wording by variant and wraps around', () => {
    const params = { planned: 10, actual: 31 };
    const titles = [0, 1, 2, 3, 4].map(
      variant => renderInsight('en', 'stoic.leisure_over_plan', { ...params, variant }).title,
    );
    expect(new Set(titles).size).toBe(5);
    expect(renderInsight('en', 'stoic.leisure_over_plan', { ...params, variant: 7 }).title).toBe(
      titles[2],
    );
  });

  it('formats money and dates in the reader locale', () => {
    const params = {
      date: '2026-10-05',
      lowestAmount: -250,
      committedAmount: 1800,
      currency: 'EUR',
      variant: 4,
    };
    expect(renderInsight('en', 'stoic.shortfall', params)).toEqual({
      title: 'Foresee the gap on October 5',
      message:
        'Projected lowest balance: -€250. What is foreseen can be met with composure; what surprises us, rarely.',
    });
    const de = renderInsight('de', 'stoic.shortfall', params);
    expect(de.title + de.message).toContain('5. Oktober');
  });
});
