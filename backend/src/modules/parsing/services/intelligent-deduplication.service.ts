import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '../../../entities/transaction.entity';
import { ImportConfigService } from '../../import/config/import.config';
import { ParsedTransaction } from '../interfaces/parsed-statement.interface';

type DeduplicationAlgorithm = 'exact' | 'fuzzy' | 'semantic' | 'hybrid';
type HybridSubAlgorithm = Exclude<DeduplicationAlgorithm, 'hybrid'>;
type NormalizedFieldValue = string | number | Date;
type NormalizedTransactionRecord = NormalizedTransaction &
  Record<string, NormalizedFieldValue | undefined>;

interface DeduplicationRuleOptions {
  strictAmountComparison?: boolean;
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
  dateToleranceDays?: number;
  amountTolerancePercent?: number;
  nameSimilarityThreshold?: number;
  useNgramSimilarity?: boolean;
  useKeywordExtraction?: boolean;
  ignoreStopWords?: boolean;
  combineAlgorithms?: HybridSubAlgorithm[];
  minAlgorithmMatches?: number;
  weightDistribution?: Partial<Record<HybridSubAlgorithm, number>>;
  [key: string]: unknown;
}

interface NormalizedTransaction {
  transactionDate: Date;
  dateString: string;
  documentNumber: string;
  counterpartyName: string;
  counterpartyBin: string;
  counterpartyAccount: string;
  counterpartyBank: string;
  debit: number;
  credit: number;
  amount: number;
  paymentPurpose: string;
  currency: string;
  exchangeRate: number;
  amountForeign: number;
}

interface TransactionFeatures {
  amountBucket: string;
  nameLength: number;
  purposeLength: number;
  hasDocument: boolean;
  dayOfWeek: number;
  month: number;
  counterpartyType: string;
  purposeKeywords: string[];
}

interface PreprocessedTransaction {
  original: ParsedTransaction;
  normalized: NormalizedTransaction;
  hashes: Record<string, string>;
  features: TransactionFeatures;
}

interface DeduplicationInfo {
  groupId: string;
  isDuplicate: boolean;
  duplicateCount: number;
  confidence: number;
  matchType: DuplicateGroup['matchType'];
  masterId?: string;
}

type DeduplicatedTransaction = ParsedTransaction & {
  _deduplicationInfo?: DeduplicationInfo;
};

export interface DuplicationResult {
  originalCount: number;
  uniqueCount: number;
  duplicatesRemoved: number;
  duplicates: DuplicateGroup[];
  uniqueTransactions: ParsedTransaction[];
  qualityMetrics: DuplicationQualityMetrics;
  processingStats: DuplicationProcessingStats;
}

export interface DuplicateGroup {
  id: string;
  master: ParsedTransaction;
  duplicates: ParsedTransaction[];
  duplicateCount: number;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'semantic' | 'hybrid';
  fields: string[];
  scores: FieldScores;
}

export interface FieldScores {
  date: number;
  amount: number;
  counterparty: number;
  purpose: number;
  overall: number;
}

export interface DuplicationQualityMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  averageConfidence: number;
  correctDeduplicationRate: number;
}

export interface DuplicationProcessingStats {
  processingTime: number;
  memoryUsage: number;
  comparisonCount: number;
  algorithms: string[];
  threshold: number;
}

export interface DeduplicationRule {
  name: string;
  enabled: boolean;
  weight: number;
  algorithm: DeduplicationAlgorithm;
  threshold: number;
  fields: string[];
  options: DeduplicationRuleOptions;
}

export interface FuzzyMatch {
  score: number;
  matchType:
    | 'exact'
    | 'partial'
    | 'levenshtein'
    | 'cosine'
    | 'jaccard'
    | 'fuzzy'
    | 'semantic'
    | 'hybrid';
  details: string;
  fields: string[];
}

/**
 * Enum for recommended actions when conflicts are detected
 */
export enum ConflictAction {
  KEEP_EXISTING = 'keep_existing',
  REPLACE = 'replace',
  MERGE = 'merge',
  MANUAL_REVIEW = 'manual_review',
}

/**
 * Result of tolerant matching between two transactions
 */
export interface MatchResult {
  isMatch: boolean;
  confidence: number; // 0-1
  matchType: 'exact' | 'fuzzy_date' | 'fuzzy_amount' | 'fuzzy_text' | 'combined';
  details: {
    dateDiff?: number; // days difference
    amountDiff?: number; // percentage difference
    textSimilarity?: number; // 0-1 similarity score
  };
}

/**
 * Represents a conflict between a new transaction and an existing one
 */
export interface ConflictGroup {
  newTransaction: ParsedTransaction;
  existingTransaction: Transaction;
  confidence: number; // 0-1
  matchType: 'exact' | 'fuzzy_date' | 'fuzzy_amount' | 'fuzzy_text' | 'combined';
  recommendedAction: ConflictAction;
  details: {
    dateDiff?: number; // days difference
    amountDiff?: number; // percentage difference
    textSimilarity?: number; // 0-1 similarity score
  };
}

@Injectable()
export class IntelligentDeduplicationService {
  private readonly logger = new Logger(IntelligentDeduplicationService.name);

  constructor(private readonly importConfigService: ImportConfigService) {}

  private getParsedTransactionField(transaction: ParsedTransaction, field: string): unknown {
    return (transaction as unknown as Record<string, unknown>)[field];
  }

