import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface PdfTextRow {
  page: number;
  y: number;
  text: string;
  items: PdfTextItem[];
}

export interface PdfTableRowCell {
  text: string;
  x: number;
}

export interface PdfTableRow {
  page: number;
  y: number;
  columns: string[];
  cells: PdfTableRowCell[];
}

interface PdfPlumberTable {
  page: number;
  strategy: string;
  data: string[][];
  structured: PdfTableRow[];
}

interface PdfPlumberResult {
  text: string;
  rows: PdfTextRow[];
  tables: PdfPlumberTable[];
}

type RawPdfTextItem = Partial<Record<'text' | 'x' | 'y' | 'width' | 'height' | 'page', unknown>>;
type RawPdfTextRow = Partial<Record<'page' | 'y' | 'text' | 'items', unknown>>;
type RawPdfStructuredCell = Partial<Record<'text' | 'x', unknown>>;
type RawPdfStructuredRow = Partial<Record<'page' | 'y' | 'columns' | 'cells', unknown>>;
type RawPdfTable = Partial<Record<'page' | 'strategy' | 'data' | 'structured', unknown>>;

// ponytail: bounded via simple insertion-order eviction (Map preserves
// insertion order; re-inserting on read turns this into an LRU) rather than
// a dependency — this cache only needs to avoid unbounded growth across the
// process lifetime, not sophisticated eviction policy.
const MAX_CACHE_ENTRIES = 20;
const parserCache = new Map<string, PdfPlumberResult>();
let pythonExecutable: string | null = null;

function cachePut(filePath: string, result: PdfPlumberResult) {
  parserCache.set(filePath, result);
  while (parserCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = parserCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    parserCache.delete(oldestKey);
  }
}

function cacheGet(filePath: string): PdfPlumberResult | undefined {
  const hit = parserCache.get(filePath);
  if (hit) {
    // Touch: move to the end so eviction targets the least-recently-used entry.
    parserCache.delete(filePath);
    parserCache.set(filePath, hit);
  }
  return hit;
}

// A hung/looping pdfplumber process would otherwise hold a BullMQ worker
// slot forever, and unbounded stdout accumulation on a huge/malicious PDF
// could exhaust memory before the process even exits.
const PDF_PARSE_TIMEOUT_MS = Number.parseInt(process.env.PDF_PARSE_TIMEOUT_MS || '', 10) || 60_000;
const MAX_PDF_OUTPUT_BYTES = 100 * 1024 * 1024; // 100MB of parsed JSON output

/**
 * Extract text from PDF file using pdfplumber (Python).
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  const parsed = await runPdfPlumber(filePath);
  return parsed.text || '';
}

/**
 * Extract text with layout information (coordinates) using pdfplumber.
 */
export async function extractTextAndLayoutFromPdf(
  filePath: string,
): Promise<{ text: string; rows: PdfTextRow[] }> {
  const parsed = await runPdfPlumber(filePath);
  return { text: parsed.text || '', rows: parsed.rows || [] };
}

/**
 * Extract table-like rows from PDF using pdfplumber.
 *
 * pdfplumber finds tables two ways — from ruling lines and from text
 * alignment — and the two disagree on where columns split. `rowSets` keeps one
 * set of rows per way (pages concatenated in order), so a caller reads each as
 * its own table instead of a mix of both. Structured rows carry coordinates.
 */
export async function extractTablesFromPdf(
  filePath: string,
): Promise<{ rowSets: string[][][]; structured: PdfTableRow[] }> {
  const parsed = await runPdfPlumber(filePath);
  const tables = parsed.tables || [];
  const strategies = Array.from(new Set(tables.map(table => table.strategy)));
  const rowSets = strategies
    .map(strategy =>
      tables.filter(table => table.strategy === strategy).flatMap(table => table.data || []),
    )
    .filter(rows => rows.length > 0);
  const structured = tables.flatMap(table => table.structured || []);
  return { rowSets, structured };
}

function ensureFileExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }
}

function resolveScriptPath(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', 'scripts', 'pdfplumber_parser.py'),
    path.resolve(process.cwd(), 'backend', 'scripts', 'pdfplumber_parser.py'),
    path.resolve(process.cwd(), 'scripts', 'pdfplumber_parser.py'),
  ];

  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      'Could not locate pdfplumber_parser.py. Ensure backend/scripts/pdfplumber_parser.py is available at runtime.',
    );
  }

  return found;
}

function getPythonCandidates(): string[] {
  const fromEnv = process.env.PDF_PARSER_PYTHON;
  const backendVenv = path.resolve(process.cwd(), 'backend', '.venv', 'bin', 'python');
  const rootVenv = path.resolve(process.cwd(), '.venv', 'bin', 'python');
  const localVenv = path.resolve(__dirname, '..', '..', '..', '.venv', 'bin', 'python');

  const candidates = [fromEnv, backendVenv, rootVenv, localVenv, 'python3', 'python'].filter(
    (entry): entry is string => Boolean(entry),
  );

  return Array.from(new Set(candidates));
}

