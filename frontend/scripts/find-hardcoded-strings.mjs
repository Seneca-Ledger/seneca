// Finds user-facing text written straight into components instead of coming
// from an intlayer dictionary (*.content.ts). Run: node scripts/find-hardcoded-strings.mjs
// app/lib/no-hardcoded-strings.test.ts fails on any hit, so CI keeps it at zero.
//
// What counts as user-facing: JSX text, string props a person reads (title,
// placeholder, aria-label, …), literals reaching JSX through ?: / && / || / ??,
// the first argument of toast/confirm/alert, getApiErrorMessage fallbacks,
// defaults of such props, and label/title/description fields in objects.
// Brand names, file formats and technical samples are listed in ALLOWED below.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ts = createRequire(import.meta.url)('typescript');

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'components', 'lib'];
// Generated contract copies carry developer-facing validation messages; tests,
// dictionaries and fixtures are not shown to anyone.
const SKIP_DIRS = new Set(['node_modules', '.intlayer', 'dist', 'test', '__mocks__', '__tests__']);
// The web app manifest is one file for every visitor (fetched without cookies,
// cached by the service worker and by the OS on install), so it has no language.
// vendor-icons maps vendor names (brands) to their logos.
const SKIP_PATHS = ['app/lib/contracts/', 'app/manifest.ts', 'app/vendor-icons/'];
// *-translations.ts are dictionaries too: tables keyed by locale, checked by TypeScript.
const SKIP_FILE = /(\.(test|spec|content|stories|d|fixtures)\.tsx?|-translations\.ts)$/;

// biome-ignore format: grouped by kind, one group per line
const PROPS = new Set([
  'title', 'placeholder', 'aria-label', 'alt', 'label', 'helperText', 'tooltip',
  'description', 'emptyText', 'emptyMessage', 'subtitle', 'heading', 'caption', 'message',
  'confirmText', 'cancelText', 'submitLabel', 'buttonText', 'text', 'ariaLabel', 'errorText',
  'hint', 'header', 'headerName',
]);
const CALLS = /^(toast(\.\w+)?|alert|confirm|window\.confirm|window\.alert)$/;
const ERROR_FALLBACKS = /(^|\.)(getApiErrorMessage|getErrorMessage)$/;
// Parameters meant to hold display text, e.g. `manualLabel = 'Manual'`.
const TEXT_PARAM = /(label|title|text|message|caption|placeholder|fallback)$/i;
// Helpers that look a text up and take an English stand-in after the key.
const TRANSLATE_HELPER =
  /(^|\.)(tx|resolveLabel|resolveText|resolveTranslation\w*|labelValue|translate|getLabel)$/;
// A first argument read from a dictionary: `t.x`, `labels.x`, `content.x`, `messages.x`.
const DICTIONARY_REF = /^(t|labels|content|messages|texts|dict|copy)(\?\.|\.)/;

/** Text that reads the same in every language: names, formats, codes, samples. */
// biome-ignore format: grouped by kind, one group per line
export const ALLOWED = new Set([
  // brands and products
  'Openverse', 'Telegram', 'Excel', 'Deutsche Telekom', 'Google Drive', 'Nextcloud (WebDAV)', 'bridge.simplefin.org',
  // file formats and units of a format
  'PDF', 'XLSX', 'CSV', 'Excel (.xlsx)', 'PDF (.pdf)', 'CSV (.csv)', 'Word (.docx)', 'Excel / CSV',
  // official form codes (German DATEV / UStVA)
  'SKR 03', 'SKR 04', 'Kz', 'Kz 83',
  // input samples and token prefixes
  '0x… · T… · bc1… · Solana', 'finance@example.com', '123456:ABC', 'lum_', '-export.zip',
  'SUM([Income]) - SUM([Expense])', '[Amount] * [Qty]',
]);

