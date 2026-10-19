/**
 * Advanced language detection with multiple strategies and caching
 *
 * Features:
 * - Primary: franc library for accurate language detection
 * - Fallback 1: Character n-gram frequency analysis
 * - Fallback 2: Month name heuristics (existing logic)
 * - Caching by domain/bank pattern
 * - Confidence scoring and explainability
 */

type FrancFn = typeof import('franc').franc;

import { detectLocaleFromText as legacyDetectLocale } from './language-detector.util';

export interface AdvancedDetectionResult {
  locale: string;
  confidence: number;
  method: 'franc' | 'ngram' | 'legacy' | 'unknown' | 'cached';
  reason: string;
  alternatives?: Array<{ locale: string; confidence: number }>;
}

interface LanguageCache {
  [key: string]: {
    locale: string;
    confidence: number;
    method: AdvancedDetectionResult['method'];
    timestamp: number;
  };
}

class LanguageDetectionCache {
  private cache: LanguageCache = {};
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_SIZE = 1000;

  private generateKey(text: string, context?: string): string {
    // Generate cache key based on text hash and context
    const textHash = this.hashText(text.slice(0, 500)); // First 500 chars
    const contextHash = context ? this.hashText(context) : '';
    return `${textHash}:${contextHash}`;
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  get(text: string, context?: string): AdvancedDetectionResult | null {
    const key = this.generateKey(text, context);
    const entry = this.cache[key];

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.TTL) {
      delete this.cache[key];
      return null;
    }

    return {
      locale: entry.locale,
      confidence: entry.confidence,
      method: entry.method,
      reason: `cached:${entry.method}`,
    };
  }

  set(text: string, result: AdvancedDetectionResult, context?: string): void {
    const key = this.generateKey(text, context);

    // Clean old entries if cache is full
    if (Object.keys(this.cache).length >= this.MAX_SIZE) {
      this.cleanup();
    }

    this.cache[key] = {
      locale: result.locale,
      confidence: result.confidence,
      method: result.method,
      timestamp: Date.now(),
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Object.entries(this.cache);

    // Remove expired entries
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.TTL) {
        delete this.cache[key];
      }
    }

    // If still too many entries, remove oldest 25%
    if (Object.keys(this.cache).length >= this.MAX_SIZE) {
      const sorted = entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(this.MAX_SIZE * 0.25));

      for (const [key] of sorted) {
        delete this.cache[key];
      }
    }
  }
}

/**
 * Character n-gram frequency analysis for language detection
 * This is a simplified implementation that can work as a fallback
 */
class NgramLanguageDetector {
  private readonly NGRAM_SIZES = [2, 3, 4]; // bigrams, trigrams, quadgrams

  // Character n-gram profiles for major languages (simplified)
  private readonly languageProfiles: Record<string, string[]> = {
    en: [
      'th',
      'he',
      'in',
      'er',
      'an',
      're',
      'ed',
      'nd',
      'on',
      'en',
      'the',
      'and',
      'ing',
      'her',
      'ere',
    ],
    ru: [
      'то',
      'на',
      'ен',
      'ов',
      'ер',
      'ст',
      'ал',
      'ел',
      'ин',
      'ри',
      'тов',
      'ени',
      'оро',
      'еров',
      'ство',
    ],
    de: [
      'er',
      'en',
      'ch',
      'te',
      'nd',
      'in',
      'ge',
      'es',
      'ie',
      'ai',
      'ich',
      'nde',
      'die',
      'ung',
      'chen',
    ],
    fr: [
      'de',
      'le',
      'en',
      're',
      'et',
      'on',
      'nt',
      'es',
      'ai',
      'te',
      'les',
      'ent',
      'que',
      'ion',
      'des',
    ],
    es: [
      'de',
      'la',
      'en',
      'el',
      'os',
      're',
      'as',
      'on',
      'er',
      'al',
      'los',
      'del',
      'una',
      'ción',
      'por',
    ],
    it: [
      'di',
      'de',
      'la',
      'il',
      'le',
      're',
      'on',
      'ni',
      'er',
      'ar',
      'del',
      'nel',
      'une',
      'tto',
      'mento',
    ],
    pt: [
      'de',
      'a ',
      'os',
      'do',
      'da',
      'em',
      'no',
      'as',
      're',
      'ar',
      'que',
      'ente',
      'para',
      'como',
      'esta',
    ],
    tr: [
      'ar',
      'er',
      'an',
      'la',
      'le',
      'in',
      'ri',
      'ma',
      'da',
      'ba',
      'lar',
      'dir',
      'mek',
      'len',
      'aca',
    ],
    kk: [
      'ар',
      'ан',
      'ер',
      'ен',
      'ал',
      'ыз',
      'ас',
      'та',
      'ин',
      'де',
      'ары',
      'іні',
      'дег',
      'енін',
      'көр',
    ],
  };

  private extractNgrams(text: string, n: number): string[] {
    const ngrams: string[] = [];
    const cleanText = text.toLowerCase().replace(/[^a-zа-яёәқғөұһүі]/g, '');

    for (let i = 0; i <= cleanText.length - n; i++) {
      const ngram = cleanText.slice(i, i + n);
      if (ngram.length === n) {
        ngrams.push(ngram);
      }
    }

    return ngrams;
  }

  private calculateSimilarity(textNgrams: string[], profileNgrams: string[]): number {
    const intersection = textNgrams.filter(ngram => profileNgrams.includes(ngram));
    const union = new Set([...textNgrams, ...profileNgrams]);

    return intersection.length / union.size;
  }

