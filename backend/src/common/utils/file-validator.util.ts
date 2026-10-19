import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import {
  sniffStatementFormat,
  type TextStatementFormat,
} from '../../modules/parsing/parsers/statement-formats.util';
import { resolveUploadsDir, resolveInUploadsDir as resolveUploadsPath } from './uploads.util';

// Multer's diskStorage (see config/multer.config.ts) always writes to this
// directory under a server-generated random filename — file.path is never
// built from client input (originalname included). This check is defense
// in depth against that invariant ever being violated, and makes the
// filesystem calls below auditable as bounded rather than taking an
// Express.Multer.File's path on faith.
const uploadsRoot = path.resolve(resolveUploadsDir());

const resolveInUploadsDir = (candidatePath: string): string | null =>
  resolveUploadsPath(candidatePath, uploadsRoot);

enum AllowedFileType {
  // Interchange formats arrive under loose MIME types; they are admitted only
  // when the extension and the first bytes agree (see textStatementFormatOf).
  OFX = 'application/x-ofx',
  QIF = 'application/qif',
  XML = 'application/xml',
  TEXT_XML = 'text/xml',
  TEXT_PLAIN = 'text/plain',
  OCTET = 'application/octet-stream',
  PDF = 'application/pdf',
  XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS = 'application/vnd.ms-excel',
  CSV = 'text/csv',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  JPG = 'image/jpeg',
  PNG = 'image/png',
  TIFF = 'image/tiff',
  BMP = 'image/bmp',
  WEBP = 'image/webp',
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ponytail: hand-rolled signature check for the fixed, small set of formats
// this app accepts — a few buffer-prefix comparisons, not worth a dependency.
// CSV/DOCX-vs-XLSX-collision note: DOCX and XLSX are both ZIP containers and
// share the same leading bytes, so this only rules out a payload that isn't
// even a ZIP/PDF/image at all — it doesn't distinguish DOCX from XLSX content.
// CSV has no reliable magic bytes (plain text) and is intentionally skipped.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
// Map, not a plain object: file.mimetype is client-declared and used as the
// lookup key immediately below. A plain object literal is reachable through
// the prototype chain (e.g. a mimetype of "constructor"), which is exactly
// the "user-controlled key used for dynamic dispatch" shape static analysis
// flags — a Map has no such inherited keys, so an unrecognized/adversarial
// mimetype can only ever produce a real `undefined`, never a foreign function.
const MAGIC_BYTES: ReadonlyMap<AllowedFileType, (buf: Buffer) => boolean> = new Map([
  [AllowedFileType.PDF, (buf: Buffer) => buf.subarray(0, 5).toString('latin1') === '%PDF-'],
  [AllowedFileType.XLSX, (buf: Buffer) => buf.subarray(0, 4).equals(ZIP_SIGNATURE)],
  [AllowedFileType.DOCX, (buf: Buffer) => buf.subarray(0, 4).equals(ZIP_SIGNATURE)],
  [
    AllowedFileType.XLS,
    (buf: Buffer) =>
      buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  ],
  [
    AllowedFileType.JPG,
    (buf: Buffer) => buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  ],
  [
    AllowedFileType.PNG,
    (buf: Buffer) =>
      buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ],
  [
    AllowedFileType.TIFF,
    (buf: Buffer) =>
      buf.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
      buf.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a])),
  ],
  [AllowedFileType.BMP, (buf: Buffer) => buf.subarray(0, 2).toString('latin1') === 'BM'],
  [
    AllowedFileType.WEBP,
    (buf: Buffer) =>
      buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buf.subarray(8, 12).toString('latin1') === 'WEBP',
  ],
]);

