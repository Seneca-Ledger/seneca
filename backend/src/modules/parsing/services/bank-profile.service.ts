import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { basename, extname, join, resolve } from 'path';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import {
  createAmountFormat,
  createSharedProfileSections,
  createStatementColumns,
  createStatementParsing,
} from './bank-profile-defaults';

export interface BankProfile {
  id: string;
  name: string;
  displayName: string;
  country: string;
  locale: string;
  currency: string;
  version: string;
  lastUpdated: string;

  // Identification patterns
  identification: {
    documentPatterns: string[];
    filenamePatterns: string[];
    textPatterns: string[];
    urlPatterns?: string[];
    metadataPatterns?: string[];
  };

  // Parsing configuration
  parsing: {
    format: 'csv' | 'excel' | 'pdf' | 'html' | 'auto';
    encoding?: string;
    delimiter?: string;
    hasHeader?: boolean;
    skipRows?: number;
    maxRows?: number;

    // Column configuration
    columns: ColumnDefinition[];

    // Date and amount parsing
    dateFormat?: string;
    amountFormat?: {
      decimalSeparator: string;
      thousandsSeparator: string;
      currencyPosition: 'before' | 'after';
      currencySymbol?: string;
    };

    // Special handling
    multiCurrency?: boolean;
    reverseDebitCredit?: boolean;
    negativeInParentheses?: boolean;
    zeroAmountsAsNull?: boolean;
  };

  // Metadata extraction
  metadata: {
    headerPatterns?: string[];
    accountNumberPatterns?: string[];
    periodPatterns?: string[];
    balancePatterns?: string[];
    currencyPatterns?: string[];
    institutionPatterns?: string[];
  };

  // Validation rules
  validation: {
    requiredFields?: string[];
    optionalFields?: string[];
    fieldValidation?: FieldValidation[];
    businessRules?: BusinessRule[];
  };

  // Quality control
  quality: {
    expectedColumns?: number;
    toleranceLevels?: {
      amount: number; // Percentage
      date: number; // Days
      balance: number; // Percentage
    };
    checksumValidation?: boolean;
    duplicateDetection?: boolean;
  };

  // Feature flags
  features: {
    useMLClassification?: boolean;
    useAdvancedExtraction?: boolean;
    useAutoFix?: boolean;
    useChecksumValidation?: boolean;
    fallbackMode?: string;
  };
}

export interface ColumnDefinition {
  name: string;
  type: 'date' | 'amount' | 'string' | 'number' | 'currency' | 'boolean';
  required: boolean;
  index?: number;
  pattern?: string;
  mapping?: {
    alternatives?: string[];
    transformations?: string[];
  };
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    allowedValues?: string[];
  };
}

export interface FieldValidation {
  field: string;
  type: 'format' | 'range' | 'pattern' | 'enum';
  rule: string;
  message?: string;
  severity?: 'error' | 'warning';
}

export interface BusinessRule {
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: number;
}

type LegacyColumnMapping = {
  keywords?: string[];
  position?: number;
  required?: boolean;
};

type LegacyBankProfile = {
  name?: string;
  country?: string;
  locale?: string;
  patterns?: {
    number?: {
      currencySymbols?: string[];
      decimalSeparator?: string;
      thousandsSeparator?: string;
    };
  };
  columns?: Record<string, LegacyColumnMapping>;
  header?: {
    patterns?: string[];
    accountNumber?: { patterns?: string[] };
    period?: { patterns?: string[] };
    balance?: { patterns?: string[] };
  };
  fileDetection?: {
    filenamePatterns?: string[];
    contentMarkers?: string[];
  };
  processing?: {
    minConfidence?: number;
  };
};

@Injectable()
export class BankProfileService {
  private readonly logger = new Logger(BankProfileService.name);
  private readonly profiles = new Map<string, BankProfile>();
  private readonly profileDirectory = 'config/bank-profiles';

