import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { issueFor, parseSubmission } from './submission.ts';

const layout = {
  version: 1,
  bankName: 'other',
  institution: 'Northwind Mutual',
  headings: [
    { phrase: 'when', role: 'date' },
    { phrase: 'went out', role: 'debit' },
  ],
  columns: [{ role: 'date', x0: 38, x1: 100 }],
  balances: { start: 'brought forward' },
  appVersion: '1.0.0',
};

describe('parseSubmission', () => {
  it('takes a taught layout', () => {
    const parsed = parseSubmission(layout);
    assert.equal(parsed.ok, true);
  });

  it('refuses keys no layout has, such as rows or a file', () => {
    for (const extra of [{ transactions: [] }, { file: 'JVBERi0=' }]) {
      const parsed = parseSubmission({ ...layout, ...extra });
      assert.equal(parsed.ok, false);
    }
  });

  it('refuses words that would turn into markup or a mention in the issue', () => {
    for (const phrase of ['`code`', '@someone', '<img src=x>', 'a | b', '[link](x)']) {
      const parsed = parseSubmission({ ...layout, headings: [{ phrase, role: 'date' }] });
      assert.equal(parsed.ok, false, phrase);
    }
  });

  it('refuses roles, coordinates and sizes outside a layout', () => {
    const cases = [
      { ...layout, headings: [{ phrase: 'when', role: 'password' }] },
      { ...layout, columns: [{ role: 'date', x0: -1, x1: 10 }] },
      { ...layout, headings: Array.from({ length: 31 }, () => ({ phrase: 'x', role: 'date' })) },
      { ...layout, institution: 'x'.repeat(81) },
      { ...layout, bankName: 'Other Bank!' },
      { ...layout, headings: [], columns: [] },
      { ...layout, version: 2 },
      'not an object',
    ];
    for (const body of cases) {
      assert.equal(parseSubmission(body).ok, false, JSON.stringify(body).slice(0, 60));
    }
  });
});

describe('issueFor', () => {
  it('titles the issue by the bank and carries the layout as JSON', () => {
    const parsed = parseSubmission(layout);
    assert.ok(parsed.ok);
    const issue = issueFor(parsed.submission);
    assert.equal(issue.title, 'Layout: Northwind Mutual');
    assert.match(issue.body, /- debit: went out/);
    assert.match(issue.body, /"phrase": "when"/);
    assert.deepEqual(issue.labels, ['layout']);
  });
});
