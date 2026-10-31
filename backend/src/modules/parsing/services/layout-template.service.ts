import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import {
  extractTextAndLayoutFromPdf,
  extractTextFromPdf,
} from '../../../common/utils/pdf-parser.util';
import type { StatementLayoutWords, TeachLayoutPreview } from '../../../contracts';
import { ParsingLayoutTemplate } from '../../../entities/parsing-layout-template.entity';
import { FileType, Statement } from '../../../entities/statement.entity';
import {
  GOOD_READING,
  type LayoutTemplate,
  layoutReading,
  missingTags,
  readingScore,
  type TeachRegion,
  templateFits,
  templateFromRegions,
  templateSignature,
} from '../helpers/layout-template.helper';
import { leadingDate } from '../helpers/pdf-layout-row-date.helper';
import { readLayoutTable } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import type { IParser } from '../interfaces/parser.interface';
import { TaughtPdfParser } from '../parsers/taught-pdf.parser';

/** The most recently taught layouts a statement is tried in, newest first. */
const MAX_TEMPLATES = 20;

/** A reading marked with the taught layout it came from, kept in the statement's layout. */
const readWith = (parsed: ParsedStatement, templateId: string): ParsedStatement => ({
  ...parsed,
  layout: {
    fingerprint: '',
    headings: [],
    unknownWords: [],
    ...parsed.layout,
    taughtTemplate: templateId,
  },
});

const sum = (values: (number | undefined)[]) =>
  Number(values.reduce<number>((total, value) => total + (value ?? 0), 0).toFixed(2));

/**
 * Layouts a workspace taught by marking statements its parser could not read
 * (layout-template.helper): saved per workspace, and tried on that
 * workspace's next statements whenever their own reading fails.
 */
@Injectable()
export class LayoutTemplateService {
  private readonly logger = new Logger(LayoutTemplateService.name);

  constructor(
    @InjectRepository(ParsingLayoutTemplate)
    private readonly templates: Repository<ParsingLayoutTemplate>,
    @InjectRepository(Statement)
    private readonly statements: Repository<Statement>,
  ) {}

  /** The parser, reading through `parse` below. */
  readerFor(parser: IParser, statement: Statement) {
    return {
      parse: (filePath: string, cachedText?: string, ocrConfidence?: number) =>
        this.parse(parser, statement, filePath, cachedText, ocrConfidence),
    };
  }

  /**
   * A statement taught by hand is read with its own layout, whatever the
   * parser makes of it. Any other gets the parser's reading, or the reading
   * of a layout the workspace taught when the parser's finds no rows, fails a
   * format check or throws; a taught reading is kept only when it scores
   * better (readingScore).
   */
  async parse(
    parser: IParser,
    statement: Statement,
    filePath: string,
    cachedText?: string,
    ocrConfidence?: number,
  ): Promise<ParsedStatement> {
    const own =
      statement.fileType === FileType.PDF ? await this.ownReading(statement, filePath) : null;
    if (own) {
      return own;
    }
    let parsed: ParsedStatement | null = null;
    let failure: unknown = null;
    try {
      parsed = await parser.parse(filePath, cachedText, ocrConfidence);
    } catch (error) {
      failure = error;
    }
    const score = parsed ? readingScore(parsed) : -1;
    if (statement.fileType === FileType.PDF && score < GOOD_READING) {
      const taught = await this.taughtReading(statement.workspaceId, filePath, cachedText, score);
      if (taught) {
        return taught;
      }
    }
    if (!parsed) {
      throw failure;
    }
    return parsed;
  }

  /** The reading with the layout taught on this very statement, when it reads any rows. */
  private async ownReading(
    statement: Statement,
    filePath: string,
  ): Promise<ParsedStatement | null> {
    const own = await this.templates.findOne({
      where: { workspaceId: statement.workspaceId, statementId: statement.id },
      order: { updatedAt: 'DESC' },
    });
    if (!own) {
      return null;
    }
    const parsed = await new TaughtPdfParser(own.template).parse(filePath).catch(() => null);
    return parsed && parsed.transactions.length > 0 ? readWith(parsed, own.id) : null;
  }

  private async taughtReading(
    workspaceId: string,
    filePath: string,
    cachedText: string | undefined,
    floor: number,
  ): Promise<ParsedStatement | null> {
    const templates = await this.templates.find({
      where: { workspaceId },
      order: { updatedAt: 'DESC' },
      take: MAX_TEMPLATES,
    });
    if (templates.length === 0) {
      return null;
    }
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    let best: { parsed: ParsedStatement; score: number; template: ParsingLayoutTemplate } | null =
      null;
    for (const template of templates.filter(candidate => templateFits(candidate.template, text))) {
      try {
        const parsed = await new TaughtPdfParser(template.template).parse(filePath, cachedText);
        const score = readingScore(parsed);
        if (score > (best?.score ?? floor)) {
          best = { parsed, score, template };
        }
      } catch (error) {
        this.logger.warn(`Taught layout ${template.id} failed: ${(error as Error).message}`);
      }
      if (best?.score === GOOD_READING) {
        break;
      }
    }
    if (!best) {
      return null;
    }
    await this.templates.increment({ id: best.template.id, workspaceId }, 'usedCount', 1);
    this.logger.log(`Statement read with taught layout ${best.template.id}`);
    return readWith(best.parsed, best.template.id);
  }

