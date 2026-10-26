import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A query keyed by the workspace must wait for it. In a fresh browser (a new
 * account, a new device) nothing is stored yet, the first render has no
 * workspace, and the request leaves without X-Workspace-Id: the server answers
 * 403 "Workspace context is required" before the real request follows.
 */
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'contracts' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** The `{ … }` options of every `useQuery({` call, braces balanced. */
function queryOptions(source: string): string[] {
  const blocks: string[] = [];
  for (const match of source.matchAll(/use(?:Suspense)?Query\(\{/g)) {
    let index = (match.index ?? 0) + match[0].length;
    for (let depth = 1; depth > 0 && index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') depth -= 1;
    }
    blocks.push(source.slice(match.index, index));
  }
  return blocks;
}

/** Keyed by the workspace: inline in the key, or a `queryKey` variable built from it. */
function keyedByWorkspace(block: string, source: string): boolean {
  const inline = /queryKey:\s*([^\n]*)/.exec(block);
  if (inline) return inline[1].includes('workspaceId');
  return /\n\s*queryKey,/.test(block) && /const queryKey = [^\n]*workspaceId/.test(source);
}

describe('workspace-keyed queries', () => {
  it('wait for the workspace before they run', () => {
    const offenders = sourceFiles(APP).flatMap(file => {
      const source = readFileSync(file, 'utf8');
      return queryOptions(source)
        .filter(block => keyedByWorkspace(block, source) && !/\benabled\s*:/.test(block))
        .map(() => path.relative(APP, file));
    });
    expect(offenders).toEqual([]);
  });
});