function resolvePythonExecutable(): string {
  if (pythonExecutable) {
    return pythonExecutable;
  }

  for (const candidate of getPythonCandidates()) {
    const versionCheck = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (versionCheck.error || versionCheck.status !== 0) {
      continue;
    }
    const libraryCheck = spawnSync(candidate, ['-c', 'import pdfplumber'], { encoding: 'utf8' });
    if (!libraryCheck.error && libraryCheck.status === 0) {
      pythonExecutable = candidate;
      return candidate;
    }
  }

  throw new Error(
    'Python 3 with pdfplumber is required to parse PDF statements. Install it with "pip install pdfplumber" and ensure python3 is available in PATH.',
  );
}

async function runPdfPlumber(filePath: string): Promise<PdfPlumberResult> {
  ensureFileExists(filePath);

  const cached = cacheGet(filePath);
  if (cached) {
    return cached;
  }

  const python = resolvePythonExecutable();
  const scriptPath = resolveScriptPath();

  return new Promise<PdfPlumberResult>((resolve, reject) => {
    const proc = spawn(python, [scriptPath, filePath]);

    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      settle(() =>
        reject(new Error(`[PDF Parser] pdfplumber timed out after ${PDF_PARSE_TIMEOUT_MS}ms`)),
      );
    }, PDF_PARSE_TIMEOUT_MS);

    proc.stdout.on('data', (data: Buffer) => {
      outputBytes += data.length;
      if (outputBytes > MAX_PDF_OUTPUT_BYTES) {
        proc.kill('SIGKILL');
        settle(() =>
          reject(
            new Error(`[PDF Parser] pdfplumber output exceeded ${MAX_PDF_OUTPUT_BYTES} bytes`),
          ),
        );
        return;
      }
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', error => {
      settle(() =>
        reject(
          new Error(
            `[PDF Parser] Failed to start pdfplumber process: ${error.message}. Is python3 installed?`,
          ),
        ),
      );
    });

    proc.on('close', code => {
      settle(() => {
        if (code !== 0) {
          reject(
            new Error(
              `[PDF Parser] pdfplumber exited with code ${code}: ${stderr.trim() || 'no stderr'}`,
            ),
          );
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as Partial<PdfPlumberResult>;
          const normalized = normalizeResult(parsed);
          cachePut(filePath, normalized);
          resolve(normalized);
        } catch (error) {
          reject(
            new Error(
              `[PDF Parser] Could not parse pdfplumber output: ${
                (error as Error).message
              }. Output: ${stderr || stdout}`,
            ),
          );
        }
      });
    });
  });
}

function normalizeResult(raw: Partial<PdfPlumberResult>): PdfPlumberResult {
  return {
    text: typeof raw?.text === 'string' ? raw.text : '',
    rows: Array.isArray(raw?.rows) ? raw.rows.map(normalizeRow).filter(Boolean) : [],
    tables: Array.isArray(raw?.tables)
      ? (raw.tables.map(normalizeTable).filter(Boolean) as PdfPlumberTable[])
      : [],
  };
}

function normalizeRow(row: RawPdfTextRow | null | undefined): PdfTextRow | null {
  if (!row) {
    return null;
  }

  const items = Array.isArray(row.items)
    ? (row.items.map(normalizeItem).filter(Boolean) as PdfTextItem[])
    : [];

  return {
    page: Number(row.page) || 1,
    y: Number(row.y) || 0,
    text: typeof row.text === 'string' ? row.text : '',
    items,
  };
}

function normalizeItem(item: RawPdfTextItem | null | undefined): PdfTextItem | null {
  if (!item || typeof item.text !== 'string' || !item.text.trim()) {
    return null;
  }

  return {
    text: item.text,
    x: Number(item.x) || 0,
    y: Number(item.y) || 0,
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    page: Number(item.page) || 1,
  };
}

function normalizeTable(table: RawPdfTable | null | undefined): PdfPlumberTable | null {
  if (!table) {
    return null;
  }

  const data: string[][] = Array.isArray(table.data)
    ? table.data.map(row => (Array.isArray(row) ? row.map(cleanText) : []))
    : [];

  const structured: PdfTableRow[] = Array.isArray(table.structured)
    ? (table.structured.map(normalizeStructuredRow).filter(Boolean) as PdfTableRow[])
    : [];

  return {
    page: Number(table.page) || 1,
    strategy: typeof table.strategy === 'string' ? table.strategy : '',
    data,
    structured,
  };
}

function normalizeStructuredRow(row: RawPdfStructuredRow | null | undefined): PdfTableRow | null {
  if (!row) {
    return null;
  }

  const cells: PdfTableRowCell[] = Array.isArray(row.cells)
    ? row.cells.map((cell: RawPdfStructuredCell) => ({
        text: cleanText(cell?.text),
        x: Number(cell?.x) || 0,
      }))
    : [];

  return {
    page: Number(row.page) || 1,
    y: Number(row.y) || 0,
    columns: Array.isArray(row.columns) ? row.columns.map(cleanText) : [],
    cells,
  };
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return value.toString().replace(/\s+/g, ' ').trim();
}