  /** Every word the parser reads in the statement's file, where it sits. */
  async words(id: string, workspaceId: string): Promise<StatementLayoutWords> {
    const statement = await this.pdfStatement(id, workspaceId);
    const { rows } = await this.withFile(statement, extractTextAndLayoutFromPdf);
    return {
      words: rows.flatMap(row => {
        const dated = leadingDate([...row.items].sort((a, b) => a.x - b.x)) !== null;
        return row.items.map(({ text, page, x, y, width, height }) => ({
          text,
          page,
          x,
          y,
          width,
          height,
          dated,
        }));
      }),
    };
  }

  /** How the statement reads with the marked areas. Nothing is saved. */
  async preview(id: string, workspaceId: string, regions: readonly TeachRegion[]) {
    const statement = await this.pdfStatement(id, workspaceId);
    const missing = missingTags(regions);
    if (missing.length > 0) {
      return { missing, transactions: 0, totalDebit: 0, totalCredit: 0, checks: [], rows: [] };
    }
    return this.withFile(statement, async (filePath): Promise<TeachLayoutPreview> => {
      const { rows } = await extractTextAndLayoutFromPdf(filePath);
      const template = templateFromRegions(regions, rows);
      const parsed = await new TaughtPdfParser(template).parse(filePath);
      const read = readLayoutTable(rows, layoutReading(template)).transactions;
      const checks = (parsed.checks ?? []).map(check => ({
        code: check.code,
        passed: check.passed,
        ...(check.detail?.row === undefined ? {} : { row: check.detail.row }),
      }));
      const broken = checks.find(check => check.code === 'balance_chain' && !check.passed)?.row;
      return {
        missing,
        transactions: parsed.transactions.length,
        totalDebit: sum(parsed.transactions.map(row => row.debit)),
        totalCredit: sum(parsed.transactions.map(row => row.credit)),
        checks,
        rows: read.flatMap((row, index) =>
          row.at ? [{ ...row.at, broken: index + 1 === broken }] : [],
        ),
      };
    });
  }

  /**
   * Saves the layout the marked areas teach, bound to the statement: teaching
   * it again replaces it, and so does teaching another statement the same layout.
   */
  async teach(
    id: string,
    workspaceId: string,
    userId: string,
    regions: readonly TeachRegion[],
  ): Promise<LayoutTemplate> {
    const statement = await this.pdfStatement(id, workspaceId);
    if (missingTags(regions).length > 0) {
      throw new BadRequestException(appError('STATEMENT_TEACH_TAGS_MISSING'));
    }
    const { rows } = await this.withFile(statement, extractTextAndLayoutFromPdf);
    const template = templateFromRegions(regions, rows);
    // Teaching a statement again replaces what it was taught before.
    await this.templates.delete({ workspaceId, statementId: statement.id });
    await this.templates.upsert(
      {
        workspaceId,
        signature: templateSignature(template),
        bankName: statement.bankName,
        template,
        statementId: statement.id,
        taughtBy: userId,
      },
      ['workspaceId', 'signature'],
    );
    return template;
  }

  private async pdfStatement(id: string, workspaceId: string): Promise<Statement> {
    const statement = await this.statements.findOne({ where: { id, workspaceId } });
    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }
    if (statement.fileType !== FileType.PDF) {
      throw new BadRequestException(appError('STATEMENT_TEACH_PDF_ONLY'));
    }
    return statement;
  }

  /** The statement's file on disk, or its stored bytes in a temporary file for the call. */
  private async withFile<T>(statement: Statement, read: (filePath: string) => Promise<T>) {
    if (statement.filePath && fs.existsSync(statement.filePath)) {
      return read(statement.filePath);
    }
    const stored = await this.statements
      .createQueryBuilder('statement')
      .addSelect('statement.fileData')
      .where('statement.id = :id AND statement.workspaceId = :workspaceId', {
        id: statement.id,
        workspaceId: statement.workspaceId,
      })
      .getOne();
    if (!stored?.fileData) {
      throw new NotFoundException(appError('STATEMENT_FILE_DATA_UNAVAILABLE'));
    }
    const tempPath = path.join(os.tmpdir(), `teach-${statement.id}-${Date.now()}.pdf`);
    await fs.promises.writeFile(tempPath, stored.fileData);
    try {
      return await read(tempPath);
    } finally {
      await fs.promises.rm(tempPath, { force: true });
    }
  }
}
