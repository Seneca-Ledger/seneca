import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractTablesFromPdf, extractTextAndLayoutFromPdf } from '@/common/utils/pdf-parser.util';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const resolvedPython = resolvePythonPath();
const suite = resolvedPython ? describe : describe.skip;

suite('pdfplumber parser util', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfplumber-test-'));
  const pdfPath = path.join(tmpDir, 'sample-statement.pdf');

  beforeAll(async () => {
    if (!resolvedPython) {
      return;
    }
    process.env.PDF_PARSER_PYTHON = resolvedPython;
    await buildSampleStatement(pdfPath);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts text and layout lines', async () => {
    const { text, rows } = await extractTextAndLayoutFromPdf(pdfPath);

    expect(text).toContain('Bank Statement');
    expect(rows.length).toBeGreaterThan(0);
    const headerRow = rows.find(row => row.text.includes('Date'));
    expect(headerRow).toBeTruthy();
  });

  it('extracts table data with coordinates', async () => {
    const { rowSets, structured } = await extractTablesFromPdf(pdfPath);
    const rows = rowSets[0];

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].join(' ')).toContain('Date');
    expect(rows[1]).toEqual(expect.arrayContaining(['01.01.2024', 'DOC-1']));

    const withDocument = structured.find(row => row.columns.includes('DOC-1'));
    expect(withDocument?.cells?.[0].x).toBeGreaterThan(0);
  });
});

async function buildSampleStatement(filePath: string) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([650, 500]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 460;
  page.drawText('Bank Statement', { x: 50, y, size: 16, font: fontBold });
  y -= 22;
  page.drawText('Account: KZ123456789012345', { x: 50, y, size: 12, font });

  const headers = ['Date', 'Document', 'Counterparty', 'Debit', 'Credit', 'Purpose'];
  const dataRows = [
    ['01.01.2024', 'DOC-1', 'First Supplier', '100 000,00', '', 'Invoice payment'],
    ['03.01.2024', 'DOC-2', 'Second Client', '', '250 000,00', 'Order payment'],
  ];

  const startX = 50;
  const startY = 400;
  const rowHeight = 24;
  const colWidths = [90, 90, 150, 70, 70, 130];
  const totalWidth = colWidths.reduce((sum, value) => sum + value, 0);
  const totalRows = 1 + dataRows.length;

  // Draw horizontal lines
  for (let i = 0; i <= totalRows; i++) {
    const lineY = startY - i * rowHeight;
    page.drawLine({
      start: { x: startX, y: lineY },
      end: { x: startX + totalWidth, y: lineY },
      thickness: 1,
    });
  }

  // Draw vertical lines
  let cursorX = startX;
  for (const width of colWidths) {
    page.drawLine({
      start: { x: cursorX, y: startY },
      end: { x: cursorX, y: startY - totalRows * rowHeight },
      thickness: 1,
    });
    cursorX += width;
  }
  page.drawLine({
    start: { x: startX + totalWidth, y: startY },
    end: { x: startX + totalWidth, y: startY - totalRows * rowHeight },
    thickness: 1,
  });

  const drawRow = (cells: string[], rowIndex: number, bold = false) => {
    let cellX = startX;
    const textY = startY - rowHeight * (rowIndex + 1) + 6;
    cells.forEach((cell, idx) => {
      page.drawText(cell, {
        x: cellX + 4,
        y: textY,
        size: 10,
        font: bold ? fontBold : font,
      });
      cellX += colWidths[idx] || 0;
    });
  };

  drawRow(headers, 0, true);
  dataRows.forEach((row, idx) => drawRow(row, idx + 1));

  const bytes = await pdfDoc.save();
  fs.writeFileSync(filePath, bytes);
}

function resolvePythonPath(): string | undefined {
  const candidates = [
    process.env.PDF_PARSER_PYTHON,
    path.resolve(process.cwd(), 'backend', '.venv', 'bin', 'python'),
    path.resolve(process.cwd(), '.venv', 'bin', 'python'),
    'python3',
    'python',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const check = spawnSync(candidate, ['-c', 'import pdfplumber'], { encoding: 'utf8' });
    if (!check.error && check.status === 0) {
      return candidate;
    }
  }

  console.warn('Skipping pdfplumber parser tests: python with pdfplumber not found.');
  return undefined;
}
