import { describe, expect, it } from 'vitest';
import {
  BACKEND_FALLBACK_COLOR,
  CATEGORY_DEFAULTS,
  NEUTRAL_CATEGORY_COLOR,
  categoryColorFor,
  resolveCategoryVisual,
} from './category-defaults';
import { categoryIconFor } from './category-icon-choices';
import systemCategories from './systemCategories.content';

describe('category-defaults', () => {
  it('has a default for every system category slug', () => {
    const slugs = Object.keys(systemCategories.content);
    const missing = slugs.filter(slug => !CATEGORY_DEFAULTS[slug]);
    expect(missing).toEqual([]);
  });

  it('uses the stored colour when the row has one', () => {
    expect(categoryColorFor('Rent', '#123456')).toBe('#123456');
  });

  it('ignores the backend placeholder colour and null', () => {
    expect(categoryColorFor('Rent', BACKEND_FALLBACK_COLOR)).toBe(CATEGORY_DEFAULTS.rent.color);
    expect(categoryColorFor('Rent', null)).toBe(CATEGORY_DEFAULTS.rent.color);
  });

  it('resolves Russian and Kazakh names to the same default', () => {
    expect(categoryColorFor('Аренда', null)).toBe(CATEGORY_DEFAULTS.rent.color);
    expect(resolveCategoryVisual({ name: 'Жалға алу' }).Icon).toBe(CATEGORY_DEFAULTS.rent.Icon);
  });

  it('falls back to neutral colour and the tag glyph for unknown names', () => {
    const visual = resolveCategoryVisual({ name: 'Groceries', color: null });
    expect(visual.color).toBe(NEUTRAL_CATEGORY_COLOR);
    expect(visual.Icon).toBe(CATEGORY_DEFAULTS.uncategorized.Icon);
    expect(visual.iconUrl).toBeNull();
  });

  it('uses an icon picked in the category editor over the default by name', () => {
    const visual = resolveCategoryVisual({ name: 'Rent', icon: 'mdi:airplane' });
    expect(visual.Icon).toBe(categoryIconFor('mdi:airplane'));
    expect(visual.Icon).not.toBe(CATEGORY_DEFAULTS.rent.Icon);
    expect(visual.iconUrl).toBeNull();
  });

  it('keeps uploaded icon URLs', () => {
    const visual = resolveCategoryVisual({ name: 'Rent', icon: 'https://cdn.test/rent.png' });
    expect(visual.iconUrl).toBe('https://cdn.test/rent.png');
  });

  it('marks the Other rollup with the neutral colour', () => {
    const visual = resolveCategoryVisual({ name: 'Other', isOther: true, color: '#ff0000' });
    expect(visual.color).toBe(NEUTRAL_CATEGORY_COLOR);
  });
});
