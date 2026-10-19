/**
 * Unicode-aware regex patterns for multi-language text processing
 * Supports comprehensive Unicode character sets for international parsing
 */

interface UnicodePatterns {
  // Text patterns
  letters: RegExp;
  numbers: RegExp;
  alphanumeric: RegExp;
  words: RegExp;

  // Currency symbols
  currencySymbols: RegExp;

  // Date patterns
  dayNames: RegExp;
  monthNames: RegExp;

  // Separators
  whitespace: RegExp;
  punctuation: RegExp;

  // Language-specific character ranges
  latin: RegExp;
  cyrillic: RegExp;
  arabic: RegExp;
  chinese: RegExp;
  japanese: RegExp;
  korean: RegExp;
  hebrew: RegExp;
  thai: RegExp;
  devanagari: RegExp;

  // Special characters
  diacritics: RegExp;
  mathSymbols: RegExp;
  arrows: RegExp;
}

/**
 * Unicode character ranges for different scripts
 */
const UNICODE_RANGES = {
  // Latin scripts
  latinBasic: '\\u0000-\\u007F', // Basic Latin
  latin1: '\\u0080-\\u00FF', // Latin-1 Supplement
  latinExtendedA: '\\u0100-\\u017F', // Latin Extended-A
  latinExtendedB: '\\u0180-\\u024F', // Latin Extended-B
  latinExtendedAdditional: '\\u1E00-\\u1EFF', // Latin Extended Additional

  // Cyrillic
  cyrillic: '\\u0400-\\u04FF', // Cyrillic
  cyrillicSupplement: '\\u0500-\\u052F', // Cyrillic Supplement
  cyrillicExtendedA: '\\u2DE0-\\u2DFF', // Cyrillic Extended-A
  cyrillicExtendedB: '\\uA640-\\uA69F', // Cyrillic Extended-B

  // Arabic
  arabic: '\\u0600-\\u06FF', // Arabic
  arabicSupplement: '\\u0750-\\u077F', // Arabic Supplement
  arabicExtendedA: '\\u08A0-\\u08FF', // Arabic Extended-A
  arabicExtendedB: '\\u0870-\\u089F', // Arabic Extended-B

  // Asian scripts
  chinese: '\\u4E00-\\u9FFF', // CJK Unified Ideographs
  hiragana: '\\u3040-\\u309F', // Hiragana
  katakana: '\\u30A0-\\u30FF', // Katakana
  hangul: '\\uAC00-\\uD7AF', // Hangul Syllables

  // Other scripts
  hebrew: '\\u0590-\\u05FF', // Hebrew
  thai: '\\u0E00-\\u0E7F', // Thai
  devanagari: '\\u0900-\\u097F', // Devanagari

  // Currency symbols
  currency: '\\u20A0-\\u20CF', // Currency Symbols

  // Punctuation and symbols
  punctuation: '\\u2000-\\u206F', // General Punctuation
  mathSymbols: '\\u2200-\\u22FF', // Mathematical Operators
  arrows: '\\u2190-\\u21FF', // Arrows

  // Diacritics
  combiningMarks: '\\u0300-\\u036F', // Combining Diacritical Marks
  combiningDiacritics: '\\u20D0-\\u20FF', // Combining Diacritical Marks for Symbols
};

/**
 * Unicode-aware regex patterns for comprehensive international text processing
 */
