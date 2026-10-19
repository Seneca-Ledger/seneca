import { describe, expect, it, vi } from 'vitest';
import {
  applyTemplate,
  buildTemplateColumnPayloads,
  substituteFormulaKeys,
  TABLE_TEMPLATES,
} from './templates';

describe('TABLE_TEMPLATES', () => {
  it.each(TABLE_TEMPLATES.map(t => [t.id, t] as const))('%s has unique keys', (_id, template) => {
    const keys = template.columns.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only references known columns from formulas', () => {
    for (const template of TABLE_TEMPLATES) {
      const keys = new Set(template.columns.map(c => c.key));
      for (const column of template.columns) {
        const expression = column.config?.expression;
        if (typeof expression !== 'string') continue;
        for (const [, ref] of expression.matchAll(/\[([^\]]+)\]/g)) {
          expect(keys.has(ref)).toBe(true);
        }
      }
    }
  });
});

describe('buildTemplateColumnPayloads', () => {
  it('injects the workspace currency into money columns and translated titles', () => {
    const pipeline = TABLE_TEMPLATES.find(t => t.id === 'pipeline');
    if (!pipeline) throw new Error('missing template');

    const payloads = buildTemplateColumnPayloads(pipeline, {
      titles: { amount: 'Сумма' },
      currency: 'EUR',
    });

    const amount = payloads.find(p => p.templateKey === 'amount');
    expect(amount?.body).toEqual({
      title: 'Сумма',
      type: 'currency',
      isRequired: false,
      isUnique: false,
      config: { precision: 2, currency: 'EUR' },
    });
    // Без перевода — английское название из шаблона.
    expect(payloads.find(p => p.templateKey === 'deal')?.body.title).toBe('Deal');
    expect(payloads.find(p => p.templateKey === 'deal')?.body.isRequired).toBe(true);
  });
});

describe('substituteFormulaKeys', () => {
  it('maps template keys to server keys and leaves unknown ones alone', () => {
    expect(
      substituteFormulaKeys('[amount] * [probability] / 100', { amount: 'col_a' }),
    ).toBe('[col_a] * [probability] / 100');
  });
});

describe('applyTemplate', () => {
  it('posts columns in order and rewrites formulas with the keys the server returned', async () => {
    const budget = TABLE_TEMPLATES.find(t => t.id === 'budget');
    if (!budget) throw new Error('missing template');
    const payloads = buildTemplateColumnPayloads(budget, { titles: {}, currency: 'USD' });
    const post = vi.fn(async (_url: string, body: { title: string }) => ({
      key: `srv_${body.title.toLowerCase().replace(/\W+/g, '')}`,
    }));

    const result = await applyTemplate({ tableId: 't1', payloads, post });

    expect(result.failed).toEqual([]);
    expect(post).toHaveBeenCalledTimes(budget.columns.length);
    expect(post.mock.calls.every(([url]) => url === '/custom-tables/t1/columns')).toBe(true);
    const variance = post.mock.calls.find(([, body]) => body.title === 'Variance')?.[1] as {
      config?: { expression?: string; currency?: string };
    };
    expect(variance.config?.expression).toBe('[srv_actual] - [srv_planned]');
    // Денежная формула считает в валюте воркспейса.
    expect(variance.config?.currency).toBe('USD');
  });

  it('keeps going after a failed column and reports it', async () => {
    const payloads = buildTemplateColumnPayloads(TABLE_TEMPLATES[0], { titles: {}, currency: 'USD' });
    const post = vi.fn(async (_url: string, body: { title: string }) => {
      if (body.title === 'Client') throw new Error('boom');
      return { key: `k_${body.title}` };
    });

    const result = await applyTemplate({ tableId: 't1', payloads, post });

    expect(result.failed).toEqual(['client']);
    expect(post).toHaveBeenCalledTimes(payloads.length);
  });
});
