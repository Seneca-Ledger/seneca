import { describe, expect, it } from 'vitest';
import { findHardcodedStrings } from '../../scripts/find-hardcoded-strings.mjs';

// Every user-facing string comes from a dictionary (*.content.ts), in every
// locale. A hit lists file:line; move the text into the component's content
// file, or add it to ALLOWED in the script if it reads the same in every
// language (a brand, a file format).
describe('no hard-coded user-facing strings', () => {
  // Parses every source file: a few seconds, longer while other files run.
  it('finds none under app/, components/ and lib/', { timeout: 60_000 }, () => {
    const hits = findHardcodedStrings().map(hit => `${hit.file}:${hit.line} [${hit.rule}] ${hit.text}`);
    expect(hits).toEqual([]);
  });
});
