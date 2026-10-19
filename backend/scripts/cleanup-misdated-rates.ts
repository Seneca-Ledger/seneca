import { AppDataSource } from '../src/data-source';

const HELP_TEXT = `
Usage: npm run cleanup:misdated-rates -- [--dry-run]

Deletes exchange rates the paid API stored under a past date. Only its
"latest" endpoint is on our tier, yet a lookup for a past day used to save
those rates under that day, and saveRate never overwrites, so the wrong rate
stuck. A deleted row is fetched again, for its real date, on the next lookup.
Restart the backend afterwards: it caches historical rates in memory for good.

Options:
  --dry-run   Count the rows, per currency pair, without deleting
  --help      Show this help
`;

// 'computed' rows are USD cross rates built from the same latest-only calls.
const MISDATED = `
  FROM exchange_rates
 WHERE source IN ('exchangerate-api', 'computed')
   AND rate_date < created_at::date
`;

async function cleanupMisdatedRates() {
  const args = new Set(process.argv.slice(2));

  if (args.has('--help') || args.has('-h')) {
    console.log(HELP_TEXT.trim());
    return;
  }

  const isDryRun = args.has('--dry-run') || args.has('--dryrun');

  try {
    console.log('Initializing data source...');
    await AppDataSource.initialize();

    const pairs: Array<{
      pair: string;
      rows: string;
      first: string;
      last: string;
    }> = await AppDataSource.query(`
        SELECT base_currency || '->' || target_currency AS pair, count(*) AS rows,
               min(rate_date)::text AS first, max(rate_date)::text AS last
        ${MISDATED}
        GROUP BY 1 ORDER BY count(*) DESC
      `);
    const total = pairs.reduce((sum, pair) => sum + Number(pair.rows), 0);

    if (isDryRun) {
      for (const pair of pairs) {
        console.log(`  ${pair.pair}: ${pair.rows} rows, ${pair.first} .. ${pair.last}`);
      }
      console.log(`Dry run: ${total} misdated rates would be deleted.`);
      return;
    }

    if (total === 0) {
      console.log('No misdated rates found.');
      return;
    }

    const [, deleted] = await AppDataSource.query(`DELETE ${MISDATED}`);
    console.log(`Deleted ${deleted} misdated rates.`);
  } catch (error) {
    console.error('Failed to clean up misdated rates:', error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

cleanupMisdatedRates();
