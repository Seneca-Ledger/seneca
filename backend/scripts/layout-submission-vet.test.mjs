import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { caseNameOf, registryEntry, registryOf, vetSubmission, withEntry } from './layout-submission-vet.mjs';

const good = {
  version: 1,
  bankName: 'other',
  institution: 'Northwind Mutual',
  headings: [
    { phrase: 'Value Date', role: 'date' },
    { phrase: 'Narration', role: 'description' },
    { phrase: 'Withdrawal Amt.', role: 'debit' },
  ],
  columns: [],
  balances: {},
  evidence: { rows: 6, balanceChain: 'passed', printedTotals: 'unchecked', statementsRead: 2 },
};
const data = `// header\nimport type { ContributedLayout } from './contributed-layouts';\n\nexport const CONTRIBUTED_LAYOUT_DATA: ContributedLayout[] = [];\n`;

describe('vetSubmission', () => {
  it('proposes a layout that names its bank, has its columns and read with its balances holding', () => {
    assert.deepEqual(vetSubmission(good), { refusals: [], warnings: [] });
  });

  it('refuses what cannot be trusted or placed', () => {
    const cases = [
      [{ ...good, institution: undefined }, /names no bank/],
      [{ ...good, bankName: 'axis' }, /parser of its own/],
      [{ ...good, headings: good.headings.slice(1) }, /date or a description/],
      [{ ...good, headings: good.headings.slice(0, 2) }, /money column/],
      [{ ...good, evidence: undefined }, /no reading reported/],
      [{ ...good, evidence: { ...good.evidence, rows: 2 } }, /too few/],
      [{ ...good, evidence: { ...good.evidence, balanceChain: 'failed' } }, /neither the running balance/],
    ];
    for (const [submission, reason] of cases) {
      const { refusals } = vetSubmission(submission);
      assert.ok(refusals.some(refusal => reason.test(refusal)), String(reason));
    }
    assert.match(vetSubmission(good, [registryEntry(good)]).refusals[0], /already in CONTRIBUTED_LAYOUTS/);
  });

  it('flags common words and a single statement for a look, without refusing', () => {
    const { refusals, warnings } = vetSubmission({
      ...good,
      headings: [...good.headings, { phrase: 'Left', role: 'balance' }],
      evidence: { ...good.evidence, statementsRead: 1 },
    });
    assert.deepEqual(refusals, []);
    assert.match(warnings.join('\n'), /"Left" \(balance\)/);
    assert.match(warnings.join('\n'), /single statement/);
  });
});

describe('the registry file', () => {
  it('takes an entry as JSON and reads it back, whatever the headings hold', () => {
    const tricky = { ...good, headings: [...good.headings, { phrase: "Holder's \"ref\" ];", role: 'other' }] };
    const once = withEntry(data, registryEntry(tricky));
    assert.equal(registryOf(once).length, 1);
    assert.equal(registryOf(once)[0].headings.at(-1).phrase, 'holder\'s "ref" ];');
    assert.match(once, /^\/\/ header/);
    const twice = withEntry(once, registryEntry({ ...good, institution: 'Example Savings' }));
    assert.deepEqual(
      registryOf(twice).map(entry => entry.names[0]),
      ['northwind mutual', 'example savings'],
    );
  });

  it('names the golden case after the bank', () => {
    assert.equal(caseNameOf({ institution: 'Banco Ação & Co.' }), 'banco-acao-co');
  });
});
