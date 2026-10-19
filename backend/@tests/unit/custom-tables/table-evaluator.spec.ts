import {
  TableEvaluator,
  orderFormulaColumns,
} from '../../../src/modules/custom-tables/helpers/table-evaluator';

const rows = () => [
  { amount: 100, category: 'Food', income: 0 },
  { amount: 250, category: 'Transport', income: 1000 },
  { amount: 50, category: 'food', income: 0 },
  { amount: '', category: 'Rent', income: 400 },
];

describe('TableEvaluator', () => {
  it('computes column totals, shares of total and conditional sums per row', () => {
    const evaluator = new TableEvaluator(rows());
    evaluator.computeAll([
      { key: 'share', expression: '[amount] / SUM([amount])' },
      { key: 'catTotal', expression: 'SUMIF([amount], [category], [category])' },
      { key: 'catCount', expression: 'COUNTIF([category], "food")' },
    ]);
    expect(evaluator.rows.map(row => row.share)).toEqual([0.25, 0.625, 0.125, 0]);
    // Criteria match ignores case: Food and food fall into one bucket.
    expect(evaluator.rows.map(row => row.catTotal)).toEqual([150, 250, 150, 0]);
    expect(evaluator.rows[0].catCount).toBe(2);
  });

  it('walks the rows in order for PREV and RUNNING_SUM, including a self-referencing balance', () => {
    const evaluator = new TableEvaluator(rows());
    evaluator.computeAll([
      { key: 'running', expression: 'RUNNING_SUM([amount])' },
      { key: 'balance', expression: 'PREV([balance]) + [income] - [amount]' },
      { key: 'delta', expression: '[amount] - PREV([amount])' },
      { key: 'n', expression: 'ROW()' },
    ]);
    expect(evaluator.rows.map(row => row.running)).toEqual([100, 350, 400, 400]);
    expect(evaluator.rows.map(row => row.balance)).toEqual([-100, 650, 600, 1000]);
    expect(evaluator.rows.map(row => row.delta)).toEqual([100, 150, -200, -50]);
    expect(evaluator.rows.map(row => row.n)).toEqual([1, 2, 3, 4]);
  });

  it('lets a formula aggregate another formula column once that column is complete', () => {
    const evaluator = new TableEvaluator(rows());
    evaluator.computeAll([
      { key: 'net', expression: '[income] - [amount]' },
      { key: 'netShare', expression: '[net] / SUM([net])' },
    ]);
    expect(evaluator.rows.map(row => row.net)).toEqual([-100, 750, -50, 400]);
    expect(evaluator.rows[1].netShare).toBeCloseTo(0.75);
  });

  it('gives summaries the whole-table context without a current row', () => {
    const evaluator = new TableEvaluator(rows());
    const context = evaluator.summaryContext();
    expect(context.aggregate('sum', 'amount')).toBe(400);
    expect(context.aggregate('avg', 'income')).toBe(350);
    expect(context.aggregate('count', 'amount')).toBe(3);
    expect(context.aggregate('counta', 'category')).toBe(4);
    expect(context.conditional('averageif', 'amount', 'category', 'food')).toBe(75);
    expect(context.runningSum('amount')).toBe(400);
  });
});

describe('orderFormulaColumns', () => {
  it('orders dependencies first and ignores references inside PREV', () => {
    const ordered = orderFormulaColumns([
      { key: 'c', expression: '[b] + PREV([c])' },
      { key: 'a', expression: '[x] * 2' },
      { key: 'b', expression: '[a] + 1' },
    ]);
    expect(ordered.map(col => col.key)).toEqual(['a', 'b', 'c']);
  });
});
