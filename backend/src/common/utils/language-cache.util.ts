/**
 * Language detection cache service for bank/domain-specific language patterns
 * Improves performance and consistency by caching language detection results
 */

import { Injectable } from '@nestjs/common';
import { AdvancedDetectionResult } from './advanced-language-detector.util';

interface LanguageCacheEntry {
  result: AdvancedDetectionResult;
  timestamp: number;
  count: number;
}

interface DomainLanguageEntry {
  language: string;
  confidence: number;
  sampleSize: number;
}

@Injectable()
export class LanguageCacheService {
  private readonly fileCache = new Map<string, LanguageCacheEntry>();
  private readonly domainCache = new Map<string, DomainLanguageEntry>();
  private readonly bankCache = new Map<string, DomainLanguageEntry>();

  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 10000;
  private readonly MIN_CONFIDENCE_FOR_CACHING = 0.7;

  /**
   * Cache language detection result for a specific file hash
   */
  setFileCache(fileHash: string, result: AdvancedDetectionResult): void {
    if (result.confidence < this.MIN_CONFIDENCE_FOR_CACHING) {
      return;
    }

    this.cleanExpiredEntries();

    const existing = this.fileCache.get(fileHash);
    if (existing) {
      existing.count += 1;
      existing.result = result;
    } else {
      this.fileCache.set(fileHash, {
        result,
        timestamp: Date.now(),
        count: 1,
      });
    }

    this.limitCacheSize();
  }

  /**
   * Get cached language detection result for file hash
   */
  getFileCache(fileHash: string): AdvancedDetectionResult | null {
    const entry = this.fileCache.get(fileHash);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.fileCache.delete(fileHash);
      return null;
    }