  detect(text: string): AdvancedDetectionResult {
    if (!text || text.length < 50) {
      return {
        locale: 'unknown',
        confidence: 0,
        method: 'ngram',
        reason: 'text-too-short',
      };
    }

    const scores: Array<{ locale: string; score: number }> = [];

    // Extract n-grams from text
    const allTextNgrams = this.NGRAM_SIZES.flatMap(n => this.extractNgrams(text, n));

    // Compare with each language profile
    for (const [locale, profileNgrams] of Object.entries(this.languageProfiles)) {
      const score = this.calculateSimilarity(allTextNgrams, profileNgrams);
      if (score > 0) {
        scores.push({ locale, score });
      }
    }

    // Sort by score and return best match
    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0) {
      return {
        locale: 'unknown',
        confidence: 0,
        method: 'ngram',
        reason: 'no-matches',
      };
    }

    const best = scores[0];
    const alternatives = scores.slice(1, 3).map(s => ({ locale: s.locale, confidence: s.score }));

    return {
      locale: best.locale,
      confidence: Math.min(best.score * 2, 1), // Scale confidence
      method: 'ngram',
      reason: `ngram-score:${best.score.toFixed(3)}`,
      alternatives,
    };
  }
}

class AdvancedLanguageDetector {
  private cache = new LanguageDetectionCache();
  private ngramDetector = new NgramLanguageDetector();
  private francFn: FrancFn | null = null;
  private francInit: Promise<FrancFn> | null = null;

  /**
   * Detect language with multiple strategies and fallbacks
   */
  async detectLanguage(
    text: string,
    context?: { bankName?: string; domain?: string },
  ): Promise<AdvancedDetectionResult> {
    if (!text?.trim()) {
      return {
        locale: 'unknown',
        confidence: 0,
        method: 'unknown',
        reason: 'empty-text',
      };
    }

    // Check cache first
    const cacheKey = context?.bankName || context?.domain || 'general';
    const cached = this.cache.get(text, cacheKey);
    if (cached) {
      return cached;
    }

    let result: AdvancedDetectionResult;

    // Strategy 1: Try franc library (most accurate)
    try {
      const francResult = (await this.getFranc())(text);
      if (francResult !== 'und') {
        // Map franc codes to our locale format
        const localeMap: Record<string, string> = {
          rus: 'ru',
          eng: 'en',
          ger: 'de',
          fre: 'fr',
          spa: 'es',
          ita: 'it',
          por: 'pt',
          tur: 'tr',
          kaz: 'kk',
        };

        const locale = localeMap[francResult] || francResult;
        result = {
          locale,
          confidence: 0.9,
          method: 'franc',
          reason: `franc-code:${francResult}`,
        };

        // Cache and return
        this.cache.set(text, result, cacheKey);
        return result;
      }
    } catch (error) {
      console.warn('Franc detection failed:', error);
    }

    // Strategy 2: N-gram frequency analysis
    const ngramResult = this.ngramDetector.detect(text);
    if (ngramResult.confidence > 0.3) {
      result = ngramResult;
      this.cache.set(text, result, cacheKey);
      return result;
    }

    // Strategy 3: Legacy month name detection
    const legacyResult = legacyDetectLocale(text);
    if (legacyResult.confidence > 0.2) {
      result = {
        locale: legacyResult.locale,
        confidence: legacyResult.confidence,
        method: 'legacy',
        reason: legacyResult.reason,
      };
      this.cache.set(text, result, cacheKey);
      return result;
    }

    // Default fallback
    result = {
      locale: 'unknown',
      confidence: 0,
      method: 'unknown',
      reason: 'all-methods-failed',
    };

    this.cache.set(text, result, cacheKey);
    return result;
  }

  /**
   * Get language information with fallback options
   */
  async getLanguageInfo(
    text: string,
    context?: { bankName?: string; domain?: string },
  ): Promise<{
    primary: AdvancedDetectionResult;
    supported: boolean;
    suggestions?: string[];
  }> {
    const primary = await this.detectLanguage(text, context);

    const supportedLanguages = ['en', 'ru', 'kk', 'de', 'fr', 'es', 'it', 'pt', 'tr'];
    const supported = supportedLanguages.includes(primary.locale);

    let suggestions: string[] | undefined;
    if (!supported && primary.alternatives) {
      suggestions = primary.alternatives
        .filter(alt => supportedLanguages.includes(alt.locale))
        .map(alt => alt.locale);
    }

    return {
      primary,
      supported,
      suggestions: suggestions && suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache = new LanguageDetectionCache();
  }

  private async getFranc(): Promise<FrancFn> {
    if (this.francFn) {
      return this.francFn;
    }

    if (!this.francInit) {
      this.francInit = this.loadFranc();
    }

    try {
      this.francFn = await this.francInit;
      return this.francFn;
    } catch (error) {
      this.francInit = null;
      throw error;
    }
  }

  private async loadFranc(): Promise<FrancFn> {
    const { franc } = await this.loadFrancModule();
    return franc as FrancFn;
  }

  private async loadFrancModule(): Promise<typeof import('franc')> {
    // Use native dynamic import to load ESM from CommonJS output.
    const load = new Function('return import("franc")');
    return load() as Promise<typeof import('franc')>;
  }
}

// Export singleton instance
export const advancedLanguageDetector = new AdvancedLanguageDetector();
