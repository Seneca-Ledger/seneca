import { describe, expect, it } from 'vitest';
import { text } from './dashboard-helpers';

describe('text', () => {
  it('reads an intlayer node, whose value the proxy answers but the element does not hold', () => {
    const element = { $$typeof: Symbol.for('react.element'), props: { children: 'Paid' } };
    const node = new Proxy(element, {
      get: (target, prop) => (prop === 'value' ? 'Paid' : Reflect.get(target, prop)),
    });
    expect('value' in node).toBe(false);
    expect(text(node)).toBe('Paid');
  });

  it('passes a string through and gives nothing for anything else', () => {
    expect(text('Unpaid')).toBe('Unpaid');
    expect(text(null)).toBe('');
    expect(text({ value: 3 })).toBe('');
  });
});