    return entry.result;
  }

  /**
   * Update domain language preferences based on detection results
   */
  updateDomainLanguage(domain: string, result: AdvancedDetectionResult, bankName?: string): void {
    if (result.confidence < this.MIN_CONFIDENCE_FOR_CACHING) {
      return;
    }

    const targetCache = bankName ? this.bankCache : this.domainCache;
    const key = bankName || domain;

    const existing = targetCache.get(key);
    if (existing) {
      // Weighted average of confidence
      const newConfidence =
        (existing.confidence * existing.sampleSize + result.confidence) / (existing.sampleSize + 1);
      existing.sampleSize += 1;
      existing.confidence = newConfidence;

      // Update language if confidence is significantly higher
      if (result.confidence > existing.confidence * 1.2) {
        existing.language = result.locale;
      }
    } else {
      targetCache.set(key, {
        language: result.locale,
        confidence: result.confidence,
        sampleSize: 1,
      });
    }
  }

  /**
   * Get cached language preference for domain or bank
   */
  getDomainLanguage(domain: string, bankName?: string): AdvancedDetectionResult | null {
    const targetCache = bankName ? this.bankCache : this.domainCache;
    const key = bankName || domain;

    const mapping = targetCache.get(key);
    if (!mapping) {
      return null;
    }

    return {
      locale: mapping.language,
      confidence: mapping.confidence,
      method: 'cached' as const,
      reason: `domain-cache:${key}`,
    };
  }

  /**
   * Extract domain from file path or URL
   */
  extractDomain(source: string): string {
    // Handle URLs
    if (source.startsWith('http://') || source.startsWith('https://')) {
      try {
        const url = new URL(source);
        return url.hostname;
      } catch {
        return source;
      }
    }

    // Handle file paths - extract directory or bank name
    const parts = source.split(/[/\\]/);

    // Look for bank name in path
    const bankKeywords = ['bank', 'kaspi', 'bereke', 'halyk', 'alfa', 'vtb', 'tinkoff'];
    for (const part of parts) {
      const lowerPart = part.toLowerCase();
      for (const keyword of bankKeywords) {
        if (lowerPart.includes(keyword)) {
          return keyword;
        }
      }
    }

    // Return parent directory name
    return parts[parts.length - 2] || 'unknown';
  }

  /**
   * Get language suggestions based on domain and bank patterns
   */
  getLanguageSuggestions(
    source: string,
    bankName?: string,
  ): Array<{ language: string; confidence: number; source: string }> {
    const suggestions: Array<{
      language: string;
      confidence: number;
      source: string;
    }> = [];

    const domain = this.extractDomain(source);

    // Check bank-specific cache first
    if (bankName) {
      const bankResult = this.getDomainLanguage(domain, bankName);
      if (bankResult) {
        suggestions.push({
          language: bankResult.locale,
          confidence: bankResult.confidence * 0.8, // Lower weight for bank-specific
          source: `bank-cache:${bankName}`,
        });
      }
    }

    // Check domain cache
    const domainResult = this.getDomainLanguage(domain);
    if (domainResult) {
      suggestions.push({
        language: domainResult.locale,
        confidence: domainResult.confidence * 0.6, // Lower weight for domain-specific
        source: `domain-cache:${domain}`,
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Pre-warm cache with known domain patterns
   */
  preWarmCache(): void {
    // Common banking domains and their likely languages
    const knownDomains: Record<string, { language: string; confidence: number }> = {
      'kaspi.kz': { language: 'kk', confidence: 0.9 },
      'berekebank.kz': { language: 'kk', confidence: 0.9 },
      'halykbank.kz': { language: 'kk', confidence: 0.9 },
      'alfabank.kz': { language: 'ru', confidence: 0.8 },
      'tinkoff.ru': { language: 'ru', confidence: 0.9 },
      'vtb.ru': { language: 'ru', confidence: 0.9 },
    };

    for (const [domain, data] of Object.entries(knownDomains)) {
      this.domainCache.set(domain, {
        language: data.language,
        confidence: data.confidence,
        sampleSize: 10, // Pre-warm with some sample size
      });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    fileCache: { size: number; hitRate: number };
    domainCache: { size: number };
    bankCache: { size: number };
  } {
    let totalHits = 0;
    let totalEntries = 0;

    for (const entry of this.fileCache.values()) {
      totalHits += entry.count;
      totalEntries += 1;
    }

    return {
      fileCache: {
        size: this.fileCache.size,
        hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
      },
      domainCache: {
        size: this.domainCache.size,
      },
      bankCache: {
        size: this.bankCache.size,
      },
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.fileCache.clear();
    this.domainCache.clear();
    this.bankCache.clear();
  }

  /**
   * Clean expired entries from cache
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();

    for (const [key, entry] of this.fileCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.fileCache.delete(key);
      }
    }
  }

  /**
   * Limit cache size to prevent memory issues
   */
  private limitCacheSize(): void {
    if (this.fileCache.size <= this.MAX_CACHE_SIZE) {
      return;
    }

    // Sort by timestamp and remove oldest entries
    const entries = Array.from(this.fileCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    const toDelete = entries.slice(0, this.fileCache.size - this.MAX_CACHE_SIZE + 1000);
    for (const [key] of toDelete) {
      this.fileCache.delete(key);
    }
  }

  /**
   * Export cache data for persistence
   */
  exportCache(): {
    domainCache: Record<string, DomainLanguageEntry>;
    bankCache: Record<string, DomainLanguageEntry>;
  } {
    const domainCache: Record<string, DomainLanguageEntry> = {};
    const bankCache: Record<string, DomainLanguageEntry> = {};

    for (const [key, value] of this.domainCache.entries()) {
      domainCache[key] = value;
    }

    for (const [key, value] of this.bankCache.entries()) {
      bankCache[key] = value;
    }

    return { domainCache, bankCache };
  }

  /**
   * Import cache data from persistence
   */
  importCache(data: {
    domainCache?: Record<string, DomainLanguageEntry>;
    bankCache?: Record<string, DomainLanguageEntry>;
  }): void {
    if (data.domainCache) {
      for (const [key, value] of Object.entries(data.domainCache)) {
        this.domainCache.set(key, value);
      }
    }

    if (data.bankCache) {
      for (const [key, value] of Object.entries(data.bankCache)) {
        this.bankCache.set(key, value);
      }
    }
  }
}
