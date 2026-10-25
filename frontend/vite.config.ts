import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vinext from 'vinext';
import { defineConfig, type Plugin } from 'vite';
import { intlayer } from 'vite-intlayer';

const root = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DICTIONARIES_ENTRY = path.join(root, 'app/lib/client-dictionaries-entry.ts');
const DICTIONARY_ENTRIES = new Set([
  '@intlayer/dictionaries-entry',
  '@intlayer/dictionaries-entry/unmerged',
]);
const GENERATED_ENTRY = /\.intlayer\/main\/(unmerged_)?dictionaries\.[cm]?js$/;

// Browser bundles get empty dictionary entries:
// components read the current language's pack, so the 35-locale dictionaries stay on the server.
const clientDictionaries = (): Plugin => ({
  name: 'seneca:client-dictionaries',
  enforce: 'pre',
  resolveId(source) {
    // vite-intlayer aliases the entries to the generated files before this runs.
    const isEntry = DICTIONARY_ENTRIES.has(source) || GENERATED_ENTRY.test(source);
    if (this.environment?.name === 'client' && isEntry) {
      return CLIENT_DICTIONARIES_ENTRY;
    }
    return null;
  },
});

export default defineConfig({
  // Docker publishes the port, so the dev server listens beyond loopback.
  server: { host: '0.0.0.0', port: 3000, strictPort: true },
  plugins: [
    clientDictionaries(),
    // The language lives in a cookie, not in the URL: no /ru/... locale routing.
    intlayer({ proxy: { ignore: () => true } }),
    vinext({ react: { compiler: true } }),
  ],
});
