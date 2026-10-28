import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ParserHealth } from '../../../contracts';
import { Statement } from '../../../entities/statement.entity';
import {
  type LayoutFirstSeen,
  type ParseRecord,
  summarizeParserHealth,
} from '../helpers/parser-health.helper';

/** The window the counts cover. */
const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const LAYOUT = `"statement"."parsing_details"->'layout'`;

/**
 * Parser health for the instance's administrator: how every bank's statements
 * parsed, across all workspaces. This is the one deliberate exception to
 * filtering by workspace — a bank changing its layout shows up in whichever
 * workspace uploads its file first — so nothing that belongs to a workspace
 * leaves here: no amount, name, description, id or workspace, only each
 * statement's bank, status, parser, reason codes and layout words, and those
 * only as counts per bank and layout.
 */
@Injectable()
export class ParserHealthService {
  constructor(
    @InjectRepository(Statement)
    private readonly statements: Repository<Statement>,
  ) {}

  async health(now = new Date()): Promise<ParserHealth> {
    const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
    const [records, firstSeen] = await Promise.all([this.records(since), this.firstSeen()]);
    return summarizeParserHealth(records, firstSeen, since, now);
  }

  private async records(since: Date): Promise<ParseRecord[]> {
    const rows = await this.statements
      .createQueryBuilder('statement')
      .select('"statement"."bank_name"', 'bank')
      .addSelect('"statement"."status"', 'status')
      .addSelect('"statement"."error_message"', 'errorMessage')
      .addSelect('"statement"."created_at"', 'createdAt')
      .addSelect(`"statement"."parsing_details"->>'parserUsed'`, 'parser')
      .addSelect(`"statement"."parsing_details"->'validation'->'reasonCodes'`, 'reasonCodes')
      .addSelect(LAYOUT, 'layout')
      .where('"statement"."created_at" >= :since', { since })
      .getRawMany<{
        bank: string;
        status: string;
        errorMessage: string | null;
        createdAt: Date;
        parser: string | null;
        reasonCodes: string[] | null;
        layout: ParseRecord['layout'] | null;
      }>();
    return rows.map(row => ({
      bank: row.bank,
      status: row.status,
      errorMessage: row.errorMessage,
      createdAt: new Date(row.createdAt),
      parser: row.parser ?? undefined,
      reasonCodes: row.reasonCodes ?? undefined,
      layout: row.layout ?? undefined,
    }));
  }

  /** Each bank's layouts with the day each was first seen, over all statements. */
  private async firstSeen(): Promise<LayoutFirstSeen[]> {
    const rows = await this.statements
      .createQueryBuilder('statement')
      .select('"statement"."bank_name"', 'bank')
      .addSelect(`${LAYOUT}->>'fingerprint'`, 'fingerprint')
      .addSelect('MIN("statement"."created_at")', 'firstSeen')
      .where(`${LAYOUT}->>'fingerprint' IS NOT NULL`)
      .groupBy('"statement"."bank_name"')
      .addGroupBy(`${LAYOUT}->>'fingerprint'`)
      .getRawMany<{ bank: string; fingerprint: string; firstSeen: Date }>();
    return rows.map(row => ({ ...row, firstSeen: new Date(row.firstSeen) }));
  }
}
