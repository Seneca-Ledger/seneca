import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evidenceLine, issueFor, layoutKey, parseSubmission, type Submission } from './submission.ts';

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
  evidence: { rows: 6, balanceChain: 'passed', printedTotals: 'unchecked', statementsRead: 2 },
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
      { ...layout, evidence: { rows: -1, balanceChain: 'passed', printedTotals: 'passed', statementsRead: 1 } },
      { ...layout, evidence: { rows: 1, balanceChain: 'yes', printedTotals: 'passed', statementsRead: 1 } },
      { ...layout, evidence: { rows: 1, balanceChain: 'passed', printedTotals: 'passed', statementsRead: 1, note: 'x' } },
      'not an object',
    ];
    for (const body of cases) {
      assert.equal(parseSubmission(body).ok, false, JSON.stringify(body).slice(0, 60));
    }
  });
});

const parsed = (body: unknown): Submission => {
  const result = parseSubmission(body);
  assert.ok(result.ok);
  return result.submission;
};

describe('layoutKey', () => {
  it('is the same for the same headings whatever their roles or order, and differs otherwise', async () => {
    const swapped = parsed({
      ...layout,
      headings: [
        { phrase: 'Went Out', role: 'credit' },
        { phrase: 'when', role: 'date' },
      ],
    });
    assert.equal(await layoutKey(parsed(layout)), await layoutKey(swapped));
    const other = parsed({ ...layout, headings: [{ phrase: 'value date', role: 'date' }] });
    assert.notEqual(await layoutKey(parsed(layout)), await layoutKey(other));
    assert.match(await layoutKey(parsed(layout)), /^[0-9a-f]{12}$/);
  });
});

describe('evidenceLine', () => {
  it('says what the sender reported, or that nothing was', () => {
    assert.match(evidenceLine(parsed(layout)), /6 rows · running balance passed · printed totals not checked · 2 statement/);
    const { evidence: _evidence, ...bare } = layout;
    assert.equal(evidenceLine(parsed(bare)), '**Reading:** not reported');
  });
});

describe('issueFor', () => {
  it('titles the issue by the bank and carries the key, the reading and the layout as JSON', () => {
    const issue = issueFor(parsed(layout), 'abc123abc123');
    assert.equal(issue.title, 'Layout: Northwind Mutual');
    assert.match(issue.body, /- debit: went out/);
    assert.match(issue.body, /Layout key:\*\* `abc123abc123`/);
    assert.match(issue.body, /running balance passed/);
    assert.match(issue.body, /"phrase": "when"/);
    assert.deepEqual(issue.labels, ['layout', 'key:abc123abc123']);
  });
});
