import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface OcrResult {
  text: string;
  confidence: number;
  language?: string;
  preprocessed: boolean;
}

export interface OcrOptions {
  languages?: string[];
  preprocess?: boolean;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  script: 'Latin' | 'Cyrillic' | 'CJK' | 'Arabic' | 'Devanagari' | 'Hebrew';
}

const PDF_RASTERIZE_TIMEOUT_MS = 30_000;
const PDF_RASTERIZE_DPI = '150';

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.tiff',
  '.tif',
  '.bmp',
  '.webp',
]);

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  private static readonly SUPPORTED_LANGUAGES: SupportedLanguage[] = [
    { code: 'eng', name: 'English', script: 'Latin' },
    { code: 'rus', name: 'Russian', script: 'Cyrillic' },
    { code: 'deu', name: 'German', script: 'Latin' },
    { code: 'fra', name: 'French', script: 'Latin' },
    { code: 'spa', name: 'Spanish', script: 'Latin' },
    { code: 'ita', name: 'Italian', script: 'Latin' },
    { code: 'por', name: 'Portuguese', script: 'Latin' },
    { code: 'chi_sim', name: 'Chinese (Simplified)', script: 'CJK' },
    { code: 'jpn', name: 'Japanese', script: 'CJK' },
    { code: 'kor', name: 'Korean', script: 'CJK' },
    { code: 'ara', name: 'Arabic', script: 'Arabic' },
    { code: 'heb', name: 'Hebrew', script: 'Hebrew' },
    { code: 'hin', name: 'Hindi', script: 'Devanagari' },
    { code: 'tur', name: 'Turkish', script: 'Latin' },
    { code: 'pol', name: 'Polish', script: 'Latin' },
    { code: 'ces', name: 'Czech', script: 'Latin' },
  ];

  private static readonly SUPPORTED_CODES = new Set(
    OcrService.SUPPORTED_LANGUAGES.map(language => language.code),
  );

  isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_IMAGE_EXTENSIONS.has(ext);
  }

  getSupportedImageExtensions(): string[] {
    return Array.from(SUPPORTED_IMAGE_EXTENSIONS);
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return [...OcrService.SUPPORTED_LANGUAGES];
  }

  resolveLanguages(requested?: string[]): string[] {
    if (!requested || requested.length === 0) {
      return ['eng'];
    }

    const validLanguages = Array.from(
      new Set(requested.filter(code => code !== 'auto' && OcrService.SUPPORTED_CODES.has(code))),
    );

    return validLanguages.length > 0 ? validLanguages : ['eng'];
  }

  detectScriptFromText(text: string): SupportedLanguage['script'] {
    const counters: Record<SupportedLanguage['script'], number> = {
      Latin: 0,
      Cyrillic: 0,
      CJK: 0,
      Arabic: 0,
      Hebrew: 0,
      Devanagari: 0,
    };

    for (const char of text) {
      const code = char.codePointAt(0);
      if (!code) {
        continue;
      }

      if ((code >= 0x0041 && code <= 0x024f) || (code >= 0x1e00 && code <= 0x1eff)) {
        counters.Latin += 1;
      } else if (code >= 0x0400 && code <= 0x04ff) {
        counters.Cyrillic += 1;
      } else if (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3040 && code <= 0x30ff) ||
        (code >= 0xac00 && code <= 0xd7af)
      ) {
        counters.CJK += 1;
      } else if ((code >= 0x0600 && code <= 0x06ff) || (code >= 0x0750 && code <= 0x077f)) {
        counters.Arabic += 1;
      } else if (code >= 0x0590 && code <= 0x05ff) {
        counters.Hebrew += 1;
      } else if (code >= 0x0900 && code <= 0x097f) {
        counters.Devanagari += 1;
      }
    }

    let selectedScript: SupportedLanguage['script'] = 'Latin';
    let maxCount = 0;

    for (const [script, count] of Object.entries(counters) as Array<
      [SupportedLanguage['script'], number]
    >) {
      if (count > maxCount) {
        maxCount = count;
        selectedScript = script;
      }
    }

    return selectedScript;
  }

  getLanguagesForScript(script: SupportedLanguage['script'] | string): string[] {
    switch (script) {
      case 'Cyrillic':
        return ['rus'];
      case 'CJK':
        return ['chi_sim', 'jpn', 'kor'];
      case 'Arabic':
        return ['ara'];
      case 'Hebrew':
        return ['heb'];
      case 'Devanagari':
        return ['hin'];
      default:
        return ['eng'];
    }
  }

  async extractTextFromImage(imageBuffer: Buffer, options: OcrOptions = {}): Promise<OcrResult> {
    const { preprocess = true } = options;

    let processedBuffer = imageBuffer;
    if (preprocess) {
      processedBuffer = await this.preprocessImage(imageBuffer);
    }

    const shouldAutoDetect =
      !options.languages || options.languages.length === 0 || options.languages.includes('auto');

    if (shouldAutoDetect) {
      const initialResult = await this.runOcr(processedBuffer, ['eng']);
      const detectedScript = this.detectScriptFromText(initialResult.text);
      const detectedLanguages = this.getLanguagesForScript(detectedScript);

      if (detectedScript !== 'Latin') {
        const detectedResult = await this.runOcr(processedBuffer, detectedLanguages);
        return {
          ...detectedResult,
          language: detectedLanguages.join('+'),
          preprocessed: preprocess,
        };
      }

      return {
        ...initialResult,
        language: detectedLanguages.join('+'),
        preprocessed: preprocess,
      };
    }

    const languages = this.resolveLanguages(options.languages);
    const result = await this.runOcr(processedBuffer, languages);

    return {
      ...result,
      language: languages.join('+'),
      preprocessed: preprocess,
    };
  }

  private async runOcr(
    imageBuffer: Buffer,
    languages: string[],
  ): Promise<Pick<OcrResult, 'text' | 'confidence'>> {
    const langString = languages.join('+');

    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(langString);

    try {
      const { data } = await worker.recognize(imageBuffer);
      const text = (data?.text || '').trim();
      const confidence = (data?.confidence || 0) / 100;

      this.logger.debug(
        `OCR extracted ${text.length} chars with confidence ${confidence.toFixed(2)} (${langString})`,
      );

      return {
        text,
        confidence,
      };
    } finally {
      await worker.terminate();
    }
  }

  async extractTextFromScannedPdf(pdfBuffer: Buffer, options: OcrOptions = {}): Promise<OcrResult> {
    const pdfParseModule = await import('pdf-parse');
    // pdf-parse is CommonJS: with esModuleInterop the function is `default`;
    // the fallback covers a loader that hands back the export itself.
    const pdfParse = pdfParseModule.default ?? pdfParseModule;
    const data = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(pdfBuffer);
    const existingText = (data.text || '').trim();

    if (existingText.length > 100) {
      return {
        text: existingText,
        confidence: 0.95,
        preprocessed: false,
      };
    }

    this.logger.debug('PDF has minimal text; trying OCR fallback path');

    try {
      // Tesseract cannot read PDFs — feeding it one makes its worker throw
      // outside this promise chain and take the process down, so the page has
      // to be rasterized to an image first.
      const pageImage = await this.rasterizeFirstPage(pdfBuffer);
      return await this.extractTextFromImage(pageImage, options);
    } catch (error) {
      this.logger.warn('OCR fallback for scanned PDF failed', error);

      return {
        text: existingText,
        confidence: 0.3,
        preprocessed: false,
      };
    }
  }

  private async rasterizeFirstPage(pdfBuffer: Buffer): Promise<Buffer> {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ocr-pdf-'));
    const prefix = path.join(dir, 'page');

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('pdftoppm', [
          '-png',
          '-r',
          PDF_RASTERIZE_DPI,
          '-f',
          '1',
          '-l',
          '1',
          '-singlefile',
          '-',
          prefix,
        ]);

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
          settle(() => reject(new Error(`pdftoppm timed out after ${PDF_RASTERIZE_TIMEOUT_MS}ms`)));
        }, PDF_RASTERIZE_TIMEOUT_MS);

        proc.on('error', error => settle(() => reject(error)));
        proc.stdin.on('error', error => settle(() => reject(error)));
        proc.on('close', code =>
          settle(() =>
            code === 0 ? resolve() : reject(new Error(`pdftoppm exited with code ${code}`)),
          ),
        );

        proc.stdin.end(pdfBuffer);
      });

      return await fs.promises.readFile(`${prefix}.png`);
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  }

  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      const sharp = (await import('sharp')).default;

      return await sharp(buffer).grayscale().normalize().sharpen({ sigma: 1.5 }).toBuffer();
    } catch (error) {
      this.logger.warn('Image preprocessing failed; using original image', error);
      return buffer;
    }
  }
}
