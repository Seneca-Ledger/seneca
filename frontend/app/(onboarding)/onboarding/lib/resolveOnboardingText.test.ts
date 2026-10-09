import { describe, expect, it } from 'vitest';
import { resolveOnboardingText } from './resolveOnboardingText';

describe('resolveOnboardingText', () => {
  it('reads localized value from token.value map with region locale', () => {
    const token = { value: { ru: 'Старт', en: 'Start' } };

    expect(resolveOnboardingText(token, 'Welcome', 'ru-RU')).toBe('Старт');
  });

  it('reads localized value from direct token map', () => {
    const token = { ru: 'Пропустить', en: 'Skip' };

    expect(resolveOnboardingText(token, 'Skip', 'ru')).toBe('Пропустить');
  });

  it('prefers token stringification when available', () => {
    const token = {
      value: 'Start',
      toString() {
        return 'Старт';
      },
    };

    expect(resolveOnboardingText(token, 'Welcome', 'ru')).toBe('Старт');
  });

  it('reads the value of an intlayer node the `in` operator cannot see', () => {
    // react-intlayer returns its nodes as proxies: `value` answers a read but not
    // `'value' in node`, which used to send every string to the English fallback.
    const node = new Proxy(
      { $$typeof: Symbol.for('react.element') },
      {
        get: (target, key) => (key === 'value' ? 'Richten Sie Ihren Arbeitsbereich ein' : Reflect.get(target, key)),
      },
    );

    expect(resolveOnboardingText(node, 'Set up your workspace', 'de')).toBe(
      'Richten Sie Ihren Arbeitsbereich ein',
    );
  });
});