const hasWords = text => /\p{L}{2,}/u.test(text);
const isTechnical = text =>
  /^(https?:|\/|#)/.test(text) ||
  /^[A-Z0-9_]+$/.test(text) ||
  (/^[a-z][a-zA-Z0-9]*$/.test(text) && !/\s/.test(text));
const isLiteral = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
const readable = text => hasWords(text) && !isTechnical(text) && !ALLOWED.has(text.trim());

const LOGICAL = () => [
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
];

/** `{busy ? 'Saving…' : 'Save'}`, `{label ?? 'Bank'}`: the JSX expression it lands in. */
function jsxContainerThroughLogic(node) {
  let parent = node.parent;
  let passed = false;
  while (
    parent &&
    (ts.isConditionalExpression(parent) ||
      ts.isBinaryExpression(parent) ||
      ts.isParenthesizedExpression(parent))
  ) {
    if (ts.isBinaryExpression(parent) && !LOGICAL().includes(parent.operatorToken.kind))
      return null;
    if (ts.isConditionalExpression(parent) && parent.condition === node) return null;
    if (!ts.isParenthesizedExpression(parent)) passed = true;
    node = parent;
    parent = parent.parent;
  }
  return passed && parent && ts.isJsxExpression(parent) ? parent : null;
}

const readsAsText = container => {
  const host = container.parent;
  if (!host) return false;
  if (ts.isJsxElement(host) || ts.isJsxFragment(host)) return true;
  return ts.isJsxAttribute(host) && PROPS.has(host.name.getText());
};

function scanSource(file, source) {
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const hits = [];
  const add = (node, rule, text) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    hits.push({ file, line: line + 1, rule, text: text.replace(/\s+/g, ' ').trim() });
  };

  const visit = node => {
    if (ts.isJsxText(node)) {
      const text = node.getText().trim();
      if (text && readable(text)) add(node, 'jsx-text', text);
    } else if (ts.isJsxAttribute(node) && node.initializer && PROPS.has(node.name.getText())) {
      const init = node.initializer;
      const literal = isLiteral(init)
        ? init
        : ts.isJsxExpression(init) && init.expression && isLiteral(init.expression)
          ? init.expression
          : null;
      if (literal && readable(literal.text)) add(node, `prop:${node.name.getText()}`, literal.text);
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      isLiteral(node.expression) &&
      readsAsText(node) &&
      readable(node.expression.text)
    ) {
      add(node, 'jsx-literal', node.expression.text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression.getText();
      // labelValue(labels.fix, 'Fix'): a dictionary node with an English stand-in.
      const first = node.arguments[0];
      const dictionaryFallback =
        node.arguments.length > 1 &&
        (DICTIONARY_REF.test(first.getText()) ||
          TRANSLATE_HELPER.test(callee) ||
          // tx(['filters', 'type'], 'Type'): a key path with an English stand-in.
          (ts.isArrayLiteralExpression(first) && first.elements.every(isLiteral)));
      const args = CALLS.test(callee)
        ? node.arguments.slice(0, 1)
        : ERROR_FALLBACKS.test(callee) || dictionaryFallback
          ? node.arguments.slice(1)
          : [];
      for (const arg of args)
        if (isLiteral(arg) && readable(arg.text)) add(node, `call:${callee}`, arg.text);
    } else if (
      ts.isParameter(node) &&
      node.initializer &&
      isLiteral(node.initializer) &&
      TEXT_PARAM.test(node.name.getText()) &&
      readable(node.initializer.text)
    ) {
      add(node, `default:${node.name.getText()}`, node.initializer.text);
    } else if (
      ts.isBindingElement(node) &&
      node.initializer &&
      isLiteral(node.initializer) &&
      PROPS.has(node.name.getText()) &&
      readable(node.initializer.text)
    ) {
      add(node, `default:${node.name.getText()}`, node.initializer.text);
    } else if (
      ts.isPropertyAssignment(node) &&
      isLiteral(node.initializer) &&
      PROPS.has(node.name.getText().replace(/['"]/g, '')) &&
      /\s|^\p{Lu}/u.test(node.initializer.text) &&
      readable(node.initializer.text)
    ) {
      add(node, `field:${node.name.getText()}`, node.initializer.text);
    }

    if (isLiteral(node) && readable(node.text) && /\s|^\p{Lu}/u.test(node.text)) {
      const container = jsxContainerThroughLogic(node);
      if (container && readsAsText(container)) add(node, 'jsx-branch', node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* sourceFiles(full);
    } else if (/\.tsx?$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      yield full;
    }
  }
}

/** Every hard-coded user-facing string under app/, components/ and lib/. */
export function findHardcodedStrings(frontendDir = FRONTEND) {
  const hits = [];
  for (const root of ROOTS) {
    let files;
    try {
      files = [...sourceFiles(path.join(frontendDir, root))];
    } catch {
      continue;
    }
    for (const full of files) {
      const rel = path.relative(frontendDir, full).split(path.sep).join('/');
      if (SKIP_PATHS.some(prefix => rel.startsWith(prefix))) continue;
      hits.push(...scanSource(rel, readFileSync(full, 'utf8')));
    }
  }
  return hits;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hits = findHardcodedStrings();
  for (const hit of hits) console.log(`${hit.file}:${hit.line} [${hit.rule}] ${hit.text}`);
  console.log(`${hits.length} hard-coded string(s)`);
  process.exitCode = hits.length > 0 ? 1 : 0;
}