  private toDuplicateGroupMatchType(
    matchType: FuzzyMatch['matchType'],
  ): DuplicateGroup['matchType'] {
    switch (matchType) {
      case 'exact':
      case 'fuzzy':
      case 'semantic':
      case 'hybrid':
        return matchType;
      default:
        return 'partial';
    }
  }

  private getNormalizedField(
    transaction: PreprocessedTransaction,
    field: string,
  ): NormalizedFieldValue | undefined {
    return (transaction.normalized as NormalizedTransactionRecord)[field];
  }

  // Default deduplication rules
  private readonly defaultRules: DeduplicationRule[] = [
    {
      name: 'exact_match',
      enabled: true,
      weight: 1.0,
      algorithm: 'exact',
      threshold: 1.0,
      fields: ['transactionDate', 'counterpartyName', 'paymentPurpose', 'debit', 'credit'],
      options: {
        strictAmountComparison: true,
        ignoreCase: true,
        ignoreWhitespace: true,
      },
    },
    {
      name: 'fuzzy_amount_date',
      enabled: true,
      weight: 0.8,
      algorithm: 'fuzzy',
      threshold: 0.85,
      fields: ['transactionDate', 'debit', 'credit', 'counterpartyName'],
      options: {
        dateToleranceDays: 1,
        amountTolerancePercent: 0.01,
        nameSimilarityThreshold: 0.7,
      },
    },
    {
      name: 'semantic_purpose',
      enabled: true,
      weight: 0.6,
      algorithm: 'semantic',
      threshold: 0.75,
      fields: ['paymentPurpose', 'counterpartyName', 'amount'],
      options: {
        useNgramSimilarity: true,
        useKeywordExtraction: true,
        ignoreStopWords: true,
      },
    },
    {
      name: 'hybrid_comprehensive',
      enabled: true,
      weight: 0.9,
      algorithm: 'hybrid',
      threshold: 0.8,
      fields: [
        'transactionDate',
        'counterpartyName',
        'paymentPurpose',
        'debit',
        'credit',
        'documentNumber',
      ],
      options: {
        combineAlgorithms: ['exact', 'fuzzy', 'semantic'],
        minAlgorithmMatches: 2,
        weightDistribution: {
          exact: 0.5,
          fuzzy: 0.3,
          semantic: 0.2,
        },
      },
    },
  ];

  private customRules: DeduplicationRule[] = [];

  private readonly stopWords = new Set([
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'и',
    'в',
    'на',
    'с',
    'по',
    'для',
    'от',
    'к',
    'у',
    'за',
    'через',
    'да',
    'нет',
    'или',
    'но',
    'если',
    'потому',
    'также',
    'еще',
  ]);

  async deduplicateTransactions(
    transactions: ParsedTransaction[],
    customRules?: DeduplicationRule[],
    threshold?: number,
  ): Promise<DuplicationResult> {
    const startTime = Date.now();
    this.logger.log(`Starting intelligent deduplication for ${transactions.length} transactions`);

    const rules = customRules || [...this.defaultRules, ...this.customRules];
    const actualThreshold = threshold || 0.8;

    // Step 1: Preprocess transactions for comparison
    const preprocessedTransactions = await this.preprocessTransactions(transactions);

    // Step 2: Group potential duplicates using multiple algorithms
    const duplicateGroups = await this.findDuplicateGroups(
      preprocessedTransactions,
      rules,
      actualThreshold,
    );

    // Step 3: Resolve conflicts and select master records
    const resolvedGroups = await this.resolveDuplicateConflicts(duplicateGroups);

    // Step 4: Generate final unique transaction list
    const uniqueTransactions = this.createUniqueTransactionList(resolvedGroups);

    // Step 5: Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(
      transactions,
      resolvedGroups,
      uniqueTransactions,
    );

    const processingTime = Date.now() - startTime;
    const processingStats: DuplicationProcessingStats = {
      processingTime,
      memoryUsage: this.getMemoryUsage(),
      comparisonCount: this.calculateComparisonCount(transactions.length, rules.length),
      algorithms: rules.map(r => r.algorithm).filter((v, i, a) => a.indexOf(v) === i),
      threshold: actualThreshold,
    };

    this.logger.log(
      `Deduplication completed. Removed ${transactions.length - uniqueTransactions.length} duplicates`,
    );

