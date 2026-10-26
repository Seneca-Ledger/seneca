// Finds page- and block-level loading spinners. Those load with a skeleton
// instead (SnapshotSkeleton, app/components/ui/snapshot-skeleton), so the
// layout the user saw last time shows while data loads.
// Run: node scripts/find-large-spinners.mjs
// app/lib/no-large-spinners.test.ts fails on any hit.
//
// A hit is a <Spinner> or <CircularProgress> that is 24px or larger, or one
// that sits alone in a centring box (a spinner standing in for content).
// Spinners inside buttons (children, startIcon/endIcon) are fine: they show
// that an action runs, not that a block loads.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ts = createRequire(import.meta.url)('typescript');

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', '.intlayer', 'dist', 'test', '__mocks__', '__tests__']);
const SKIP_FILE = /\.(test|spec|stories|d)\.tsx?$/;
const SPINNERS = new Set(['Spinner', 'CircularProgress']);
const DEFAULT_SIZE = { Spinner: 16, CircularProgress: 40 };
const BUTTONS = /^(Button|IconButton|LoadingButton|button|DetailActionButton)$/;
const ICON_PROPS = new Set(['startIcon', 'endIcon', 'icon']);
const MIN_SIZE = 24;

/**
 * Spinners kept on purpose, by file: a reason each.
 * Keep it short — a new entry needs a reason a reviewer would accept.
 */
export const ALLOWED = new Map([
  ['app/components/ui/spinner.tsx', 'the Spinner component itself'],
  [
    'app/components/PDFThumbnail.tsx',
    'a 16px mark inside a fixed-size thumbnail frame, not a block',
  ],
  // Not rendered anywhere (dead code); replace if they come back into use.
  ['app/components/pdf-preview/components/PDFPreviewContent.tsx', 'unused PDFLoadingOverlay'],
  ['app/components/side-panel/SidePanelParts.tsx', 'unused PanelContent'],
]);

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* sourceFiles(path.join(dir, entry.name));
      }
    } else if (/\.tsx$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      yield path.join(dir, entry.name);
    }
  }
}

const tagName = node =>
  (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText();
const attributesOf = node =>
  (ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes).properties;

function attribute(node, name) {
  return attributesOf(node).find(attr => ts.isJsxAttribute(attr) && attr.name.getText() === name);
}

/** The literal text of an attribute: `"x"`, `{'x'}`, `{12}` or an object literal's source. */
function attributeText(attr) {
  const init = attr?.initializer;
  if (!init) {
    return '';
  }
  if (ts.isStringLiteral(init)) {
    return init.text;
  }
  return init.expression ? init.expression.getText() : '';
}

/** Rendered size in px, or null when it cannot be read from the source. */
function sizeOf(node, name) {
  const size = attribute(node, 'size');
  if (size) {
    const value = Number(attributeText(size));
    return Number.isFinite(value) ? value : null;
  }
  const className = attributeText(attribute(node, 'className'));
  const tw = className.match(/\b(?:h|w|size)-(\d+)\b/);
  if (tw) {
    return Number(tw[1]) * 4;
  }
  const px = className.match(/\b(?:h|w|size)-\[(\d+)px\]/);
  if (px) {
    return Number(px[1]);
  }
  const style = attributeText(attribute(node, 'style'));
  const dimension = style.match(/\b(?:height|width)\s*:\s*(\d+)/);
  if (dimension) {
    return Number(dimension[1]);
  }
  return DEFAULT_SIZE[name];
}

const CENTRING =
  /justify-center|place-items-center|justifyContent\s*[:=]\s*['"{]*\s*['"]?center|placeItems\s*:\s*['"]center/;

/** True when the spinner is the only element in a box that centres it. */
function isAloneInCentringBox(node) {
  const parent = node.parent;
  if (!(parent && ts.isJsxElement(parent))) {
    return false;
  }
  const elements = parent.children.filter(
    child => !ts.isJsxText(child) || child.getText().trim() !== '',
  );
  if (elements.length !== 1 || elements[0] !== node) {
    return false;
  }
  const props = attributesOf(parent)
    .map(attr => attr.getText())
    .join(' ');
  return CENTRING.test(props);
}

/** Inside a button's children or its icon props: an action in progress. */
function isInsideButton(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxAttribute(current) && ICON_PROPS.has(current.name.getText())) {
      return true;
    }
    if (
      (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) &&
      BUTTONS.test(tagName(current))
    ) {
      return true;
    }
  }
  return false;
}

export function scanSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const visit = node => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = tagName(node);
      if (SPINNERS.has(name) && !isInsideButton(node)) {
        const size = sizeOf(node, name);
        const large = size !== null && size >= MIN_SIZE;
        if (large || isAloneInCentringBox(node)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          hits.push({ file, line: line + 1, size, text: node.getText().split('\n')[0] });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

export function findLargeSpinners(frontendDir = FRONTEND) {
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
      if (ALLOWED.has(rel)) {
        continue;
      }
      hits.push(...scanSource(rel, readFileSync(full, 'utf8')));
    }
  }
  return hits;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hits = findLargeSpinners();
  for (const hit of hits) {
    console.log(`${hit.file}:${hit.line} [${hit.size}px] ${hit.text}`);
  }
  console.log(`${hits.length} page- or block-level spinner(s)`);
  process.exitCode = hits.length > 0 ? 1 : 0;
}
