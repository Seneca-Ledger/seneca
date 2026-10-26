/**
 * Feature flags service for enabling/disabling experimental and ML features
 * Allows gradual rollout and fallback capabilities
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FeatureFlags {
  // Language detection features
  languageDetection: {
    francEnabled: boolean;
    ngramFallbackEnabled: boolean;
    legacyFallbackEnabled: boolean;
    mlClassificationEnabled: boolean;
  };

  // Number parsing features
  numberParsing: {
    advancedNumberParserEnabled: boolean;
    currencyDetectionEnabled: boolean;
    multiFormatSupportEnabled: boolean;
  };

  // Unicode processing features
  unicodeProcessing: {
    scriptDetectionEnabled: boolean;
    diacriticNormalizationEnabled: boolean;
    advancedTokenizationEnabled: boolean;
  };

  // ML features
  mlFeatures: {
    rowClassificationEnabled: boolean;
    headerExtractionEnabled: boolean;
    languageModelEnabled: boolean;
  };

  // Caching features
  caching: {
    languageCacheEnabled: boolean;
    domainLanguageCacheEnabled: boolean;
    bankProfileCacheEnabled: boolean;
  };

  // Bank profile features
  bankProfiles: {
    yamlProfilesEnabled: boolean;
    customProfilesEnabled: boolean;
    profileMatchingEnabled: boolean;
  };

  // Fallback modes
  fallbacks: {
    strictModeEnabled: boolean;
    permissiveModeEnabled: boolean;
    debugModeEnabled: boolean;
  };
}

type MutableFlagGroup = Record<string, boolean>;

const isMutableFlagGroup = (value: unknown): value is MutableFlagGroup =>
  typeof value === 'object' && value !== null;

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private flags: FeatureFlags;

  constructor(private configService?: ConfigService) {
    this.initializeFlags();
  }

  /**
   * Initialize feature flags from configuration and environment
   */
  private initializeFlags(): void {
    this.flags = {
      languageDetection: {
        francEnabled: this.getFlag('LANG_DETECTION_FRANC_ENABLED', true),
        ngramFallbackEnabled: this.getFlag('LANG_DETECTION_NGRAM_ENABLED', true),
        legacyFallbackEnabled: this.getFlag('LANG_DETECTION_LEGACY_ENABLED', true),
        mlClassificationEnabled: this.getFlag('LANG_DETECTION_ML_ENABLED', false),
      },

      numberParsing: {
        advancedNumberParserEnabled: this.getFlag('NUMBER_PARSING_ADVANCED_ENABLED', true),
        currencyDetectionEnabled: this.getFlag('NUMBER_PARSING_CURRENCY_ENABLED', true),
        multiFormatSupportEnabled: this.getFlag('NUMBER_PARSING_MULTIFORMAT_ENABLED', true),
      },

      unicodeProcessing: {
        scriptDetectionEnabled: this.getFlag('UNICODE_SCRIPT_DETECTION_ENABLED', true),
        diacriticNormalizationEnabled: this.getFlag(
          'UNICODE_DIACRITIC_NORMALIZATION_ENABLED',
          true,
        ),
        advancedTokenizationEnabled: this.getFlag('UNICODE_ADVANCED_TOKENIZATION_ENABLED', true),
      },

      mlFeatures: {
        rowClassificationEnabled: this.getFlag('ML_ROW_CLASSIFICATION_ENABLED', false),
        headerExtractionEnabled: this.getFlag('ML_HEADER_EXTRACTION_ENABLED', false),
        languageModelEnabled: this.getFlag('ML_LANGUAGE_MODEL_ENABLED', false),
      },

      caching: {
        languageCacheEnabled: this.getFlag('CACHE_LANGUAGE_ENABLED', true),
        domainLanguageCacheEnabled: this.getFlag('CACHE_DOMAIN_LANGUAGE_ENABLED', true),
        bankProfileCacheEnabled: this.getFlag('CACHE_BANK_PROFILE_ENABLED', true),
      },

      bankProfiles: {
        yamlProfilesEnabled: this.getFlag('BANK_PROFILES_YAML_ENABLED', true),
        customProfilesEnabled: this.getFlag('BANK_PROFILES_CUSTOM_ENABLED', false),
        profileMatchingEnabled: this.getFlag('BANK_PROFILES_MATCHING_ENABLED', true),
      },

      fallbacks: {
        strictModeEnabled: this.getFlag('FALLBACK_STRICT_MODE_ENABLED', false),
        permissiveModeEnabled: this.getFlag('FALLBACK_PERMISSIVE_MODE_ENABLED', false),
        debugModeEnabled: this.getFlag('FALLBACK_DEBUG_MODE_ENABLED', false),
      },
    };

    this.logger.log('Feature flags initialized', this.flags);
  }

  /**
   * Get flag value from environment variables with fallback
   */
  private getFlag<T>(key: string, fallback: T): T {
    const value = this.configService?.get<string>(key);
    if (value === undefined) {
      return fallback;
    }

    // Parse boolean values
    if (typeof fallback === 'boolean') {
      return (value.toLowerCase() === 'true') as T;
    }

    // Parse number values
    if (typeof fallback === 'number') {
      const num = Number(value);
      return (Number.isNaN(num) ? fallback : num) as T;
    }

    return value as T;
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Update specific flag
   */
  updateFlag(category: keyof FeatureFlags, flag: string, value: boolean): void {
    const group: unknown = this.flags[category];
    if (isMutableFlagGroup(group)) {
      group[flag] = value;
      this.logger.log(`Updated flag: ${category}.${flag} = ${value}`);
    }
  }

  /**
   * Check if language detection feature is enabled
   */
  isLanguageDetectionEnabled(method: 'franc' | 'ngram' | 'legacy' | 'ml'): boolean {
    switch (method) {
      case 'franc':
        return this.flags.languageDetection.francEnabled;
      case 'ngram':
        return this.flags.languageDetection.ngramFallbackEnabled;
      case 'legacy':
        return this.flags.languageDetection.legacyFallbackEnabled;
      case 'ml':
        return this.flags.languageDetection.mlClassificationEnabled;
      default:
        return false;
    }
  }

  /**
   * Check if number parsing feature is enabled
   */
  isNumberParsingEnabled(feature: 'advanced' | 'currency' | 'multiformat'): boolean {
    switch (feature) {
      case 'advanced':
        return this.flags.numberParsing.advancedNumberParserEnabled;
      case 'currency':
        return this.flags.numberParsing.currencyDetectionEnabled;
      case 'multiformat':
        return this.flags.numberParsing.multiFormatSupportEnabled;
      default:
        return false;
    }
  }

  /**
   * Check if Unicode processing feature is enabled
   */
  isUnicodeProcessingEnabled(feature: 'script' | 'diacritic' | 'tokenization'): boolean {
    switch (feature) {
      case 'script':
        return this.flags.unicodeProcessing.scriptDetectionEnabled;
      case 'diacritic':
        return this.flags.unicodeProcessing.diacriticNormalizationEnabled;
      case 'tokenization':
        return this.flags.unicodeProcessing.advancedTokenizationEnabled;
      default:
        return false;
    }
  }

  /**
   * Check if ML feature is enabled
   */
  isMLEnabled(feature: 'classification' | 'header' | 'language'): boolean {
    switch (feature) {
      case 'classification':
        return this.flags.mlFeatures.rowClassificationEnabled;
      case 'header':
        return this.flags.mlFeatures.headerExtractionEnabled;
      case 'language':
        return this.flags.mlFeatures.languageModelEnabled;
      default:
        return false;
    }
  }

  /**
   * Check if caching feature is enabled
   */
  isCachingEnabled(type: 'language' | 'domain' | 'bank'): boolean {
    switch (type) {
      case 'language':
        return this.flags.caching.languageCacheEnabled;
      case 'domain':
        return this.flags.caching.domainLanguageCacheEnabled;
      case 'bank':
        return this.flags.caching.bankProfileCacheEnabled;
      default:
        return false;
    }
  }

  /**
   * Check if bank profile feature is enabled
   */
  isBankProfileEnabled(feature: 'yaml' | 'custom' | 'matching'): boolean {
    switch (feature) {
      case 'yaml':
        return this.flags.bankProfiles.yamlProfilesEnabled;
      case 'custom':
        return this.flags.bankProfiles.customProfilesEnabled;
      case 'matching':
        return this.flags.bankProfiles.profileMatchingEnabled;
      default:
        return false;
    }
  }

  /**
   * Check if fallback mode is enabled
   */
  isFallbackEnabled(mode: 'strict' | 'permissive' | 'debug'): boolean {
    switch (mode) {
      case 'strict':
        return this.flags.fallbacks.strictModeEnabled;
      case 'permissive':
        return this.flags.fallbacks.permissiveModeEnabled;
      case 'debug':
        return this.flags.fallbacks.debugModeEnabled;
      default:
        return false;
    }
  }

  /**
   * Get effective language detection strategy based on flags
   */
  getLanguageDetectionStrategy(): 'franc-first' | 'ngram-first' | 'legacy-first' | 'ml-only' {
    const mlEnabled = this.isMLEnabled('language');
    const francEnabled = this.isLanguageDetectionEnabled('franc');
    const ngramEnabled = this.isLanguageDetectionEnabled('ngram');
    const legacyEnabled = this.isLanguageDetectionEnabled('legacy');

    if (mlEnabled) {
      return 'ml-only';
    }
    if (francEnabled) {
      return 'franc-first';
    }
    if (ngramEnabled) {
      return 'ngram-first';
    }
    if (legacyEnabled) {
      return 'legacy-first';
    }
    return 'franc-first'; // Default fallback
  }

  /**
   * Check if we should use ML for row classification
   */
  shouldUseMLClassification(): boolean {
    return this.isMLEnabled('classification') && !this.isFallbackEnabled('strict');
  }

  /**
   * Check if we should use advanced number parsing
   */
  shouldUseAdvancedNumberParsing(): boolean {
    return this.isNumberParsingEnabled('advanced') && !this.isFallbackEnabled('permissive');
  }

  /**
   * Check if we should enable Unicode processing
   */
  shouldUseUnicodeProcessing(): boolean {
    return (
      this.isUnicodeProcessingEnabled('script') ||
      this.isUnicodeProcessingEnabled('diacritic') ||
      this.isUnicodeProcessingEnabled('tokenization')
    );
  }

  /**
   * Check if we should use bank profiles
   */
  shouldUseBankProfiles(): boolean {
    return this.isBankProfileEnabled('yaml') && !this.isFallbackEnabled('debug');
  }

  /**
   * Get debug information about enabled features
   */
  getDebugInfo(): {
    strategy: string;
    enabledFeatures: string[];
    disabledFeatures: string[];
    fallbackMode: string;
  } {
    const enabledFeatures: string[] = [];
    const disabledFeatures: string[] = [];

    // Check each feature category
    Object.entries(this.flags).forEach(([category, features]) => {
      Object.entries(features).forEach(([feature, enabled]) => {
        const featureName = `${category}.${feature}`;
        if (enabled) {
          enabledFeatures.push(featureName);
        } else {
          disabledFeatures.push(featureName);
        }
      });
    });

    const strategy = this.getLanguageDetectionStrategy();
    let fallbackMode = 'normal';
    if (this.isFallbackEnabled('strict')) {
      fallbackMode = 'strict';
    } else if (this.isFallbackEnabled('permissive')) {
      fallbackMode = 'permissive';
    } else if (this.isFallbackEnabled('debug')) {
      fallbackMode = 'debug';
    }

    return {
      strategy,
      enabledFeatures,
      disabledFeatures,
      fallbackMode,
    };
  }

  /**
   * Reset all flags to default values
   */
  resetFlags(): void {
    this.initializeFlags();
    this.logger.log('Feature flags reset to defaults');
  }

  /**
   * Export flags to JSON for persistence
   */
  exportFlags(): string {
    return JSON.stringify(this.flags, null, 2);
  }

  /**
   * Import flags from JSON
   */
  importFlags(flagsJson: string): void {
    try {
      const importedFlags = JSON.parse(flagsJson);
      this.flags = { ...this.flags, ...importedFlags };
      this.logger.log('Feature flags imported from JSON');
    } catch (error) {
      this.logger.error('Failed to import feature flags:', error);
    }
  }
}
