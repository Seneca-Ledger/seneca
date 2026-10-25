// Writes one module per locale that gathers every dictionary in that locale:
// .intlayer/locale_pack/<locale>.mjs. The browser loads only the pack of the
// current language (app/i18n.ts); the 35-locale dictionaries stay on the server.
//
// Input is intlayer's own per-locale output (.intlayer/dynamic_dictionary/json/
// <key>/<locale>.json, written because importMode is 'dynamic'). The packs
// import those files rather than copy them, so a later `intlayer build` that
// only changes texts shows up without running this again; a new dictionary
// key does need it (postinstall and prebuild run both).
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const intlayerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.intlayer');
const sourceDir = path.join(intlayerDir, 'dynamic_dictionary', 'json');
const packDir = path.join(intlayerDir, 'locale_pack');

// --if-present: postinstall also runs where no content exists yet (the Docker
// deps stage installs before the source is copied).
const ifPresent = process.argv.includes('--if-present');

const files = (await readdir(sourceDir, { recursive: true }).catch(() => [])).filter(file =>
  file.endsWith('.json'),
);
if (files.length === 0) {
  if (ifPresent) {
    process.exit(0);
  }
  throw new Error(`No per-locale dictionaries in ${sourceDir}: run intlayer build first.`);
}

const byLocale = new Map();
for (const file of files) {
  const key = path.dirname(file);
  const locale = path.basename(file, '.json');
  if (!byLocale.has(locale)) {
    byLocale.set(locale, []);
  }
  byLocale.get(locale).push({ key, file });
}

await rm(packDir, { recursive: true, force: true });
await mkdir(packDir, { recursive: true });
for (const [locale, entries] of byLocale) {
  entries.sort((a, b) => a.key.localeCompare(b.key));
  const imports = entries.map(
    ({ file }, i) =>
      `import d${i} from '../dynamic_dictionary/json/${file}' with { type: 'json' };`,
  );
  const fields = entries.map(({ key }, i) => `  ${JSON.stringify(key)}: d${i},`);
  await writeFile(
    path.join(packDir, `${locale}.mjs`),
    `${imports.join('\n')}\n\nexport default {\n${fields.join('\n')}\n};\n`,
  );
}

console.log(
  `Locale packs: ${byLocale.size} locales × ${files.length / byLocale.size} dictionaries`,
);