// Returns null (rather than throwing) when the file can't be read: at this
// point multer has already written it moments earlier in the same request,
// so a read failure here means something environmental (permissions, the
// path being a test double with no real file behind it), not a sign of a
// malicious payload — the declared-mimetype allowlist check still applies
// either way.
function readSignature(filePath: string): Buffer | null {
  const resolved = resolveInUploadsDir(filePath);
  if (!resolved?.startsWith(`${uploadsRoot}${path.sep}`)) {
    return null;
  }
  let fd: number;
  try {
    fd = fs.openSync(resolved, 'r');
  } catch {
    return null;
  }
  try {
    const buf = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
    return buf.subarray(0, bytesRead);
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

// Synchronous and side-effect-free by design: callers across the codebase
// (controllers and services alike) call this without awaiting, so it must
// never return a Promise or perform I/O that could be skipped by a missing
// `await`. File cleanup on rejection is a separate concern — see
// `validateFiles`/`unlinkAll` below, used only by upload endpoints that
// already need to be async for that reason.
const LOOSE_TEXT_MIMES = new Set<string>([
  AllowedFileType.OFX,
  AllowedFileType.QIF,
  AllowedFileType.XML,
  AllowedFileType.TEXT_XML,
  AllowedFileType.TEXT_PLAIN,
  AllowedFileType.OCTET,
]);

const TEXT_FORMAT_EXTENSIONS: Record<string, TextStatementFormat> = {
  '.ofx': 'ofx',
  '.qfx': 'ofx',
  '.qif': 'qif',
  '.xml': 'camt',
  '.camt': 'camt',
  '.mt940': 'mt940',
  '.sta': 'mt940',
  '.940': 'mt940',
  '.swi': 'mt940',
};

function readTextSample(filePath: string, bytes = 8192): string | null {
  const resolved = resolveInUploadsDir(filePath);
  if (!resolved?.startsWith(`${uploadsRoot}${path.sep}`)) {
    return null;
  }
  let fd: number;
  try {
    fd = fs.openSync(resolved, 'r');
  } catch {
    return null;
  }
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read).toString('utf-8');
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * OFX/QFX, QIF, camt.053 or MT940, when the extension says so and the first
 * bytes agree; null for anything else. The MIME type is not consulted: browsers
 * send these as octet-stream, text/plain or xml at random.
 */
export function textStatementFormatOf(file: {
  originalname?: string | null;
  path?: string | null;
}): TextStatementFormat | null {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const expected = TEXT_FORMAT_EXTENSIONS[extension];
  if (!expected) return null;
  const sample = file.path ? readTextSample(file.path) : null;
  if (sample === null) return null;
  return sniffStatementFormat(sample) === expected ? expected : null;
}

/** `pdf`, `csv`, …, or one of the interchange formats; `unknown` otherwise. */
/**
 * Windows hands a .csv to the browser as application/vnd.ms-excel when Excel is
 * installed. Such a file is text, not an OLE workbook: take it as the CSV it is.
 */
function isCsvDeclaredAsExcel(file: {
  mimetype: string;
  originalname?: string | null;
  path?: string | null;
}): boolean {
  if (file.mimetype !== AllowedFileType.XLS || !/\.csv$/i.test(file.originalname ?? '')) {
    return false;
  }
  const signature = file.path ? readSignature(file.path) : null;
  return !(signature && MAGIC_BYTES.get(AllowedFileType.XLS)?.(signature));
}

export function resolveFileType(file: {
  mimetype: string;
  originalname?: string | null;
  path?: string | null;
}): string {
  if (isCsvDeclaredAsExcel(file)) return 'csv';
  const byMime = getFileTypeFromMime(file.mimetype);
  if (byMime !== 'unknown' && !LOOSE_TEXT_MIMES.has(file.mimetype)) return byMime;
  return textStatementFormatOf(file) ?? byMime;
}

/**
 * Whether an uploaded XML file is a structured e-invoice: an EN 16931
 * invoice in UBL (Invoice, CreditNote) or CII (CrossIndustryInvoice).
 */
export function isEInvoiceXml(file: { path?: string | null }): boolean {
  const sample = file.path ? readTextSample(file.path) : null;
  return (
    sample !== null &&
    /<(?:[\w-]+:)?(?:Invoice|CreditNote|CrossIndustryInvoice)[\s>]/.test(
      // Past the declaration and any comments in front of the root element.
      sample.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g, ''),
    )
  );
}

export function validateFile(
  file: Express.Multer.File,
  options: { allowEInvoiceXml?: boolean } = {},
): void {
  if (!file) {
    throw new BadRequestException('No file provided');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    );
  }

  const allowedTypes = Object.values(AllowedFileType);
  if (!allowedTypes.includes(file.mimetype as AllowedFileType)) {
    throw new BadRequestException(
      `File type ${file.mimetype} is not allowed. Allowed types: PDF, XLSX, XLS, CSV, DOCX, OFX, QIF, camt.053, MT940, JPG, PNG, TIFF, BMP, WEBP`,
    );
  }
  const isEInvoice = options.allowEInvoiceXml === true && isEInvoiceXml(file);
  if (LOOSE_TEXT_MIMES.has(file.mimetype) && !isEInvoice && !textStatementFormatOf(file)) {
    throw new BadRequestException(
      'File content is not a recognised statement format (OFX/QFX, QIF, camt.053 or MT940)',
    );
  }

  const checkSignature = isCsvDeclaredAsExcel(file)
    ? undefined
    : MAGIC_BYTES.get(file.mimetype as AllowedFileType);
  if (checkSignature && file.path) {
    const signature = readSignature(file.path);
    if (signature && !checkSignature(signature)) {
      throw new BadRequestException(
        `File content does not match its declared type (${file.mimetype})`,
      );
    }
  }
}

