import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { IncomeTaxReturn, IncomeTaxReturnStatus } from '../../entities/income-tax-return.entity';
import { AuditService } from '../audit/audit.service';
import type { IncomeTaxDraft } from './income-tax.types';
import { IncomeTaxDisclaimerService } from './income-tax-disclaimer.service';
import {
  buildIncomeTaxCsv,
  buildIncomeTaxFileName,
  buildIncomeTaxPdf,
  buildIncomeTaxXlsx,
} from './income-tax-document';
import { IncomeTaxDraftService } from './income-tax-draft.service';

const UNIQUE_VIOLATION = '23505';

/**
 * Drafts, their finalization and their documents.
 *
 * A draft is recomputed from current data on every read and nothing is written
 * for it. Finalizing stores the whole draft as it stood, so the figures the user
 * took to their tax authority can be shown again later even after the
 * underlying transactions have changed.
 */
@Injectable()
export class IncomeTaxReturnsService {
  private readonly logger = new Logger(IncomeTaxReturnsService.name);

  constructor(
    @InjectRepository(IncomeTaxReturn)
    private readonly returnRepository: Repository<IncomeTaxReturn>,
    private readonly draftService: IncomeTaxDraftService,
    private readonly disclaimerService: IncomeTaxDisclaimerService,
    private readonly auditService: AuditService,
  ) {}

  /** Audit failure is logged, never allowed to undo a status change that committed. */
  private async recordStatusChange(
    workspaceId: string,
    userId: string | undefined,
    returnId: string,
    taxYear: number,
    formKey: string,
    before: IncomeTaxReturnStatus | null,
    after: IncomeTaxReturnStatus,
    severity?: Severity,
  ): Promise<void> {
    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId ?? null,
        entityType: EntityType.TAX_RETURN,
        entityId: returnId,
        action: AuditAction.UPDATE,
        diff: { before: { status: before }, after: { status: after } },
        meta: { taxYear, formKey },
        ...(severity ? { severity } : {}),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for income-tax return ${returnId}: ${message}`);
    }
  }

  async getDraft(workspaceId: string, taxYear: number): Promise<IncomeTaxDraft> {
    const { pack } = await this.draftService.getContext(workspaceId, taxYear);
    const record = await this.returnRepository.findOne({
      where: { workspaceId, taxYear, formKey: pack.formKey },
    });

    if (record?.status === IncomeTaxReturnStatus.FINALIZED && record.snapshot) {
      return record.snapshot as unknown as IncomeTaxDraft;
    }
    return this.draftService.compute(workspaceId, taxYear);
  }

  async finalize(workspaceId: string, userId: string, taxYear: number): Promise<IncomeTaxDraft> {
    await this.disclaimerService.assertAccepted(userId);

    const { jurisdiction, pack } = await this.draftService.getContext(workspaceId, taxYear);
    const existing = await this.returnRepository.findOne({
      where: { workspaceId, taxYear, formKey: pack.formKey },
    });
    if (existing?.status === IncomeTaxReturnStatus.FINALIZED) {
      throw new ConflictException('This tax year has already been finalized');
    }

    const draft = await this.draftService.compute(workspaceId, taxYear);
    const finalizedAt = new Date();
    const snapshot: IncomeTaxDraft = {
      ...draft,
      status: 'finalized',
      finalizedAt: finalizedAt.toISOString(),
    };

    let saved: IncomeTaxReturn;
    try {
      saved = await this.returnRepository.save({
        ...(existing ?? {}),
        workspaceId,
        jurisdictionId: jurisdiction.id,
        taxYear,
        formKey: pack.formKey,
        status: IncomeTaxReturnStatus.FINALIZED,
        finalizedAt,
        finalizedBy: userId,
        snapshot: snapshot as unknown as Record<string, unknown>,
      });
    } catch (error) {
      // Two finalize requests racing for the same year: the unique index lets
      // exactly one through, and the other is the same conflict as above.
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('This tax year has already been finalized');
      }
      throw error;
    }

    await this.recordStatusChange(
      workspaceId,
      userId,
      saved.id,
      taxYear,
      pack.formKey,
      existing?.status ?? null,
      IncomeTaxReturnStatus.FINALIZED,
    );

    this.logger.log(
      `Finalized income-tax draft ${pack.formKey} ${taxYear} for workspace ${workspaceId} ` +
        `(completeness ${draft.completeness.score})`,
    );
    return snapshot;
  }

  async reopen(workspaceId: string, taxYear: number, userId?: string): Promise<IncomeTaxDraft> {
    const { pack } = await this.draftService.getContext(workspaceId, taxYear);
    const existing = await this.returnRepository.findOne({
      where: { workspaceId, taxYear, formKey: pack.formKey },
    });
    if (existing?.status !== IncomeTaxReturnStatus.FINALIZED) {
      throw new BadRequestException('This tax year is not finalized');
    }

    await this.returnRepository.save({
      ...existing,
      status: IncomeTaxReturnStatus.DRAFT,
      finalizedAt: null,
      finalizedBy: null,
      snapshot: null,
    });
    // Reopening discards the finalized snapshot, so it is flagged for review.
    await this.recordStatusChange(
      workspaceId,
      userId,
      existing.id,
      taxYear,
      pack.formKey,
      existing.status,
      IncomeTaxReturnStatus.DRAFT,
      Severity.WARN,
    );
    return this.draftService.compute(workspaceId, taxYear);
  }

  async export(
    workspaceId: string,
    userId: string,
    taxYear: number,
    format: 'pdf' | 'xlsx' | 'csv',
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    // A document leaves the app and can be handed on; it should not exist
    // without the user having acknowledged what it is and is not.
    await this.disclaimerService.assertAccepted(userId);
    const draft = await this.getDraft(workspaceId, taxYear);

    if (format === 'csv') {
      return {
        buffer: buildIncomeTaxCsv(draft),
        fileName: buildIncomeTaxFileName(draft, 'csv'),
        contentType: 'text/csv; charset=utf-8',
      };
    }
    if (format === 'pdf') {
      return {
        buffer: await buildIncomeTaxPdf(draft),
        fileName: buildIncomeTaxFileName(draft, 'pdf'),
        contentType: 'application/pdf',
      };
    }
    return {
      buffer: buildIncomeTaxXlsx(draft),
      fileName: buildIncomeTaxFileName(draft, 'xlsx'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
