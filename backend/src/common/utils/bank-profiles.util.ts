/**
 * Bank profile management service for loading and managing bank-specific language patterns
 * Supports YAML configuration files for bank profiles without code changes
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

export interface BankProfile {
  name: string;
  country: string;
  language: string;
  locale: string;
  domain?: string;
  encoding: string;

  patterns: {
    date: {
      formats: string[];
      separators: string[];
      monthNames: string[];
    };
    number: {
      decimalSeparator: string;
      thousandsSeparator: string;
      currencySymbols: string[];
      negativeFormat: string;
    };
    amount: {
      patterns: string[];
      keywords: string[];
    };
  };

  columns: {
    date: ColumnMapping;
    description: ColumnMapping;
    amount: ColumnMapping;
    currency: ColumnMapping;
    counterparty: ColumnMapping;
    [key: string]: ColumnMapping;
  };

  transactionTypes: {
    debit: TransactionTypeMapping;
    credit: TransactionTypeMapping;
  };

  header: {
    patterns: string[];
    accountNumber: {
      patterns: string[];
    };
    period: {
      patterns: string[];
    };
    balance: {
      patterns: string[];
    };
  };

  fileDetection: {
    extensions: string[];
    filenamePatterns: string[];
    contentMarkers: string[];
  };

  processing: {
    trimWhitespace: boolean;
    normalizeUnicode: boolean;
    removeEmptyRows: boolean;
    minConfidence: number;
    alignment: {
      strictColumns: boolean;
      tolerance: number;
      minColumnWidth: number;
    };
  };
}

export interface ColumnMapping {
  keywords: string[];
  position?: number;
  required: boolean;
}

export interface TransactionTypeMapping {
  keywords: string[];
  patterns: string[];
}

@Injectable()
export class BankProfileService {
  private readonly logger = new Logger(BankProfileService.name);
  private profiles = new Map<string, BankProfile>();
  private readonly PROFILES_DIR = path.join(__dirname, '../../config-assets/bank-profiles');

  constructor() {
    this.loadProfiles();
  }

  /**
   * Load all bank profile YAML files
   */
  private loadProfiles(): void {
    try {
      if (!fs.existsSync(this.PROFILES_DIR)) {
        this.logger.warn(`Bank profiles directory not found: ${this.PROFILES_DIR}`);
        return;
      }

      const files = fs
        .readdirSync(this.PROFILES_DIR)
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

      for (const file of files) {
        const filePath = path.join(this.PROFILES_DIR, file);
        const profileId = path.basename(file, path.extname(file));

        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const profile = yaml.load(content) as BankProfile;

          // Validate profile structure
          if (this.validateProfile(profile)) {
            this.profiles.set(profileId, profile);
            this.logger.log(`Loaded bank profile: ${profile.name} (${profileId})`);
          } else {
            this.logger.warn(`Invalid bank profile structure: ${profileId}`);
          }
        } catch (error) {
          this.logger.error(`Failed to load bank profile ${file}:`, error);
        }
      }

      this.logger.log(`Loaded ${this.profiles.size} bank profiles`);
    } catch (error) {
      this.logger.error('Failed to load bank profiles:', error);
    }
  }

  /**
   * Validate bank profile structure
   */
  private validateProfile(profile: unknown): profile is BankProfile {
    const candidate = profile as Partial<BankProfile> | null;

    return (
      typeof profile === 'object' &&
      profile !== null &&
      typeof candidate?.name === 'string' &&
      typeof candidate?.language === 'string' &&
      typeof candidate?.patterns === 'object' &&
      typeof candidate?.columns === 'object' &&
      Array.isArray(candidate?.patterns?.date?.formats) &&
      Array.isArray(candidate?.columns?.date?.keywords)
    );
  }

  /**
   * Get bank profile by ID
   */
  getProfile(profileId: string): BankProfile | undefined {
    return this.profiles.get(profileId);
  }

  /**
   * Get all available profiles
   */
  getAllProfiles(): Array<{ id: string; profile: BankProfile }> {
    return Array.from(this.profiles.entries()).map(([id, profile]) => ({ id, profile }));
  }

  /**
   * Find bank profile by domain
   */
  findProfileByDomain(domain: string): BankProfile | undefined {
    for (const profile of this.profiles.values()) {
      if (profile.domain && domain.toLowerCase().includes(profile.domain.toLowerCase())) {
        return profile;
      }
    }
    return undefined;
  }

  /**
   * Find bank profile by language
   */
  findProfilesByLanguage(language: string): BankProfile[] {
    return Array.from(this.profiles.values()).filter(profile => profile.language === language);
  }

  /**
   * Find bank profile by content markers
   */
  findProfileByContent(content: string): BankProfile | undefined {
    const normalizedContent = content.toLowerCase();

    for (const profile of this.profiles.values()) {
      const markers = profile.fileDetection?.contentMarkers || [];

      for (const marker of markers) {
        if (normalizedContent.includes(marker.toLowerCase())) {
          return profile;
        }
      }
    }

    return undefined;
  }

  /**
   * Find bank profile by filename
   */
  findProfileByFilename(filename: string): BankProfile | undefined {
    const normalizedFilename = filename.toLowerCase();

    for (const profile of this.profiles.values()) {
      const patterns = profile.fileDetection?.filenamePatterns || [];

      for (const pattern of patterns) {
        if (normalizedFilename.includes(pattern.toLowerCase())) {
          return profile;
        }
      }
    }

    return undefined;
  }

  /**
   * Get column mapping for a specific field type from profile
   */
  getColumnMapping(
    profileId: string,
    fieldType: keyof BankProfile['columns'],
  ): ColumnMapping | undefined {
    const profile = this.getProfile(profileId);
    return profile?.columns[fieldType];
  }

  /**
   * Get date patterns from profile
   */
  getDatePatterns(profileId: string): string[] {
    const profile = this.getProfile(profileId);
    return profile?.patterns?.date?.formats || [];
  }

  /**
   * Get number format from profile
   */
  getNumberFormat(profileId: string): BankProfile['patterns']['number'] | undefined {
    const profile = this.getProfile(profileId);
    return profile?.patterns?.number;
  }

  /**
   * Get transaction type patterns from profile
   */
  getTransactionTypePatterns(
    profileId: string,
    type: 'debit' | 'credit',
  ): TransactionTypeMapping | undefined {
    const profile = this.getProfile(profileId);
    return profile?.transactionTypes?.[type];
  }

  /**
   * Match column header to field type using profile
   */
  matchColumnHeader(profileId: string, header: string): string | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const normalizedHeader = header.toLowerCase().trim();

    for (const [fieldType, mapping] of Object.entries(profile.columns)) {
      for (const keyword of mapping.keywords) {
        if (
          normalizedHeader.includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(normalizedHeader)
        ) {
          return fieldType;
        }
      }
    }

    return null;
  }

  /**
   * Detect transaction type from amount and description
   */
  detectTransactionType(
    profileId: string,
    amount: string | number,
    description?: string,
  ): 'debit' | 'credit' | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const amountStr = String(amount).trim();

    // Check debit patterns
    if (profile.transactionTypes?.debit) {
      const debitPatterns = profile.transactionTypes.debit.patterns || [];
      const debitKeywords = profile.transactionTypes.debit.keywords || [];

      for (const pattern of debitPatterns) {
        if (new RegExp(pattern).test(amountStr)) {
          return 'debit';
        }
      }

      if (description) {
        const normalizedDesc = description.toLowerCase();
        for (const keyword of debitKeywords) {
          if (normalizedDesc.includes(keyword.toLowerCase())) {
            return 'debit';
          }
        }
      }
    }

    // Check credit patterns
    if (profile.transactionTypes?.credit) {
      const creditPatterns = profile.transactionTypes.credit.patterns || [];
      const creditKeywords = profile.transactionTypes.credit.keywords || [];

      for (const pattern of creditPatterns) {
        if (new RegExp(pattern).test(amountStr)) {
          return 'credit';
        }
      }

      if (description) {
        const normalizedDesc = description.toLowerCase();
        for (const keyword of creditKeywords) {
          if (normalizedDesc.includes(keyword.toLowerCase())) {
            return 'credit';
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract account number from text using profile patterns
   */
  extractAccountNumber(profileId: string, text: string): string | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const patterns = profile.header?.accountNumber?.patterns || [];

    for (const pattern of patterns) {
      const match = text.match(new RegExp(pattern, 'i'));
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  /**
   * Extract date period from text using profile patterns
   */
  extractPeriod(profileId: string, text: string): { from?: Date; to?: Date } | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const patterns = profile.header?.period?.patterns || [];

    for (const pattern of patterns) {
      const match = text.match(new RegExp(pattern, 'i'));
      if (match) {
        // Parse dates based on profile's date formats
        const fromDate = this.parseDateByProfile(match[1], profileId);
        const toDate = this.parseDateByProfile(match[2], profileId);

        return {
          from: fromDate || undefined,
          to: toDate || undefined,
        };
      }
    }

    return null;
  }

  /**
   * Extract balance from text using profile patterns
   */
  extractBalance(profileId: string, text: string): number | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const patterns = profile.header?.balance?.patterns || [];

    for (const pattern of patterns) {
      const match = text.match(new RegExp(pattern, 'i'));
      if (match) {
        // Use profile's number format to parse
        const amountStr = match[1];
        // This would use the number normalizer with the profile's format
        return Number.parseFloat(amountStr.replace(/[^\d.-]/g, ''));
      }
    }

    return null;
  }

  /**
   * Parse date using profile's date formats
   */
  private parseDateByProfile(dateStr: string, profileId: string): Date | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const formats = profile.patterns?.date?.formats || [];

    for (const format of formats) {
      try {
        // Simple date parsing - would be enhanced with date library
        if (format === 'dd.MM.yyyy') {
          const parts = dateStr.split('.');
          if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        } else if (format === 'MM/dd/yyyy') {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
          }
        }
      } catch {
        // Continue to next format
      }
    }

    return null;
  }

  /**
   * Reload profiles (useful for development)
   */
  reloadProfiles(): void {
    this.profiles.clear();
    this.loadProfiles();
  }

  /**
   * Create custom profile dynamically
   */
  createCustomProfile(profileData: Partial<BankProfile>, _profileId: string): BankProfile {
    const defaultProfile: BankProfile = {
      name: 'Custom Bank',
      country: 'Unknown',
      language: 'en',
      locale: 'en-US',
      encoding: 'UTF-8',
      patterns: {
        date: {
          formats: ['dd.MM.yyyy', 'MM/dd/yyyy'],
          separators: ['.', '/'],
          monthNames: [],
        },
        number: {
          decimalSeparator: '.',
          thousandsSeparator: ',',
          currencySymbols: ['$'],
          negativeFormat: 'prefix',
        },
        amount: {
          patterns: ['\\d+\\.\\d{2}'],
          keywords: ['amount'],
        },
      },
      columns: {
        date: { keywords: ['date'], required: true },
        description: { keywords: ['description'], required: true },
        amount: { keywords: ['amount'], required: true },
        currency: { keywords: ['currency'], required: false },
        counterparty: { keywords: ['payee'], required: false },
      },
      transactionTypes: {
        debit: { keywords: ['debit'], patterns: ['-.*'] },
        credit: { keywords: ['credit'], patterns: ['\\+.*'] },
      },
      header: {
        patterns: [],
        accountNumber: { patterns: [] },
        period: { patterns: [] },
        balance: { patterns: [] },
      },
      fileDetection: {
        extensions: ['.pdf', '.csv', '.xlsx'],
        filenamePatterns: [],
        contentMarkers: [],
      },
      processing: {
        trimWhitespace: true,
        normalizeUnicode: true,
        removeEmptyRows: true,
        minConfidence: 0.7,
        alignment: {
          strictColumns: false,
          tolerance: 3,
          minColumnWidth: 10,
        },
      },
    };

    return { ...defaultProfile, ...profileData } as BankProfile;
  }
}