  constructor() {
    this.loadProfiles();
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private resolveCurrency(profile: LegacyBankProfile): string {
    const currencySymbols = profile.patterns?.number?.currencySymbols ?? [];
    const isoCurrency = currencySymbols.find(symbol => /^[A-Z]{3}$/.test(symbol));

    if (isoCurrency) {
      return isoCurrency;
    }

    // Only the country the profile itself declares; anything else is the
    // installation's own currency rather than a guess.
    const byCountry: Record<string, string> = { KZ: 'KZT', US: 'USD' };
    return byCountry[profile.country ?? ''] ?? appDefaultCurrency();
  }

  private normalizeColumnType(name: string): ColumnDefinition['type'] {
    if (name === 'date') {
      return 'date';
    }

    if (name === 'amount' || name === 'debit' || name === 'credit') {
      return 'amount';
    }

    if (name === 'currency') {
      return 'currency';
    }

    return 'string';
  }

  private normalizeLoadedProfile(rawProfile: unknown, fallbackId: string): BankProfile {
    const profile = rawProfile as Partial<BankProfile> & LegacyBankProfile;

    if (profile.id && Array.isArray(profile.parsing?.columns)) {
      return profile as BankProfile;
    }

    const columns = Object.entries(profile.columns ?? {}).map(([name, column]) => ({
      name,
      type: this.normalizeColumnType(name),
      required: column.required ?? false,
      index: column.position,
      mapping: {
        alternatives: column.keywords ?? [],
      },
    }));

    return {
      id: fallbackId,
      name: profile.name ?? fallbackId,
      displayName: profile.name ?? fallbackId,
      country: profile.country ?? 'KZ',
      locale: profile.locale ?? 'ru',
      currency: this.resolveCurrency(profile),
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      identification: {
        documentPatterns: profile.header?.patterns ?? [],
        filenamePatterns: profile.fileDetection?.filenamePatterns ?? [],
        textPatterns: [
          ...(profile.fileDetection?.contentMarkers ?? []),
          ...(profile.header?.patterns ?? []),
        ],
      },
      parsing: {
        format: 'auto',
        columns,
        amountFormat: {
          decimalSeparator: profile.patterns?.number?.decimalSeparator ?? '.',
          thousandsSeparator: profile.patterns?.number?.thousandsSeparator ?? ',',
          currencyPosition: 'before',
        },
      },
      metadata: {
        headerPatterns: profile.header?.patterns,
        accountNumberPatterns: profile.header?.accountNumber?.patterns,
        periodPatterns: profile.header?.period?.patterns,
        balancePatterns: profile.header?.balance?.patterns,
      },
      validation: {
        requiredFields: columns.filter(column => column.required).map(column => column.name),
      },
      quality: {
        expectedColumns: columns.length,
        toleranceLevels: profile.processing?.minConfidence
          ? {
              amount: profile.processing.minConfidence,
              date: 0,
              balance: profile.processing.minConfidence,
            }
          : undefined,
      },
      features: {
        fallbackMode: 'profile',
      },
    };
  }

  private async loadProfiles(): Promise<void> {
    try {
      const profilePath = resolve(process.cwd(), this.profileDirectory);

      if (!existsSync(profilePath)) {
        this.logger.warn(`Bank profile directory not found: ${profilePath}`);
        this.createDefaultProfiles();
        return;
      }

      const files = readdirSync(profilePath);

      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = join(profilePath, file);
          const profile = await this.loadProfileFile(filePath);

          if (profile) {
            this.profiles.set(profile.id, profile);
            this.logger.log(`Loaded bank profile: ${profile.name} (${profile.id})`);
          }
        }
      }

      this.logger.log(`Loaded ${this.profiles.size} bank profiles`);
    } catch (error) {
      this.logger.error('Failed to load bank profiles', error);
      this.createDefaultProfiles();
    }
  }

  private async loadProfileFile(filePath: string): Promise<BankProfile | null> {
    try {
      const content = readFileSync(filePath, 'utf8');
      const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml');
      const fallbackId = basename(filePath, extname(filePath));
      const rawProfile = isYaml ? yaml.load(content) : JSON.parse(content);

      return this.normalizeLoadedProfile(rawProfile, fallbackId);
    } catch (error) {
      this.logger.error(`Failed to load profile from ${filePath}: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  private createDefaultProfiles(): void {
    const defaultProfiles: BankProfile[] = [
      this.createKazkomertsbankProfile(),
      this.createHalykBankProfile(),
      this.createKaspiBankProfile(),
      this.createBerekeBankProfile(),
    ];

    defaultProfiles.forEach(profile => {
      this.profiles.set(profile.id, profile);
      this.logger.log(`Created default profile: ${profile.name} (${profile.id})`);
    });
  }

  private createBaseProfile(
    profile: Omit<BankProfile, 'country' | 'locale' | 'currency' | 'version' | 'lastUpdated'>,
  ): BankProfile {
    return {
      country: 'KZ',
      locale: 'ru',
      currency: 'KZT',
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      ...profile,
    };
  }

  private createKazkomertsbankProfile(): BankProfile {
    return this.createBaseProfile({
      id: 'kazkomertsbank',
      name: 'Kazkommertsbank',
      displayName: 'АО "Казкоммерцбанк"',

      identification: {
        documentPatterns: ['казкоммерцбанк', 'kazkomertsbank', 'kkb', 'АО "Казкоммерцбанк"'],
        filenamePatterns: ['kkb_.*\\.pdf', 'kazkomertsbank_.*\\.xlsx', 'выписка_.*kkb.*'],
        textPatterns: ['АО "Казкоммерцбанк"', 'Казкоммерцбанк', 'KAZKOMERTSBANK'],
      },

      parsing: createStatementParsing({
        format: 'pdf',
        columns: createStatementColumns({
          includeDocumentNumber: true,
          includeCounterpartyBin: true,
          includeCurrency: true,
        }),
        dateFormat: 'DD.MM.YYYY',
        amountFormat: createAmountFormat(',', ' ', '₸'),
        reverseDebitCredit: false,
        negativeInParentheses: false,
      }),

      metadata: {
        headerPatterns: ['ВЫПИСКА ИЗ СЧЕТА', 'ПО СЧЕТУ', 'АО "Казкоммерцбанк"'],
        accountNumberPatterns: ['Счет[:\\s]*([A-Z0-9]{20})', 'Номер счета[:\\s]*([A-Z0-9]{20})'],
        periodPatterns: [
          'Период[:\\s]*(\\d{2}\\.\\d{2}\\.\\d{4})\\s*-\\s*(\\d{2}\\.\\d{2}\\.\\d{4})',
          'За период[:\\s]*(\\d{2}\\.\\d{2}\\.\\d{4})\\s*по\\s*(\\d{2}\\.\\d{2}\\.\\d{4})',
        ],
        balancePatterns: [
          'Остаток на конец[:\\s]*([\\d\\s,.-]+)',
          'Конечный остаток[:\\s]*([\\d\\s,.-]+)',
        ],
      },

      validation: {
        requiredFields: ['transactionDate', 'counterpartyName', 'paymentPurpose'],
        optionalFields: ['documentNumber', 'counterpartyBin', 'currency'],
        businessRules: [
          {
            name: 'debit_xor_credit',
            description: 'Transaction must have either debit or credit, not both',
            condition: 'xor(debit, credit)',
            action: 'set_other_to_zero',
            priority: 1,
          },
        ],
      },

      ...createSharedProfileSections({
        expectedColumns: 8,
        useMLClassification: true,
        fallbackMode: 'regex',
      }),
    });
  }

  private createHalykBankProfile(): BankProfile {
    return this.createBaseProfile({
      id: 'halykbank',
      name: 'Halyk Bank',
      displayName: 'АО "Народный банк Казахстана"',

      identification: {
        documentPatterns: ['народный банк', 'halyk bank', 'халык банк', 'народный'],
        filenamePatterns: ['halyk_.*\\.pdf', 'народный_.*\\.xlsx'],
        textPatterns: ['АО "Народный банк Казахстана"', 'Halyk Bank', 'Халык Банк'],
      },

      parsing: createStatementParsing({
        format: 'excel',
        delimiter: ',',
        hasHeader: true,
        skipRows: 1,
        columns: createStatementColumns({ includeCurrency: true }),
        dateFormat: 'DD.MM.YYYY',
        amountFormat: createAmountFormat('.', ',', '₸'),
      }),

      metadata: {
        headerPatterns: ['Народный банк', 'Halyk Bank', 'Выписка по счету'],
        accountNumberPatterns: ['Счет[:\\s]*([A-Z0-9]{20})', 'Номер счета[:\\s]*([A-Z0-9]{20})'],
        periodPatterns: [
          'Период[:\\s]*(\\d{2}\\.\\d{2}\\.\\d{4})\\s*-\\s*(\\d{2}\\.\\d{2}\\.\\d{4})',
        ],
      },

      validation: {
        requiredFields: ['transactionDate', 'counterpartyName', 'paymentPurpose'],
        businessRules: [
          {
            name: 'amount_required',
            description: 'Transaction must have either debit or credit',
            condition: 'or(debit, credit)',
            action: 'error_if_missing',
            priority: 1,
          },
        ],
      },

      ...createSharedProfileSections({
        expectedColumns: 6,
        useMLClassification: true,
        fallbackMode: 'heuristic',
      }),
    });
  }

  private createKaspiBankProfile(): BankProfile {
    return this.createBaseProfile({
      id: 'kaspibank',
      name: 'Kaspi Bank',
      displayName: 'АО "Kaspi Bank"',

      identification: {
        documentPatterns: ['каспи банк', 'kaspi bank', 'каспи', 'kaspi'],
        filenamePatterns: ['kaspi_.*\\.pdf', 'каспи_.*\\.xlsx', 'выписка_.*kaspi.*'],
        textPatterns: ['АО Kaspi Bank', 'Kaspi Bank', 'Каспи Банк'],
      },

      parsing: createStatementParsing({
        format: 'csv',
        delimiter: ';',
        hasHeader: true,
        columns: createStatementColumns({ includeDocumentNumber: true }),
        dateFormat: 'DD.MM.YYYY HH:mm:ss',
        amountFormat: createAmountFormat('.', ' '),
        reverseDebitCredit: false,
      }),

      metadata: {
        headerPatterns: ['Kaspi Bank', 'АО Kaspi Bank', 'Выписка по счету'],
      },

      ...createSharedProfileSections({
        expectedColumns: 6,
        useMLClassification: false,
        fallbackMode: 'regex',
      }),
    });
  }

  private createBerekeBankProfile(): BankProfile {
    return this.createBaseProfile({
      id: 'berekebank',
      name: 'Bereke Bank',
      displayName: 'АО "Bereke Bank"',

      identification: {
        documentPatterns: ['береке банк', 'bereke bank', 'береке', 'bereke'],
        filenamePatterns: ['bereke_.*\\.pdf', 'береке_.*\\.xlsx'],
        textPatterns: ['АО Bereke Bank', 'Bereke Bank', 'Береке Банк'],
      },

      parsing: createStatementParsing({
        format: 'pdf',
        columns: createStatementColumns({ includeCurrency: true }),
        dateFormat: 'DD.MM.YYYY',
        amountFormat: createAmountFormat(',', ' ', '₸'),
      }),

      metadata: {
        headerPatterns: ['Bereke Bank', 'АО Bereke Bank', 'Выписка по счету'],
      },

      ...createSharedProfileSections({
        expectedColumns: 6,
        useMLClassification: false,
        fallbackMode: 'heuristic',
      }),
    });
  }

  // Public methods

  getProfile(id: string): BankProfile | undefined {
    return this.profiles.get(id);
  }

  getAllProfiles(): BankProfile[] {
    return Array.from(this.profiles.values());
  }

  findProfileByFileName(fileName: string): BankProfile | undefined {
    const normalizedName = fileName.toLowerCase();

    for (const profile of this.profiles.values()) {
      for (const pattern of profile.identification.filenamePatterns) {
        if (new RegExp(pattern, 'i').test(normalizedName)) {
          return profile;
        }
      }
    }

    return undefined;
  }

  findProfileByText(text: string): BankProfile | undefined {
    const normalizedText = text.toLowerCase();

    for (const profile of this.profiles.values()) {
      for (const pattern of profile.identification.textPatterns) {
        if (normalizedText.includes(pattern.toLowerCase())) {
          return profile;
        }
      }
    }

    return undefined;
  }

  findProfileByContent(content: string): BankProfile | undefined {
    // Try filename patterns first (if available)
    // Then text patterns
    return this.findProfileByText(content);
  }

  addProfile(profile: BankProfile): void {
    this.profiles.set(profile.id, profile);
    this.logger.log(`Added bank profile: ${profile.name} (${profile.id})`);
  }

  updateProfile(id: string, updates: Partial<BankProfile>): void {
    const existing = this.profiles.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        lastUpdated: new Date().toISOString(),
      };
      this.profiles.set(id, updated);
      this.logger.log(`Updated bank profile: ${updated.name} (${id})`);
    }
  }

  removeProfile(id: string): boolean {
    const removed = this.profiles.delete(id);
    if (removed) {
      this.logger.log(`Removed bank profile: ${id}`);
    }
    return removed;
  }

  reloadProfiles(): void {
    this.profiles.clear();
    this.loadProfiles();
  }

  // Profile validation
  validateProfile(profile: BankProfile): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!profile.id) {
      errors.push('Profile ID is required');
    }

    if (!profile.name) {
      errors.push('Profile name is required');
    }

    if (profile.country?.length !== 2) {
      errors.push('Valid country code is required');
    }

    if (profile.currency?.length !== 3) {
      errors.push('Valid currency code is required');
    }

    if (!profile.parsing.columns || profile.parsing.columns.length === 0) {
      errors.push('At least one column definition is required');
    }

    const hasDateColumn = profile.parsing.columns.some(col => col.type === 'date');
    if (!hasDateColumn) {
      errors.push('At least one date column is required');
    }

    const hasAmountColumn = profile.parsing.columns.some(col => col.type === 'amount');
    if (!hasAmountColumn) {
      errors.push('At least one amount column is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Profile export/import
  exportProfile(id: string, format: 'json' | 'yaml' = 'json'): string | null {
    const profile = this.getProfile(id);
    if (!profile) {
      return null;
    }

    if (format === 'json') {
      return JSON.stringify(profile, null, 2);
    }

    if (format === 'yaml') {
      return yaml.dump(profile);
    }

    return null;
  }

  importProfile(
    content: string,
    format: 'json' | 'yaml' = 'json',
  ): { success: boolean; profile?: BankProfile; error?: string } {
    try {
      let profile: BankProfile;

      if (format === 'json') {
        profile = this.normalizeLoadedProfile(JSON.parse(content), 'imported-profile');
      }

      if (format === 'yaml') {
        profile = this.normalizeLoadedProfile(yaml.load(content), 'imported-profile');
      }

      const validation = this.validateProfile(profile);
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      this.addProfile(profile);
      return { success: true, profile };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }
}
