import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const graphPath = process.env.LUMIO_GRAPHIFY_GRAPH_PATH
  ? path.resolve(process.env.LUMIO_GRAPHIFY_GRAPH_PATH)
  : path.join(REPO_ROOT, 'graphify-out', 'graph.json');

const ALLOWED_PREFIXES = [
  'backend/src/',
  'frontend/app/',
  'frontend/lib/',
  // The MCP package is gone; the committed graph still cites it until the next build.
  'mcp-server/src/',
  'docs/plans/',
];
const ALLOWED_FILES = new Set(['README.md']);
const UNSAFE_PATTERNS = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.env([^/]*|$)/,
  /(^|\/)uploads(\/|$)/,
  /(^|\/)(dist|build|coverage|\.next)(\/|$)/,
  /\.(pdf|png|jpe?g|gif|webp|svg)(:\w+)?$/i,
];

const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const sources = collectSources(graph);
const violations = [];

for (const source of sources) {
  const normalized = normalizeSource(source);
  if (!normalized || normalized.startsWith('L')) {
    continue;
  }

  if (UNSAFE_PATTERNS.some(pattern => pattern.test(normalized))) {
    violations.push(source);
    continue;
  }

  if (!isAllowedSource(normalized)) {
    violations.push(source);
  }
}

if (violations.length > 0) {
  console.error('Graphify graph contains sources outside the approved corpus:');
  for (const violation of violations.slice(0, 50)) {
    console.error(`- ${violation}`);
  }
  if (violations.length > 50) {
    console.error(`...and ${violations.length - 50} more`);
  }
  process.exit(1);
}

console.log(`Graphify graph source validation passed (${sources.size} cited sources checked).`);

function collectSources(data) {
  const sources = new Set();
  for (const item of [...asArray(data.nodes), ...asArray(data.edges), ...asArray(data.links)]) {
    const sourceFile = stringValue(item.source_file ?? item.sourceFile);
    const sourceLocation = stringValue(item.source_location ?? item.sourceLocation);
    if (sourceFile && sourceLocation && !sourceLocation.includes(sourceFile)) {
      sources.add(`${sourceFile}:${sourceLocation}`);
    } else if (sourceLocation) {
      sources.add(sourceLocation);
    } else if (sourceFile) {
      sources.add(sourceFile);
    }

    for (const key of ['location', 'path', 'file']) {
      const value = stringValue(item[key]);
      if (value) sources.add(value);
    }
  }
  return sources;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value.filter(item => item && typeof item === 'object');
  }

  if (value && typeof value === 'object') {
    return Object.values(value).filter(item => item && typeof item === 'object');
  }

  return [];
}

function isAllowedSource(source) {
  const withoutLine = source.replace(/:L?\d+.*$/, '');
  return ALLOWED_FILES.has(withoutLine) || ALLOWED_PREFIXES.some(prefix => withoutLine.startsWith(prefix));
}

function normalizeSource(source) {
  return source
    .replaceAll('\\', '/')
    .replace(/^file:\/\//, '')
    .replace(`${REPO_ROOT.replaceAll('\\', '/')}/`, '');
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