const UNICODE_PATTERNS: UnicodePatterns = {
  // Basic text patterns (Unicode-aware)
  letters: new RegExp(
    `[${UNICODE_RANGES.latinBasic}${UNICODE_RANGES.latin1}${UNICODE_RANGES.latinExtendedA}${UNICODE_RANGES.latinExtendedB}${UNICODE_RANGES.cyrillic}${UNICODE_RANGES.arabic}${UNICODE_RANGES.hebrew}${UNICODE_RANGES.thai}${UNICODE_RANGES.devanagari}${UNICODE_RANGES.chinese}${UNICODE_RANGES.hiragana}${UNICODE_RANGES.katakana}${UNICODE_RANGES.hangul}]+`,
    'gu',
  ),

  numbers: /\d+/gu,

  alphanumeric: new RegExp(
    `[${UNICODE_RANGES.latinBasic}${UNICODE_RANGES.latin1}${UNICODE_RANGES.latinExtendedA}${UNICODE_RANGES.latinExtendedB}${UNICODE_RANGES.cyrillic}${UNICODE_RANGES.arabic}${UNICODE_RANGES.hebrew}${UNICODE_RANGES.thai}${UNICODE_RANGES.devanagari}0-9]+`,
    'gu',
  ),

  words: new RegExp(
    `[${UNICODE_RANGES.latinBasic}${UNICODE_RANGES.latin1}${UNICODE_RANGES.latinExtendedA}${UNICODE_RANGES.latinExtendedB}${UNICODE_RANGES.cyrillic}${UNICODE_RANGES.arabic}${UNICODE_RANGES.hebrew}${UNICODE_RANGES.thai}${UNICODE_RANGES.devanagari}]+[${UNICODE_RANGES.latinBasic}${UNICODE_RANGES.latin1}${UNICODE_RANGES.latinExtendedA}${UNICODE_RANGES.latinExtendedB}${UNICODE_RANGES.cyrillic}${UNICODE_RANGES.arabic}${UNICODE_RANGES.hebrew}${UNICODE_RANGES.thai}${UNICODE_RANGES.devanagari}'\\-]*`,
    'gu',
  ),

  // Currency symbols (including common Unicode currency symbols and ASCII)
  currencySymbols: /\p{Sc}+/gu,

  // Date-related patterns
  dayNames: new RegExp(
    '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|' +
      'понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|пн|вт|ср|чт|пт|сб|вс|' +
      'дүйсенбі|сейсенбі|сәрсенбі|бейсенбі|жұма|сенбі|жексенбі|' +
      'lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim|' +
      'montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so|' +
      'lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|' +
      'segunda|terça|quarta|quinta|sexta|sábado|domingo|seg|ter|qua|qui|sex|sáb|dom|' +
      'pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar|pts|sal|çar|per|cum|cmt|paz)',
    'giu',
  ),

  monthNames: new RegExp(
    '(?:january|february|march|april|may|june|july|august|september|october|november|december|' +
      'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|' +
      'январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь|' +
      'янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек|' +
      'қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|қазан|қараша|желтоқсан|' +
      'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|' +
      'januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|' +
      'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|' +
      'janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|' +
      'ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)',
    'giu',
  ),

  // Separator patterns
  whitespace: new RegExp(`[${UNICODE_RANGES.punctuation}\\s\\t\\n\\r\\f\\v]+`, 'gu'),
  punctuation: new RegExp(
    `[${UNICODE_RANGES.punctuation}.,;:!?'"\\[\\](){}<>@#%&*+=|\\\\/\\\\-]+`,
    'gu',
  ),

  // Language-specific character ranges
  latin: new RegExp(
    `[${UNICODE_RANGES.latinBasic}${UNICODE_RANGES.latin1}${UNICODE_RANGES.latinExtendedA}${UNICODE_RANGES.latinExtendedB}]+`,
    'gu',
  ),
  cyrillic: new RegExp(
    `[${UNICODE_RANGES.cyrillic}${UNICODE_RANGES.cyrillicSupplement}${UNICODE_RANGES.cyrillicExtendedA}${UNICODE_RANGES.cyrillicExtendedB}]+`,
    'gu',
  ),
  arabic: new RegExp(
    `[${UNICODE_RANGES.arabic}${UNICODE_RANGES.arabicSupplement}${UNICODE_RANGES.arabicExtendedA}${UNICODE_RANGES.arabicExtendedB}]+`,
    'gu',
  ),
  chinese: new RegExp(`[${UNICODE_RANGES.chinese}]+`, 'gu'),
  japanese: new RegExp(
    `[${UNICODE_RANGES.chinese}${UNICODE_RANGES.hiragana}${UNICODE_RANGES.katakana}]+`,
    'gu',
  ),
  korean: new RegExp(`[${UNICODE_RANGES.hangul}]+`, 'gu'),
  hebrew: new RegExp(`[${UNICODE_RANGES.hebrew}]+`, 'gu'),
  thai: new RegExp(`[${UNICODE_RANGES.thai}]+`, 'gu'),
  devanagari: new RegExp(`[${UNICODE_RANGES.devanagari}]+`, 'gu'),

  // Special character patterns
  diacritics: new RegExp(
    `[${UNICODE_RANGES.combiningMarks}${UNICODE_RANGES.combiningDiacritics}]+`,
    'gu',
  ),
  mathSymbols: new RegExp(`[${UNICODE_RANGES.mathSymbols}]+`, 'gu'),
  arrows: new RegExp(`[${UNICODE_RANGES.arrows}]+`, 'gu'),
};

/**
 * Language-specific normalization functions
 */
