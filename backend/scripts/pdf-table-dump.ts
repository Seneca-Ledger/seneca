/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import { extractTablesFromPdf } from '../src/common/utils/pdf-parser.util';

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error(
      'Usage: ts-node -r tsconfig-paths/register scripts/pdf-table-dump.ts <file> [out.json]',
    );
    process.exit(1);
  }

  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const output = process.argv[3] ? path.resolve(process.argv[3]) : `${filePath}.tables.json`;

  const { rowSets, structured } = await extractTablesFromPdf(filePath);
  const payload = {
    file: filePath,
    rowSets,
    structured,
  };

  await fs.promises.writeFile(output, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Saved table snapshot to ${output}`);
}

main().catch(error => {
  console.error('[!] Failed to dump tables:', error);
  process.exit(1);
});