/** What a receipt may be: a photo or scan, a PDF, or a structured e-invoice. */
const SUPPORTED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
  // A structured e-invoice (XRechnung) sent as the XML itself.
  'application/xml',
  'text/xml',
]);

/** Refuses a receipt upload that is not an image, a PDF or an e-invoice XML. */
export function assertReceiptFileSupported(file: Express.Multer.File): void {
  const isXml = file.mimetype === 'application/xml' || file.mimetype === 'text/xml';
  if (!SUPPORTED_RECEIPT_MIME_TYPES.has(file.mimetype) || (isXml && !isEInvoiceXml(file))) {
    throw new BadRequestException('Only image, PDF and e-invoice XML receipt files are supported');
  }
}

// Avatars are the one upload that is served back from a @Public() route, so
// they get their own image-only allowlist: `validateFile` above accepts PDF
// and Office documents too, which must never be reachable through that route.
const AVATAR_MAGIC_BYTES: ReadonlyMap<string, (buf: Buffer) => boolean> = new Map([
  ['image/jpeg', (buf: Buffer) => buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))],
  [
    'image/png',
    (buf: Buffer) =>
      buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ],
  [
    'image/webp',
    (buf: Buffer) =>
      buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buf.subarray(8, 12).toString('latin1') === 'WEBP',
  ],
  ['image/gif', (buf: Buffer) => buf.subarray(0, 6).toString('latin1').startsWith('GIF8')],
]);

/**
 * Verifies that an uploaded image's bytes match its declared MIME type.
 * The declared type is client-controlled, so without this an HTML payload
 * announced as image/png would be stored under a .png name.
 */
export function validateImageSignature(file: Express.Multer.File): void {
  const checkSignature = AVATAR_MAGIC_BYTES.get(file.mimetype);
  if (typeof checkSignature !== 'function') {
    throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
  }

  if (!file.path) {
    return;
  }

  const signature = readSignature(file.path);
  if (signature && !checkSignature(signature)) {
    throw new BadRequestException(
      `File content does not match its declared type (${file.mimetype})`,
    );
  }
}

/**
 * Deletes every file in a batch from disk, ignoring individual failures.
 * Multer's diskStorage writes each upload before any application code runs,
 * so a rejected batch must be cleaned up explicitly or the files are
 * orphaned on disk forever.
 */
export async function removeUploadedFile(file: Express.Multer.File): Promise<void> {
  const resolved = file.path ? resolveInUploadsDir(file.path) : null;
  if (!resolved?.startsWith(`${uploadsRoot}${path.sep}`)) {
    return;
  }
  await fsp.unlink(resolved).catch(() => undefined);
}

export async function unlinkAll(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map(removeUploadedFile));
}

/**
 * Validates every file in a batch and, if any fails, deletes all of them —
 * the whole upload request is being rejected anyway, so leaving the
 * accepted-looking files behind would just orphan them.
 */
export async function validateFiles(files: Express.Multer.File[]): Promise<void> {
  try {
    for (const file of files) {
      validateFile(file);
    }
  } catch (error) {
    await unlinkAll(files);
    throw error;
  }
}

export function getFileTypeFromMime(mimetype: string): string {
  const typeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xlsx',
    'text/csv': 'csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/tiff': 'image',
    'image/bmp': 'image',
    'image/webp': 'image',
  };

  return typeMap[mimetype] || 'unknown';
}
