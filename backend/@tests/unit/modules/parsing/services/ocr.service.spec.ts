import { OcrService } from '../../../../../src/modules/parsing/services/ocr.service';

const mockRecognize = vi.fn().mockResolvedValue({
  data: {
    text: 'Store ABC\nItem 1   $10.00\nItem 2   $20.00\nTotal    $30.00',
    confidence: 85,
    blocks: [],
  },
});

const mockTerminate = vi.fn().mockResolvedValue(undefined);

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: mockRecognize,
    terminate: mockTerminate,
  }),
}));

const mockSharpChain = {
  grayscale: vi.fn().mockReturnThis(),
  normalize: vi.fn().mockReturnThis(),
  sharpen: vi.fn().mockReturnThis(),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')), // processed image
};

vi.mock('sharp', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => mockSharpChain),
}));

describe('OcrService', () => {
  let service: OcrService;

  beforeEach(() => {
    service = new OcrService();
    vi.clearAllMocks();
  });

  describe('isImageFile', () => {
    it('returns true for PNG', () => {
      expect(service.isImageFile('receipt.png')).toBe(true);
    });

    it('returns true for JPG', () => {
      expect(service.isImageFile('receipt.jpg')).toBe(true);
    });

    it('returns true for JPEG', () => {
      expect(service.isImageFile('receipt.jpeg')).toBe(true);
    });

    it('returns false for PDF', () => {
      expect(service.isImageFile('receipt.pdf')).toBe(false);
    });

    it('returns false for CSV', () => {
      expect(service.isImageFile('data.csv')).toBe(false);
    });
  });

  describe('extractTextFromImage', () => {
    it('extracts text from image buffer', async () => {
      const buffer = Buffer.from('fake-image-data');
      const result = await service.extractTextFromImage(buffer);

      expect(result.text).toContain('Store ABC');
      expect(result.text).toContain('Total');
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockTerminate).toHaveBeenCalled();
    });

    it('preprocesses image when enabled', async () => {
      const buffer = Buffer.from('fake-image-data');
      const result = await service.extractTextFromImage(buffer, { preprocess: true });

      expect(result.text).toBeTruthy();
      expect(result.preprocessed).toBe(true);
      expect(mockSharpChain.grayscale).toHaveBeenCalled();
      expect(mockSharpChain.normalize).toHaveBeenCalled();
      expect(mockSharpChain.sharpen).toHaveBeenCalled();
    });

    it('skips preprocessing when disabled', async () => {
      const buffer = Buffer.from('fake-image-data');
      const result = await service.extractTextFromImage(buffer, { preprocess: false });

      expect(result.preprocessed).toBe(false);
      expect(mockSharpChain.grayscale).not.toHaveBeenCalled();
    });
  });

  describe('getSupportedLanguages', () => {
    it('returns at least 15 supported languages', () => {
      const languages = service.getSupportedLanguages();

      expect(languages.length).toBeGreaterThanOrEqual(15);
      expect(languages).toContainEqual(expect.objectContaining({ code: 'eng', name: 'English' }));
      expect(languages).toContainEqual(expect.objectContaining({ code: 'rus', name: 'Russian' }));
      expect(languages).toContainEqual(expect.objectContaining({ code: 'deu', name: 'German' }));
      expect(languages).toContainEqual(expect.objectContaining({ code: 'ara', name: 'Arabic' }));
      expect(languages).toContainEqual(expect.objectContaining({ code: 'jpn', name: 'Japanese' }));
    });
  });

  describe('resolveLanguages', () => {
    it('returns default languages when none specified', () => {
      expect(service.resolveLanguages(undefined)).toEqual(['eng']);
    });

    it('validates and returns requested languages', () => {
      expect(service.resolveLanguages(['deu', 'fra'])).toEqual(['deu', 'fra']);
    });

    it('filters out unsupported language codes', () => {
      expect(service.resolveLanguages(['eng', 'xxx_invalid'])).toEqual(['eng']);
    });

    it('falls back to eng if all requested languages are invalid', () => {
      expect(service.resolveLanguages(['xxx', 'yyy'])).toEqual(['eng']);
    });
  });

  describe('detectScriptFromText', () => {
    it('detects Cyrillic script from Russian text', () => {
      expect(service.detectScriptFromText('Магазин Пятёрочка Итого: 1500.00')).toBe('Cyrillic');
    });

    it('detects CJK script from Chinese text', () => {
      expect(service.detectScriptFromText('超市购物 总计：¥150.00')).toBe('CJK');
    });

    it('detects Arabic script', () => {
      expect(service.detectScriptFromText('المجموع الكلي ١٥٠٫٠٠ ريال')).toBe('Arabic');
    });

    it('detects Latin as default', () => {
      expect(service.detectScriptFromText('Total: $15.00 Thank you')).toBe('Latin');
    });

    it('handles mixed scripts by choosing the dominant one', () => {
      expect(['Latin', 'Cyrillic']).toContain(service.detectScriptFromText('Store ABC Магазин 15.00'));
    });
  });

  describe('getLanguagesForScript', () => {
    it('returns Cyrillic OCR languages', () => {
      expect(service.getLanguagesForScript('Cyrillic')).toContain('rus');
    });

    it('returns all CJK OCR languages', () => {
      expect(service.getLanguagesForScript('CJK')).toEqual(
        expect.arrayContaining(['chi_sim', 'jpn', 'kor']),
      );
    });

    it('returns eng for Latin script', () => {
      expect(service.getLanguagesForScript('Latin')).toContain('eng');
    });
  });

  describe('getSupportedImageExtensions', () => {
    it('returns supported extensions', () => {
      const extensions = service.getSupportedImageExtensions();

      expect(extensions).toContain('.png');
      expect(extensions).toContain('.jpg');
      expect(extensions).toContain('.jpeg');
      expect(extensions).toContain('.tiff');
      expect(extensions).toContain('.webp');
      expect(extensions).toContain('.bmp');
    });
  });
});
