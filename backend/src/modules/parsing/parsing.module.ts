import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { DataQualityFramework } from '../../common/utils/data-quality-framework.util';
import { ParsingRule } from '../../entities/parsing-rule.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { ClassificationModule } from '../classification/classification.module';
import { ImportModule } from '../import/import.module';
import { ObservabilityModule } from '../observability/observability.module';
import { TaxModule } from '../tax/tax.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ParsingController } from './controllers/parsing.controller';
import {
  StaleStatementReaper,
  StatementParsingProcessor,
} from './queue/statement-parsing.processor';
import { STATEMENT_PARSING_QUEUE, StatementParsingQueue } from './queue/statement-parsing.queue';
// import { BankProfileService } from './services/bank-profile.service';
// import { ChecksumAutoFixService } from './services/checksum-auto-fix.service';
// import { ChecksumValidationService } from './services/checksum-validation.service';
// import { ColumnAutoFixService } from './services/column-auto-fix.service';
// import { ColumnValidationService } from './services/column-validation.service';
import { DocumentClassifierService } from './services/document-classifier.service';
// import { FeatureFlagService } from './services/feature-flag.service';
// import { IntelligentDeduplicationService } from './services/intelligent-deduplication.service';
import { MetadataExtractionService } from './services/metadata-extraction.service';
import { OcrService } from './services/ocr.service';
import { ParserFactoryService } from './services/parser-factory.service';
// import { ParsingRulesService } from './services/parsing-rules.service';
// import { ProfileConfigService } from './services/profile-config.service';
// import { QualityLoggingService } from './services/quality-logging.service';
// import { QualityMetricsService } from './services/quality-metrics.service';
// import { StatementNormalizationService } from './services/statement-normalization.service';
import { StatementProcessingService } from './services/statement-processing.service';
// import { StatementQualityGate } from './services/statement-quality-gate.service';
// import { TextCleaningService } from './services/text-cleaning.service';
// import { TransactionNormalizer } from './services/transaction-normalizer.service';
import { TransactionTypeDetectorService } from './services/transaction-type-detector.service';
import { UniversalAmountParser } from './services/universal-amount-parser.service';
// import { UniversalDateParser } from './services/universal-date-parser.service';
import { UniversalExtractorService } from './services/universal-extractor.service';

/**
 * Services below are commented out rather than deleted: they are registered
 * nowhere else and injected by nothing, so Nest was instantiating a parallel
 * "quality/normalization" stack on every boot that the parsing pipeline in
 * StatementProcessingService never calls. Their source files and unit tests are
 * left in place — un-comment a line here to wire one back in.
 *
 * Verified consumers of what remains:
 *   UniversalExtractorService  -> parsing.controller, receipts, gmail
 *   UniversalAmountParser      -> gmail, UniversalExtractorService
 *   DocumentClassifierService  -> UniversalExtractorService
 *   TransactionTypeDetector    -> UniversalExtractorService
 *   MetadataExtractionService  -> StatementProcessingService
 *   OcrService                 -> UniversalExtractorService, hapoalim parser
 *
 * IntelligentDeduplicationService is still live, but ImportModule registers and
 * exports its own instance, so the duplicate registration here was redundant.
 *
 * The parsers themselves construct BankProfileService/FeatureFlagService from
 * `common/utils/*` directly (see BaseParser), not the same-named services here.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Statement, Transaction, ParsingRule, User]),
    ClassificationModule,
    forwardRef(() => ImportModule),
    ObservabilityModule,
    forwardRef(() => TransactionsModule),
    BullModule.registerQueue({ name: STATEMENT_PARSING_QUEUE }),
    TaxModule,
  ],
  controllers: [ParsingController],
  providers: [
    ParserFactoryService,
    StatementProcessingService,
    StatementParsingQueue,
    StatementParsingProcessor,
    StaleStatementReaper,
    // StatementQualityGate,
    // ParsingRulesService,
    // StatementNormalizationService,
    // TransactionNormalizer,
    // UniversalDateParser,
    UniversalAmountParser,
    // TextCleaningService,
    // ColumnValidationService,
    // ChecksumValidationService,
    // QualityLoggingService,
    MetadataExtractionService,
    // ColumnAutoFixService,
    // ChecksumAutoFixService,
    // BankProfileService,
    // FeatureFlagService,
    // IntelligentDeduplicationService,
    // QualityMetricsService,
    // ProfileConfigService,
    // DataQualityFramework,
    DocumentClassifierService,
    OcrService,
    TransactionTypeDetectorService,
    UniversalExtractorService,
  ],
  exports: [
    ParserFactoryService,
    StatementProcessingService,
    StatementParsingQueue,
    // StatementQualityGate,
    // ParsingRulesService,
    // StatementNormalizationService,
    // TransactionNormalizer,
    // UniversalDateParser,
    UniversalAmountParser,
    // TextCleaningService,
    // ColumnValidationService,
    // ChecksumValidationService,
    // QualityLoggingService,
    MetadataExtractionService,
    // ColumnAutoFixService,
    // ChecksumAutoFixService,
    // BankProfileService,
    // FeatureFlagService,
    // IntelligentDeduplicationService,
    // QualityMetricsService,
    // DataQualityFramework,
    DocumentClassifierService,
    OcrService,
    TransactionTypeDetectorService,
    UniversalExtractorService,
  ],
})
export class ParsingModule {}