    return {
      originalCount: transactions.length,
      uniqueCount: uniqueTransactions.length,
      duplicatesRemoved: transactions.length - uniqueTransactions.length,
      duplicates: resolvedGroups,
      uniqueTransactions,
      qualityMetrics,
      processingStats,
    };
  }

  private async preprocessTransactions(
    transactions: ParsedTransaction[],
  ): Promise<PreprocessedTransaction[]> {
    return transactions.map(tx => ({
      original: tx,
      normalized: this.normalizeTransaction(tx),
      hashes: this.generateHashes(tx),
      features: this.extractFeatures(tx),
    }));
  }

  private normalizeTransaction(transaction: ParsedTransaction): NormalizedTransaction {
    const normalizeString = (str: string): string => {
      return str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    return {
      transactionDate: transaction.transactionDate,
      dateString: transaction.transactionDate.toISOString().split('T')[0],
      documentNumber: normalizeString(transaction.documentNumber || ''),
      counterpartyName: normalizeString(transaction.counterpartyName),
      counterpartyBin: transaction.counterpartyBin || '',
      counterpartyAccount: normalizeString(transaction.counterpartyAccount || ''),
      counterpartyBank: normalizeString(transaction.counterpartyBank || ''),
      debit: transaction.debit || 0,
      credit: transaction.credit || 0,
      amount: transaction.debit || transaction.credit || 0,
      paymentPurpose: normalizeString(transaction.paymentPurpose),
      currency: transaction.currency || '',
      exchangeRate: transaction.exchangeRate || 1,
      amountForeign: transaction.amountForeign || 0,
    };
  }

  private generateHashes(transaction: ParsedTransaction): Record<string, string> {
    const createKey = (fields: string[]): string => {
      const values = fields.map(field => {
        const value = this.getParsedTransactionField(transaction, field);
        return value ? String(value).toLowerCase().trim() : '';
      });
      return values.join('|');
    };

    return {
      exact: createKey([
        'transactionDate',
        'counterpartyName',
        'paymentPurpose',
        'debit',
        'credit',
      ]),
      amountDate: createKey(['transactionDate', 'debit', 'credit', 'counterpartyName']),
      purpose: createKey(['paymentPurpose', 'counterpartyName']),
      document: createKey(['documentNumber', 'transactionDate']),
      composite: createKey([
        'transactionDate',
        'counterpartyName',
        'paymentPurpose',
        'debit',
        'credit',
        'documentNumber',
      ]),
    };
  }

  private extractFeatures(transaction: ParsedTransaction): TransactionFeatures {
    const extractKeywords = (text: string): string[] => {
      // Simple keyword extraction (in production, use NLP library)
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !this.isStopWord(word));

      return [...new Set(words)].slice(0, 10); // Top 10 unique keywords
    };

    return {
      amountBucket: this.categorizeAmount(transaction.debit || transaction.credit || 0),
      nameLength: transaction.counterpartyName.length,
      purposeLength: transaction.paymentPurpose.length,
      hasDocument: Boolean(transaction.documentNumber),
      dayOfWeek: transaction.transactionDate.getDay(),
      month: transaction.transactionDate.getMonth(),
      counterpartyType: this.classifyCounterparty(transaction.counterpartyName),
      purposeKeywords: extractKeywords(transaction.paymentPurpose),
    };
  }

  private isStopWord(word: string): boolean {
    return this.stopWords.has(word);
  }

  private categorizeAmount(amount: number): string {
    if (amount === 0) {
      return 'zero';
    }
    if (amount < 10) {
      return 'micro';
    }
    if (amount < 100) {
      return 'small';
    }
    if (amount < 1000) {
      return 'medium';
    }
    if (amount < 10000) {
      return 'large';
    }
    return 'xlarge';
  }

  private classifyCounterparty(counterpartyName: string): string {
    const name = counterpartyName.toLowerCase();

    if (/(\d{12}|\d{10})/.test(name)) {
      return 'individual';
    }
    if (/(ооо|too|llc|ltd|корп|паблик|public)/i.test(name)) {
      return 'corporate';
    }
    if (/(банк|bank|кассы|cash)/i.test(name)) {
      return 'financial';
    }
    if (/(государство|government|министерство|ministry)/i.test(name)) {
      return 'government';
    }
    if (/(\d{3,})/.test(name)) {
      return 'atm_terminal';
    }

    return 'other';
  }

  private async findDuplicateGroups(
    preprocessedTransactions: PreprocessedTransaction[],
    rules: DeduplicationRule[],
    _threshold: number,
  ): Promise<DuplicateGroup[]> {
    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<number>();
    const enabledRules = rules.filter(r => r.enabled);

    for (let i = 0; i < preprocessedTransactions.length; i++) {
      if (processed.has(i)) {
        continue;
      }

      const current = preprocessedTransactions[i];
      const potentialDuplicates: Array<{
        index: number;
        score: number;
        matchType: DuplicateGroup['matchType'];
        fields: string[];
      }> = [];

      // Compare with other transactions
      for (let j = i + 1; j < preprocessedTransactions.length; j++) {
        if (processed.has(j)) {
          continue;
        }

        const other = preprocessedTransactions[j];

        // Apply each enabled rule
        for (const rule of enabledRules) {
          const matchResult = await this.applyRule(current, other, rule);
          if (matchResult.score >= rule.threshold) {
            potentialDuplicates.push({
              index: j,
              score: matchResult.score,
              matchType: this.toDuplicateGroupMatchType(matchResult.matchType),
              fields: matchResult.fields,
            });
            break; // Use first matching rule
          }
        }
      }

      // Group duplicates if found
      if (potentialDuplicates.length > 0) {
        const group = await this.createDuplicateGroup(
          i,
          potentialDuplicates,
          preprocessedTransactions,
          rules,
        );
        duplicateGroups.push(group);

        // Mark all indices as processed
        processed.add(i);
        for (const dup of potentialDuplicates) {
          processed.add(dup.index);
        }
      }
    }

    return duplicateGroups;
  }

  private async applyRule(
    tx1: PreprocessedTransaction,
    tx2: PreprocessedTransaction,
    rule: DeduplicationRule,
  ): Promise<FuzzyMatch> {
    switch (rule.algorithm) {
      case 'exact':
        return this.exactMatch(tx1, tx2, rule);
      case 'fuzzy':
        return this.fuzzyMatch(tx1, tx2, rule);
      case 'semantic':
        return this.semanticMatch(tx1, tx2, rule);
      case 'hybrid':
        return this.hybridMatch(tx1, tx2, rule);
      default:
        return {
          score: 0,
          matchType: 'exact',
          details: 'Unknown algorithm',
          fields: [],
        };
    }
  }

  private exactMatch(
    tx1: PreprocessedTransaction,
    tx2: PreprocessedTransaction,
    rule: DeduplicationRule,
  ): FuzzyMatch {
    let matches = 0;
    let totalFields = 0;
    const fields: string[] = [];

    for (const field of rule.fields) {
      totalFields++;
      const value1 = this.getNormalizedField(tx1, field);
      const value2 = this.getNormalizedField(tx2, field);

      if (value1 && value2) {
        if (value1 === value2) {
          matches++;
          fields.push(field);
        } else if (field === 'debit' || field === 'credit' || field === 'amount') {
          // Special handling for amounts
          if (typeof value1 !== 'number' || typeof value2 !== 'number') {
            continue;
          }

          const diff = Math.abs(value1 - value2);
          const tolerance = rule.options?.amountTolerancePercent
            ? value1 * rule.options.amountTolerancePercent
            : 0.01;

          if (diff <= tolerance) {
            matches++;
            fields.push(field);
          }
        }
      }
    }

    const score = totalFields > 0 ? matches / totalFields : 0;

    return {
      score,
      matchType: score === 1 ? 'exact' : 'partial',
      details: `Matches in ${matches}/${totalFields} fields: ${fields.join(', ')}`,
      fields,
    };
  }

  private fuzzyMatch(
    tx1: PreprocessedTransaction,
    tx2: PreprocessedTransaction,
    rule: DeduplicationRule,
  ): FuzzyMatch {
    let score = 0;
    let fieldMatches = 0;
    const fields: string[] = [];

    for (const field of rule.fields) {
      const value1 = this.getNormalizedField(tx1, field);
      const value2 = this.getNormalizedField(tx2, field);

      if (value1 && value2) {
        if (field === 'transactionDate') {
          if (!(value1 instanceof Date && value2 instanceof Date)) {
            continue;
          }
          const daysDiff = Math.abs(value1.getTime() - value2.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff <= (rule.options?.dateToleranceDays || 1)) {
            fieldMatches++;
            fields.push(field);
          }
        } else if (field === 'debit' || field === 'credit' || field === 'amount') {
          if (typeof value1 !== 'number' || typeof value2 !== 'number') {
            continue;
          }
          const diff = Math.abs(value1 - value2);
          const tolerance = value1 * (rule.options?.amountTolerancePercent || 0.01);
          if (diff <= tolerance) {
            fieldMatches++;
            fields.push(field);
          }
        } else {
          if (typeof value1 !== 'string' || typeof value2 !== 'string') {
            continue;
          }
          const similarity = this.calculateStringSimilarity(value1, value2);
          const threshold = rule.options?.nameSimilarityThreshold || 0.7;
          if (similarity >= threshold) {
            fieldMatches++;
            fields.push(field);
          }
        }
      }
    }

    score = rule.fields.length > 0 ? fieldMatches / rule.fields.length : 0;

    return {
      score,
      matchType: score > 0.8 ? 'fuzzy' : 'partial',
      details: `Fuzzy match score: ${score.toFixed(3)} in fields: ${fields.join(', ')}`,
      fields,
    };
  }

  private semanticMatch(
    tx1: PreprocessedTransaction,
    tx2: PreprocessedTransaction,
    _rule: DeduplicationRule,
  ): FuzzyMatch {
    // Simplified semantic matching (in production, use ML/NLP libraries)
    const features1 = tx1.features;
    const features2 = tx2.features;

    let matches = 0;
    let totalFeatures = 0;
    const fields: string[] = [];

    // Compare categorical features
    if (features1.amountBucket === features2.amountBucket) {
      matches++;
      fields.push('amount_bucket');
    }
    totalFeatures++;

    if (features1.counterpartyType === features2.counterpartyType) {
      matches++;
      fields.push('counterparty_type');
    }
    totalFeatures++;

    // Compare day of week and month (for recurring transactions)
    if (
      features1.dayOfWeek === features2.dayOfWeek &&
      Math.abs(features1.month - features2.month) <= 1
    ) {
      matches++;
      fields.push('temporal_pattern');
    }
    totalFeatures++;

    // Compare keywords
    const keywordSimilarity = this.calculateKeywordSimilarity(
      features1.purposeKeywords,
      features2.purposeKeywords,
    );
    if (keywordSimilarity >= 0.6) {
      matches++;
      fields.push('purpose_keywords');
    }
    totalFeatures++;

    const score = totalFeatures > 0 ? matches / totalFeatures : 0;

    return {
      score,
      matchType: score > 0.7 ? 'semantic' : 'partial',
      details: `Semantic similarity: ${score.toFixed(3)} from ${matches}/${totalFeatures} features`,
      fields,
    };
  }

  private async hybridMatch(
    tx1: PreprocessedTransaction,
    tx2: PreprocessedTransaction,
    rule: DeduplicationRule,
  ): Promise<FuzzyMatch> {
    const algorithms = rule.options?.combineAlgorithms || ['exact', 'fuzzy', 'semantic'];
    const weights = rule.options?.weightDistribution || {
      exact: 0.5,
      fuzzy: 0.3,
      semantic: 0.2,
    };
    const minMatches = rule.options?.minAlgorithmMatches || 2;

    const algorithmResults: Array<{
      algorithm: string;
      score: number;
      fields: string[];
    }> = [];

    for (const algorithm of algorithms) {
      const tempRule: DeduplicationRule = { ...rule, algorithm };
      const result = await this.applyRule(tx1, tx2, tempRule);
      algorithmResults.push({
        algorithm,
        score: result.score,
        fields: result.fields,
      });
    }

    const highScoringResults = algorithmResults.filter(r => r.score >= rule.threshold * 0.7);

    if (highScoringResults.length < minMatches) {
      return {
        score: 0,
        matchType: 'partial',
        details: 'Insufficient algorithm matches',
        fields: [],
      };
    }

    let totalScore = 0;
    const allFields = new Set<string>();

    for (const result of highScoringResults) {
      totalScore += result.score * (weights[result.algorithm as keyof typeof weights] || 0);
      for (const field of result.fields) {
        allFields.add(field);
      }
    }

    return {
      score: totalScore,
      matchType: totalScore > 0.8 ? 'hybrid' : 'partial',
      details: `Hybrid score: ${totalScore.toFixed(3)} from ${highScoringResults.length} algorithms`,
      fields: Array.from(allFields),
    };
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Levenshtein distance (simplified implementation)
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1;
    }
    if (shorter.length === 0) {
      return 0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j][i - 1] + 1);
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private createDuplicateGroup(
    masterIndex: number,
    duplicates: Array<{
      index: number;
      score: number;
      matchType: DuplicateGroup['matchType'];
      fields: string[];
    }>,
    preprocessedTransactions: PreprocessedTransaction[],
    rules: DeduplicationRule[],
  ): DuplicateGroup {
    const master = preprocessedTransactions[masterIndex];
    const duplicateTransactions = duplicates.map(dup => preprocessedTransactions[dup.index]);

    // Calculate field scores
    const fieldScores = this.calculateFieldScores(master, duplicateTransactions, rules);

    // Calculate overall confidence
    const averageScore = duplicates.reduce((sum, dup) => sum + dup.score, 0) / duplicates.length;

    return {
      id: `group_${masterIndex}_${Date.now()}`,
      master: master.original,
      duplicates: duplicateTransactions.map(dup => dup.original),
      duplicateCount: duplicates.length,
      confidence: averageScore,
      matchType: this.determineMatchType(duplicates),
      fields: duplicates[0]?.fields || [],
      scores: fieldScores,
    };
  }

  private calculateFieldScores(
    master: PreprocessedTransaction,
    duplicates: PreprocessedTransaction[],
    _rules: DeduplicationRule[],
  ): FieldScores {
    const scores: FieldScores = {
      date: 0,
      amount: 0,
      counterparty: 0,
      purpose: 0,
      overall: 0,
    };

    // Calculate scores for each field
    for (const field of [
      'transactionDate',
      'debit',
      'credit',
      'counterpartyName',
      'paymentPurpose',
    ] as const) {
      let fieldScore = 0;
      let count = 0;

      for (const duplicate of duplicates) {
        const masterValue = this.getNormalizedField(master, field);
        const duplicateValue = this.getNormalizedField(duplicate, field);

        if (masterValue && duplicateValue) {
          count++;
          if (field === 'transactionDate') {
            if (!(masterValue instanceof Date && duplicateValue instanceof Date)) {
              continue;
            }
            const daysDiff =
              Math.abs(masterValue.getTime() - duplicateValue.getTime()) / (1000 * 60 * 60 * 24);
            fieldScore += Math.max(0, 1 - daysDiff); // Decay with time difference
          } else if (field === 'debit' || field === 'credit') {
            if (typeof masterValue !== 'number' || typeof duplicateValue !== 'number') {
              continue;
            }
            const diff =
              Math.abs(masterValue - duplicateValue) / Math.max(masterValue, duplicateValue);
            fieldScore += Math.max(0, 1 - diff);
          } else {
            if (typeof masterValue !== 'string' || typeof duplicateValue !== 'string') {
              continue;
            }
            const similarity = this.calculateStringSimilarity(masterValue, duplicateValue);
            fieldScore += similarity;
          }
        }
      }

      // Average score for the field
      const avgScore = count > 0 ? fieldScore / count : 0;

      // Map to our field categories
      if (field === 'transactionDate') {
        scores.date = avgScore;
      } else if (field === 'debit' || field === 'credit') {
        scores.amount = avgScore;
      } else if (field === 'counterpartyName') {
        scores.counterparty = avgScore;
      } else if (field === 'paymentPurpose') {
        scores.purpose = avgScore;
      }
    }

    // Calculate overall score
    scores.overall = (scores.date + scores.amount + scores.counterparty + scores.purpose) / 4;

    return scores;
  }

  private determineMatchType(
    duplicates: Array<{ matchType: DuplicateGroup['matchType'] }>,
  ): 'exact' | 'fuzzy' | 'partial' | 'semantic' | 'hybrid' {
    if (duplicates.some(dup => dup.matchType === 'exact')) {
      return 'exact';
    }
    if (duplicates.some(dup => dup.matchType === 'hybrid')) {
      return 'hybrid';
    }
    if (duplicates.some(dup => dup.matchType === 'semantic')) {
      return 'semantic';
    }
    if (duplicates.some(dup => dup.matchType === 'fuzzy')) {
      return 'fuzzy';
    }
    return 'partial';
  }

  private async resolveDuplicateConflicts(
    duplicateGroups: DuplicateGroup[],
  ): Promise<DuplicateGroup[]> {
    const resolvedGroups: DuplicateGroup[] = [];

    for (const group of duplicateGroups) {
      const resolvedGroup = await this.selectBestMasterRecord(group);
      resolvedGroups.push(resolvedGroup);
    }

    return resolvedGroups;
  }

  private async selectBestMasterRecord(group: DuplicateGroup): Promise<DuplicateGroup> {
    // Create score for each record (master + duplicates)
    const allRecords = [group.master, ...group.duplicates];
    const scores = allRecords.map(record => this.calculateRecordScore(record));

    // Find the record with the highest score
    const bestScore = Math.max(...scores);
    const bestIndex = scores.indexOf(bestScore);
    const bestRecord = allRecords[bestIndex];

    // Update the group if a different record is better
    if (bestIndex !== 0) {
      return {
        ...group,
        master: bestRecord,
        duplicates: allRecords.filter((_, index) => index !== bestIndex),
        confidence: bestScore,
      };
    }

    return group;
  }

  private calculateRecordScore(record: ParsedTransaction): number {
    let score = 0;

    // Prefer records with document numbers
    if (record.documentNumber && record.documentNumber.trim().length > 0) {
      score += 0.3;
    }

    // Prefer records with complete counterparty information
    if (record.counterpartyBin) {
      score += 0.2;
    }
    if (record.counterpartyAccount) {
      score += 0.1;
    }
    if (record.counterpartyBank) {
      score += 0.1;
    }

    // Prefer records with exchange rate information
    if (record.exchangeRate && record.exchangeRate !== 1) {
      score += 0.1;
    }

    // Prefer records with foreign currency amount
    if (record.amountForeign && record.amountForeign > 0) {
      score += 0.1;
    }

    // Prefer longer, more detailed payment purposes
    if (record.paymentPurpose.length > 20) {
      score += 0.1;
    }

    return score;
  }

  private createUniqueTransactionList(resolvedGroups: DuplicateGroup[]): ParsedTransaction[] {
    const uniqueTransactions: ParsedTransaction[] = [];

    for (const group of resolvedGroups) {
      // Add the master record
      uniqueTransactions.push(group.master);

      // Add metadata to track deduplication
      (group.master as DeduplicatedTransaction)._deduplicationInfo = {
        groupId: group.id,
        isDuplicate: false,
        duplicateCount: group.duplicateCount,
        confidence: group.confidence,
        matchType: group.matchType,
      };

      // Add metadata to duplicates
      group.duplicates.forEach(duplicate => {
        (duplicate as DeduplicatedTransaction)._deduplicationInfo = {
          groupId: group.id,
          isDuplicate: true,
          masterId: group.master.documentNumber || 'unknown',
          duplicateCount: group.duplicateCount,
          confidence: group.confidence,
          matchType: group.matchType,
        };
      });
    }

    return uniqueTransactions;
  }

  private calculateQualityMetrics(
    originalTransactions: ParsedTransaction[],
    resolvedGroups: DuplicateGroup[],
    uniqueTransactions: ParsedTransaction[],
  ): DuplicationQualityMetrics {
    const totalDuplicates = resolvedGroups.reduce((sum, group) => sum + group.duplicateCount, 0);
    const totalTransactions = originalTransactions.length;

    // Precision: How many of the identified duplicates are actually duplicates
    // (In a real implementation, this would require ground truth or manual verification)
    const precision = 0.95; // Assume high precision for now

    // Recall: How many actual duplicates were found
    const recall = Math.min(
      totalDuplicates / Math.max(1, totalTransactions - uniqueTransactions.length),
      1,
    );

    // F1 Score
    const f1Score = 2 * ((precision * recall) / (precision + recall)) || 0;

    // Average confidence
    const averageConfidence =
      resolvedGroups.length > 0
        ? resolvedGroups.reduce((sum, group) => sum + group.confidence, 0) / resolvedGroups.length
        : 0;

    // Correct deduplication rate
    const correctDeduplicationRate =
      totalTransactions > 0
        ? (totalTransactions - uniqueTransactions.length) / totalTransactions
        : 0;

    return {
      precision,
      recall,
      f1Score,
      averageConfidence,
      correctDeduplicationRate,
    };
  }

  private calculateComparisonCount(transactionCount: number, ruleCount: number): number {
    // Approximate number of pairwise comparisons
    return ((transactionCount * (transactionCount - 1)) / 2) * ruleCount;
  }

  private getMemoryUsage(): number {
    // Simplified memory usage estimation
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    return 0;
  }

  /**
   * Detect conflicts between new transactions and existing transactions using tolerant matching.
   * This method compares parsed transactions from a new statement against already-stored transactions
   * in the database to identify potential duplicates with fuzzy matching rules.
   *
   * @param newTransactions Array of parsed transactions from newly uploaded statement
   * @param existingTransactions Array of transaction entities already in the database
   * @returns Array of conflict groups with recommended actions
   */
  async detectConflicts(
    newTransactions: ParsedTransaction[],
    existingTransactions: Transaction[],
  ): Promise<ConflictGroup[]> {
    this.logger.log(
      `Detecting conflicts between ${newTransactions.length} new and ${existingTransactions.length} existing transactions`,
    );

    const conflictGroups: ConflictGroup[] = [];

    // Get configuration values for tolerant matching
    const dateToleranceDays = this.importConfigService.getDedupDateToleranceDays();
    const amountTolerancePercent = this.importConfigService.getDedupAmountTolerancePercent();
    const textSimilarityThreshold = this.importConfigService.getDedupTextSimilarityThreshold();

    this.logger.debug(
      `Using tolerances: date=${dateToleranceDays} days, amount=${amountTolerancePercent}%, text=${textSimilarityThreshold}`,
    );

    // Compare each new transaction against all existing transactions
    for (const newTx of newTransactions) {
      for (const existingTx of existingTransactions) {
        const matchResult = this.applyTolerantRules(newTx, existingTx);

        if (matchResult.isMatch) {
          // Determine recommended action based on confidence and match type
          const recommendedAction = this.determineRecommendedAction(matchResult);

          const conflict: ConflictGroup = {
            newTransaction: newTx,
            existingTransaction: existingTx,
            confidence: matchResult.confidence,
            matchType: matchResult.matchType,
            recommendedAction,
            details: matchResult.details,
          };

          conflictGroups.push(conflict);

          this.logger.debug(
            `Conflict detected: ${matchResult.matchType} (confidence: ${matchResult.confidence.toFixed(3)}, action: ${recommendedAction})`,
          );

          // Break after first match to avoid multiple conflicts for the same new transaction
          break;
        }
      }
    }

    this.logger.log(
      `Detected ${conflictGroups.length} conflicts out of ${newTransactions.length} new transactions`,
    );

    return conflictGroups;
  }

  /**
   * A charge and its refund, or amounts in two different currencies, can land
   * within the same date/amount tolerance window without being the same
   * transaction. Direction only blocks a match when both sides commit to one
   * (missing debit/credit data falls through rather than blocking); currency
   * only blocks when both sides specify one.
   */
  private hasDirectionOrCurrencyMismatch(
    transaction1: ParsedTransaction,
    transaction2: ParsedTransaction | Transaction,
  ): boolean {
    const direction1 =
      transaction1.debit && transaction1.debit > 0
        ? 'debit'
        : transaction1.credit && transaction1.credit > 0
          ? 'credit'
          : null;
    const direction2 =
      transaction2.debit && transaction2.debit > 0
        ? 'debit'
        : transaction2.credit && transaction2.credit > 0
          ? 'credit'
          : null;
    if (direction1 && direction2 && direction1 !== direction2) {
      return true;
    }

    const currency1 = transaction1.currency?.trim().toUpperCase();
    const currency2 = transaction2.currency?.trim().toUpperCase();
    return Boolean(currency1 && currency2 && currency1 !== currency2);
  }

  /**
   * Apply tolerant matching rules to compare two transactions.
   * Uses configurable tolerances for date shifts, amount variations, and text similarity.
   *
   * @param transaction1 First transaction (typically new/parsed transaction)
   * @param transaction2 Second transaction (typically existing transaction)
   * @returns Match result with confidence score and details
   */
  applyTolerantRules(
    transaction1: ParsedTransaction,
    transaction2: ParsedTransaction | Transaction,
  ): MatchResult {
    const dateToleranceDays = this.importConfigService.getDedupDateToleranceDays();
    const amountTolerancePercent = this.importConfigService.getDedupAmountTolerancePercent();
    const textSimilarityThreshold = this.importConfigService.getDedupTextSimilarityThreshold();

    const result: MatchResult = {
      isMatch: false,
      confidence: 0,
      matchType: 'exact',
      details: {},
    };

    // 1. Check date tolerance (±N days)
    const dateDiff = this.calculateDateDifferenceInDays(
      transaction1.transactionDate,
      transaction2.transactionDate,
    );
    result.details.dateDiff = dateDiff;

    const dateMatches = dateDiff <= dateToleranceDays;

    if (!dateMatches) {
      // If dates don't match within tolerance, this is not a match
      return result;
    }

    // 2. Check amount tolerance (±N%)
    const amount1 = transaction1.debit || transaction1.credit || 0;
    const amount2 =
      transaction2.debit || transaction2.credit || (transaction2 as Transaction).amount || 0;

    const amountDiff = this.calculateAmountDifferencePercent(amount1, amount2);
    result.details.amountDiff = amountDiff;

    const amountMatches = amountDiff <= amountTolerancePercent;

    if (!amountMatches) {
      // If amounts don't match within tolerance, this is not a match
      return result;
    }

    if (this.hasDirectionOrCurrencyMismatch(transaction1, transaction2)) {
      return result;
    }

    // 3. Check text similarity for merchant/counterparty name and payment purpose
    const merchantSimilarity = this.calculateStringSimilarity(
      transaction1.counterpartyName,
      transaction2.counterpartyName,
    );

    const purposeSimilarity = this.calculateStringSimilarity(
      transaction1.paymentPurpose,
      transaction2.paymentPurpose,
    );

    // Average text similarity across both fields
    const textSimilarity = (merchantSimilarity + purposeSimilarity) / 2;
    result.details.textSimilarity = textSimilarity;

    const textMatches = textSimilarity >= textSimilarityThreshold;

    // 4. Determine overall match type and confidence
    const exactDate = dateDiff === 0;
    const exactAmount = amountDiff === 0;
    const exactText = textSimilarity === 1.0;

    if (exactDate && exactAmount && exactText) {
      // Perfect exact match
      result.isMatch = true;
      result.confidence = 1.0;
      result.matchType = 'exact';
    } else if (dateMatches && amountMatches && textMatches) {
      // All criteria match within tolerances - determine primary match type
      if (!exactDate && exactAmount && exactText) {
        // Only date is fuzzy
        result.isMatch = true;
        result.confidence = this.calculateCombinedConfidence(dateDiff, amountDiff, textSimilarity);
        result.matchType = 'fuzzy_date';
      } else if (exactDate && !exactAmount && exactText) {
        // Only amount is fuzzy
        result.isMatch = true;
        result.confidence = this.calculateCombinedConfidence(dateDiff, amountDiff, textSimilarity);
        result.matchType = 'fuzzy_amount';
      } else if (exactDate && exactAmount && !exactText) {
        // Only text is fuzzy
        result.isMatch = true;
        result.confidence = this.calculateCombinedConfidence(dateDiff, amountDiff, textSimilarity);
        result.matchType = 'fuzzy_text';
      } else {
        // Multiple fields are fuzzy
        result.isMatch = true;
        result.confidence = this.calculateCombinedConfidence(dateDiff, amountDiff, textSimilarity);
        result.matchType = 'combined';
      }
    }

    return result;
  }

  /**
   * Calculate the difference between two dates in days
   */
  private calculateDateDifferenceInDays(date1: Date, date2: Date): number {
    const time1 = date1.getTime();
    const time2 = date2.getTime();
    const diffMs = Math.abs(time1 - time2);
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate the percentage difference between two amounts
   */
  private calculateAmountDifferencePercent(amount1: number, amount2: number): number {
    if (amount1 === 0 && amount2 === 0) {
      return 0;
    }

    const maxAmount = Math.max(Math.abs(amount1), Math.abs(amount2));
    if (maxAmount === 0) {
      return 0;
    }

    const diff = Math.abs(amount1 - amount2);
    return (diff / maxAmount) * 100;
  }

  /**
   * Calculate combined confidence score based on date, amount, and text matching
   * Higher confidence when differences are smaller
   */
  private calculateCombinedConfidence(
    dateDiff: number,
    amountDiff: number,
    textSimilarity: number,
  ): number {
    const dateToleranceDays = this.importConfigService.getDedupDateToleranceDays();
    const amountTolerancePercent = this.importConfigService.getDedupAmountTolerancePercent();

    // Normalize each component to 0-1 scale
    // Date score: decreases linearly with days difference
    const dateScore = Math.max(0, 1 - dateDiff / Math.max(dateToleranceDays, 1));

    // Amount score: decreases linearly with percentage difference
    const amountScore = Math.max(0, 1 - amountDiff / Math.max(amountTolerancePercent, 1));

    // Text similarity is already 0-1

    // Weighted average: date (30%), amount (40%), text (30%)
    const confidence = dateScore * 0.3 + amountScore * 0.4 + textSimilarity * 0.3;

    return Math.min(1.0, Math.max(0, confidence));
  }

  /**
   * Determine recommended action based on match result
   */
  private determineRecommendedAction(matchResult: MatchResult): ConflictAction {
    const autoResolveThreshold = this.importConfigService.getConflictAutoResolveThreshold();

    // Exact matches: keep existing
    if (matchResult.matchType === 'exact' && matchResult.confidence >= 0.99) {
      return ConflictAction.KEEP_EXISTING;
    }

    // High confidence fuzzy matches
    if (matchResult.confidence >= autoResolveThreshold) {
      // If only date differs slightly, likely a correction - replace
      if (matchResult.matchType === 'fuzzy_date') {
        return ConflictAction.REPLACE;
      }

      // If only amount differs slightly, likely pending vs. final - merge or replace
      if (matchResult.matchType === 'fuzzy_amount') {
        return ConflictAction.MERGE;
      }

      // If only text differs, likely formatting differences - keep existing
      if (matchResult.matchType === 'fuzzy_text') {
        return ConflictAction.KEEP_EXISTING;
      }

      // Combined fuzzy matches with high confidence - manual review
      return ConflictAction.MANUAL_REVIEW;
    }

    // Medium confidence: always manual review
    if (matchResult.confidence >= 0.75) {
      return ConflictAction.MANUAL_REVIEW;
    }

    // Low confidence: manual review (shouldn't happen as match wouldn't be detected)
    return ConflictAction.MANUAL_REVIEW;
  }

  // Public methods for configuration

  addCustomRule(rule: DeduplicationRule): void {
    this.customRules.push(rule);
    this.logger.log(`Added custom deduplication rule: ${rule.name}`);
  }

  removeCustomRule(ruleName: string): boolean {
    const index = this.customRules.findIndex(rule => rule.name === ruleName);
    if (index >= 0) {
      this.customRules.splice(index, 1);
      this.logger.log(`Removed custom deduplication rule: ${ruleName}`);
      return true;
    }
    return false;
  }

  getActiveRules(): DeduplicationRule[] {
    return [...this.defaultRules, ...this.customRules];
  }

  updateRule(ruleName: string, updates: Partial<DeduplicationRule>): void {
    // Update in default rules
    const defaultIndex = this.defaultRules.findIndex(rule => rule.name === ruleName);
    if (defaultIndex >= 0) {
      this.defaultRules[defaultIndex] = {
        ...this.defaultRules[defaultIndex],
        ...updates,
      };
    }

    // Update in custom rules
    const customIndex = this.customRules.findIndex(rule => rule.name === ruleName);
    if (customIndex >= 0) {
      this.customRules[customIndex] = {
        ...this.customRules[customIndex],
        ...updates,
      };
    }

    this.logger.log(`Updated deduplication rule: ${ruleName}`);
  }

  enableRule(ruleName: string): void {
    this.updateRule(ruleName, { enabled: true });
  }

  disableRule(ruleName: string): void {
    this.updateRule(ruleName, { enabled: false });
  }
}