export namespace UnicodeTextProcessor {
  /**
   * Normalize Unicode text for consistent processing
   */
  export function normalize(text: string): string {
    if (!text) {
      return text;
    }

    // Normalize Unicode (NFC form - canonical decomposition)
    let normalized = text.normalize('NFC');

    // Replace various Unicode whitespace with standard space
    normalized = normalized.replace(/[\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, ' ');

    // Replace Unicode dash variants with standard hyphen
    normalized = normalized.replace(/[\u2010-\u2015\u2212\u2213\uFE58\uFE63\uFF0D]+/g, '-');

    // Replace Unicode quote variants with standard quotes
    normalized = normalized.replace(
      /[\u2018\u2019\u201B\u2032\u2035\u2039\u203A\u300C\u300D]/g,
      "'",
    );
    normalized = normalized.replace(/[\u201C-\u201F\u2033\u2036\u2037\u300E\u300F]/g, '"');

    return normalized;
  }

  /**
   * Detect script types present in text
   */
  export function detectScripts(text: string): string[] {
    const scripts: string[] = [];

    if (UNICODE_PATTERNS.latin.test(text)) {
      scripts.push('latin');
    }
    if (UNICODE_PATTERNS.cyrillic.test(text)) {
      scripts.push('cyrillic');
    }
    if (UNICODE_PATTERNS.arabic.test(text)) {
      scripts.push('arabic');
    }
    if (UNICODE_PATTERNS.chinese.test(text)) {
      scripts.push('chinese');
    }
    if (UNICODE_PATTERNS.japanese.test(text)) {
      scripts.push('japanese');
    }
    if (UNICODE_PATTERNS.korean.test(text)) {
      scripts.push('korean');
    }
    if (UNICODE_PATTERNS.hebrew.test(text)) {
      scripts.push('hebrew');
    }
    if (UNICODE_PATTERNS.thai.test(text)) {
      scripts.push('thai');
    }
    if (UNICODE_PATTERNS.devanagari.test(text)) {
      scripts.push('devanagari');
    }

    return scripts;
  }

  /**
   * Extract words using Unicode-aware patterns
   */
  export function extractWords(text: string): string[] {
    const normalized = normalize(text);
    return normalized.match(UNICODE_PATTERNS.words) || [];
  }

  /**
   * Extract numbers from Unicode text
   */
  export function extractNumbers(text: string): string[] {
    return text.match(UNICODE_PATTERNS.numbers) || [];
  }

  /**
   * Extract currency symbols from text
   */
  export function extractCurrencySymbols(text: string): string[] {
    return text.match(UNICODE_PATTERNS.currencySymbols) || [];
  }

  /**
   * Remove diacritics from text (basic normalization)
   */
  export function removeDiacritics(text: string): string {
    return text.normalize('NFD').replace(UNICODE_PATTERNS.diacritics, '').normalize('NFC');
  }

  /**
   * Clean and normalize text for parsing
   */
  export function cleanForParsing(text: string): string {
    if (!text) {
      return text;
    }

    let cleaned = normalize(text);

    // Remove excessive punctuation
    cleaned = cleaned.replace(UNICODE_PATTERNS.punctuation, ' ');

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Check if text contains primarily numeric content
   */
  export function isNumeric(text: string): boolean {
    const cleaned = normalize(text).replace(/[^\d.,\s]/g, '');
    const numericChars = (cleaned.match(/[\d]/g) || []).length;
    const totalChars = cleaned.replace(/\s/g, '').length;

    return totalChars > 0 && numericChars / totalChars > 0.7;
  }

  /**
   * Extract dates from text using Unicode patterns
   */
  export function extractDateStrings(text: string): string[] {
    const dates: string[] = [];

    // Standard date formats
    const datePatterns = [
      /\b\d{1,2}[/\-.,]\d{1,2}[/\-.,]\d{2,4}\b/g,
      /\b\d{4}[/\-.,]\d{1,2}[/\-.,]\d{1,2}\b/g,
      // Match with month names (Unicode-aware)
      /\b\d{1,2}\s+[a-z\u00c0-\u017f\u0400-\u04ff]+\s+\d{2,4}\b/giu,
      /\b[a-z\u00c0-\u017f\u0400-\u04ff]+\s+\d{1,2},?\s+\d{2,4}\b/giu,
    ];

    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    }

    return dates;
  }

  /**
   * Split text into tokens using Unicode-aware rules
   */
  export function tokenize(text: string): string[] {
    const normalized = normalize(text);

    // Split on Unicode-aware boundaries
    return normalized
      .split(UNICODE_PATTERNS.whitespace)
      .map(token => token.trim())
      .filter(token => token.length > 0);
  }
}

/**
 * Unicode-safe regex utilities for field detection
 */
export namespace UnicodeFieldDetector {
  /**
   * Create case-insensitive Unicode-aware regex from keywords
   */
  export function createKeywordRegex(keywords: string[]): RegExp {
    const escapedKeywords = keywords.map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    // Include Unicode letters and common diacritics
    const pattern = `\\b(?:${escapedKeywords.join('|')})\\b`;

    return new RegExp(pattern, 'giu'); // i: case-insensitive, u: Unicode, g: global
  }

  /**
   * Check if header matches any keywords (Unicode-aware)
   */
  export function matchesKeywords(header: string, keywords: string[]): boolean {
    const regex = createKeywordRegex(keywords);
    return regex.test(header);
  }

  /**
   * Find best matching keyword in header
   */
  export function findBestMatch(header: string, keywords: string[]): string | null {
    const normalizedHeader = UnicodeTextProcessor.normalize(header.toLowerCase());
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const keyword of keywords) {
      const normalizedKeyword = UnicodeTextProcessor.normalize(keyword.toLowerCase());

      // Simple similarity scoring
      if (normalizedHeader.includes(normalizedKeyword)) {
        const score = normalizedKeyword.length / normalizedHeader.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = keyword;
        }
      }
    }

    return bestMatch;
  }
}
