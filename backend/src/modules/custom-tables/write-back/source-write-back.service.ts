import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { workspaceRoleAllows } from '../../../common/authz/workspace-permissions';
import { appError } from '../../../common/errors/app-error';
import { isSourceFieldWritable } from '../../../contracts';
import { ActorType, AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { Category } from '../../../entities/category.entity';
import { Client } from '../../../entities/client.entity';
import { CustomTableSourceEdit } from '../../../entities/custom-table-source-edit.entity';
import { Receipt } from '../../../entities/receipt.entity';
import { Statement } from '../../../entities/statement.entity';
import { Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import { User, UserRole } from '../../../entities/user.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import { BudgetsService } from '../../budgets/budgets.service';
import { nameKey } from '../../entity-imports/helpers/import-values';
import { InvoicesService } from '../../invoices/invoices.service';
import { PayablesService } from '../../payables/payables.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { CustomTableSourcesService } from '../custom-table-sources.service';
import type { SourceValue } from '../sources/source.types';
import {
  buildSourceWriters,
  type SourceWriter,
  type WriteContext,
  type WriteMeta,
  type WriterServices,
} from './source-writers';

/** The table a write-back belongs to; only what the service reads. */
export interface WriteBackTable {
  id: string;
  sourceBinding: { kind: string } | null;
}

export interface WriteBackResult {
  /** The record's cell values after the write, as the source reads them. */
  values: Record<string, SourceValue>;
  /** The app's refusal, if a field could not be written; earlier fields stay written. */
  error: unknown | null;
}

export interface RestoreReport {
  reverted: number;
  skippedChanged: number;
  failed: Array<{ sourceKey: string; field: string; code: string }>;
}

const sameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const errorCode = (error: unknown): string => {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === 'object' && body !== null && 'code' in body) {
      return String((body as { code: unknown }).code);
    }
    return String(error.getStatus());
  }
  return 'UNKNOWN';
};

/**
 * Writes cells of a table filled from Seneca data back to the app records they
 * show — through each record's own service, so permissions, tax locks, audit
 * and side effects are the app's — and puts them back on "Restore to default".
 *
 * Every first change of a record field is journaled with the value it replaced
 * (`custom_table_source_edits`): the table never kept it otherwise.
 */
@Injectable()
export class SourceWriteBackService {
  private readonly logger = new Logger(SourceWriteBackService.name);
  private readonly writers: Record<string, SourceWriter>;

  constructor(
    @InjectRepository(CustomTableSourceEdit)
    private readonly editRepository: Repository<CustomTableSourceEdit>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    private readonly sources: CustomTableSourcesService,
    private readonly auditService: AuditService,
    transactionsService: TransactionsService,
    subscriptionsService: SubscriptionsService,
    payablesService: PayablesService,
    invoicesService: InvoicesService,
    budgetsService: BudgetsService,
  ) {
    this.writers = buildSourceWriters({
      transactions: transactionsService,
      subscriptions: subscriptionsService,
      payables: payablesService as unknown as WriterServices['payables'],
      invoices: invoicesService,
      budgets: budgetsService,
      documents: {
        followTransactionCategory: (transactionId, workspaceId) =>
          this.followScanDocument(transactionId, workspaceId),
      },
    });
  }

  /**
   * The table changed a transaction's category. When the transaction is a
   * scanned receipt, the document and the receipt show that category too — the
   * Documents list reads the document's — so they follow, the way a category
   * picked on the receipt reaches the transaction (ReceiptsService). Statements
   * parsed from a bank file hold many unrelated rows and keep their own.
   */
  private async followScanDocument(transactionId: string, workspaceId: string): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
      select: {
        id: true,
        statementId: true,
        categoryId: true,
      },
    });
    if (!transaction?.statementId) {
      return;
    }
    const statement = await this.statementRepository.findOne({
      where: { id: transaction.statementId, workspaceId },
      select: {
        id: true,
        parsingDetails: true,
      },
    });
    if (statement?.parsingDetails?.detectedBy !== 'receipt-scan') {
      return;
    }
    const categoryId = transaction.categoryId ?? null;
    const category = categoryId
      ? await this.categoryRepository.findOne({
          where: { id: categoryId, workspaceId },
          select: {
            id: true,
            name: true,
          },
        })
      : null;
    await this.statementRepository.update({ id: statement.id, workspaceId }, { categoryId });
    const receipts = await this.receiptRepository.find({
      where: { statementId: statement.id, workspaceId },
    });
    for (const receipt of receipts) {
      receipt.parsedData = {
        ...(receipt.parsedData ?? {}),
        // Name and id together, as the receipt's own categorizer writes them.
        category: category?.name ?? undefined,
        categoryId: categoryId ?? undefined,
        categorySource: categoryId ? TransactionCategorySource.MANUAL : null,
        categoryReason: null,
      };
    }
    if (receipts.length) {
      await this.receiptRepository.save(receipts);
    }
  }

  /**
   * Applies cell edits to the record behind one row. Fields are validated and
   * permission-checked before anything is written; then written one by one.
   * A refusal stops the rest and is returned with the record's values as they
   * now are, so the caller can save the row to match the app and then fail.
   */
  async apply(params: {
    userId: string;
    workspaceId: string;
    table: WriteBackTable;
    sourceKey: string;
    changes: Record<string, unknown>;
  }): Promise<WriteBackResult> {
    const { userId, workspaceId, table, sourceKey, changes } = params;
    const kind = this.kindOf(table);
    const writer = this.writerFor(kind);
    for (const field of Object.keys(changes)) {
      if (!isSourceFieldWritable(kind, field)) {
        throw new BadRequestException(appError('SOURCE_FIELD_READ_ONLY'));
      }
    }
    const memberId = await this.assertAllowed(writer, userId, workspaceId);

    let error: unknown = null;
    for (const [field, value] of Object.entries(changes)) {
      const current = await this.readRecord(kind, workspaceId, sourceKey);
      if (sameValue(current[field], value)) {
        continue;
      }
      try {
        await this.writeField({
          kind,
          writer,
          field,
          value,
          table,
          ctx: this.context(userId, workspaceId, memberId, sourceKey, current),
        });
      } catch (caught) {
        error = caught;
        break;
      }
    }
    const values = await this.readRecord(kind, workspaceId, sourceKey).catch(() => ({}));
    return { values, error };
  }

  /**
   * Puts back every record field this table changed. A field whose value in
   * the app is no longer what the table left was changed elsewhere since: it is
   * left as it is. Refusals are reported and stay journaled, so a later restore
   * can retry them.
   */
  async revertTable(params: {
    userId: string;
    workspaceId: string;
    table: WriteBackTable;
  }): Promise<RestoreReport> {
    const { userId, workspaceId, table } = params;
    const report: RestoreReport = { reverted: 0, skippedChanged: 0, failed: [] };
    const edits = await this.editRepository.find({
      where: { tableId: table.id, workspaceId },
      order: { createdAt: 'ASC' },
    });
    if (!edits.length) {
      return report;
    }
    const kind = this.kindOf(table);
    const writer = this.writerFor(kind);
    const memberId = await this.assertAllowed(writer, userId, workspaceId);

    for (const edit of edits) {
      const changed = Object.keys(edit.originalValues).filter(
        field => !sameValue(edit.originalValues[field], edit.writtenValues[field]),
      );
      // Decide from one read, before anything is reverted: putting the amount
      // back also puts the type back, which must not then look "changed elsewhere".
      const initial = await this.readRecord(kind, workspaceId, edit.sourceKey).catch(() => null);
      if (!initial) {
        report.skippedChanged += changed.length;
        await this.editRepository.delete(edit.id);
        continue;
      }
      const toRevert: string[] = [];
      for (const field of changed) {
        if (sameValue(initial[field], edit.writtenValues[field])) {
          toRevert.push(field);
        } else {
          report.skippedChanged += 1;
        }
      }
      const failedFields = new Set<string>();
      for (const field of toRevert) {
        try {
          const current = await this.readRecord(kind, workspaceId, edit.sourceKey);
          if (!sameValue(current[field], edit.originalValues[field])) {
            await writer.revert(
              field,
              edit.originalValues[field],
              edit.meta,
              this.context(userId, workspaceId, memberId, edit.sourceKey, current),
            );
            await this.auditField(writer, {
              userId,
              workspaceId,
              tableId: table.id,
              sourceKey: edit.sourceKey,
              field,
              before: current[field] ?? null,
              after: edit.originalValues[field],
            });
          }
          report.reverted += 1;
        } catch (caught) {
          failedFields.add(field);
          report.failed.push({ sourceKey: edit.sourceKey, field, code: errorCode(caught) });
        }
      }
      if (!failedFields.size) {
        await this.editRepository.delete(edit.id);
        continue;
      }
      // Only the refused fields stay for a later retry: the rest is settled
      // (reverted, or left to the app), so it must not look changed next time.
      for (const field of changed) {
        if (!failedFields.has(field)) {
          edit.writtenValues = { ...edit.writtenValues, [field]: edit.originalValues[field] };
        }
      }
      await this.editRepository.save(edit);
    }
    return report;
  }

  private async writeField(params: {
    kind: string;
    writer: SourceWriter;
    field: string;
    value: unknown;
    table: WriteBackTable;
    ctx: WriteContext;
  }): Promise<void> {
    const { kind, writer, field, value, table, ctx } = params;
    // The record's writable fields are journaled before the app changes: written
    // afterwards, a failed journal save would lose the only copy of what they held.
    let edit = await this.editRepository.findOne({
      where: { tableId: table.id, sourceKey: ctx.sourceKey },
    });
    const created = !edit;
    if (!edit) {
      const snapshot = this.writableValues(kind, ctx.current);
      edit = await this.editRepository.save(
        this.editRepository.create({
          workspaceId: ctx.workspaceId,
          tableId: table.id,
          sourceKind: kind,
          sourceKey: ctx.sourceKey,
          originalValues: snapshot,
          writtenValues: snapshot,
          meta: null,
          userId: ctx.userId,
        }),
      );
    }

    let meta: WriteMeta | undefined;
    try {
      meta = await writer.write(field, value, ctx);
    } catch (error) {
      if (created) {
        await this.editRepository.delete(edit.id);
      }
      throw error;
    }

    const after = await this.readRecord(kind, ctx.workspaceId, ctx.sourceKey).catch(() => ({
      ...ctx.current,
      [field]: value as SourceValue,
    }));
    const written = this.writableValues(kind, after);
    const nextMeta = meta ? { ...(edit.meta ?? {}), ...meta } : edit.meta;
    if (sameValue(written, edit.originalValues) && !nextMeta) {
      // The whole record is back where it started: nothing left for a restore.
      await this.editRepository.delete(edit.id);
    } else {
      edit.writtenValues = written;
      edit.meta = nextMeta ?? null;
      edit.userId = ctx.userId;
      await this.editRepository.save(edit);
    }

    await this.auditField(writer, {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      tableId: table.id,
      sourceKey: ctx.sourceKey,
      field,
      before: ctx.current[field] ?? null,
      after: after[field] ?? null,
    });
  }

  /** The fields of a record the table may write, as a snapshot for the journal. */
  private writableValues(
    kind: string,
    values: Record<string, SourceValue>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(values)
        .filter(([field]) => isSourceFieldWritable(kind, field))
        .map(([field, value]) => [field, value ?? null]),
    );
  }

  /** The record's cells as its source reads them, regardless of the table's filters. */
  private async readRecord(
    kind: string,
    workspaceId: string,
    sourceKey: string,
  ): Promise<Record<string, SourceValue>> {
    const [row] = await this.sources.get(kind).fetchRows(workspaceId, { ids: [sourceKey] });
    if (!row) {
      throw new BadRequestException(appError('SOURCE_RECORD_NOT_FOUND'));
    }
    return row.values;
  }

  private kindOf(table: WriteBackTable): string {
    const kind = table.sourceBinding?.kind;
    if (!kind) {
      throw new BadRequestException(appError('TABLE_NOT_LINKED_TO_SOURCE'));
    }
    return kind;
  }

  private writerFor(kind: string): SourceWriter {
    const writer = this.writers[kind];
    if (!writer) {
      throw new BadRequestException(appError('SOURCE_KIND_UNKNOWN'));
    }
    return writer;
  }

  /**
   * The same rule the record's own endpoint applies (`PermissionsGuard`): a
   * global admin, or a workspace role that carries the permission. Most domain
   * services check nothing themselves, so the table must. Returns the member id.
   */
  private async assertAllowed(
    writer: SourceWriter,
    userId: string,
    workspaceId: string,
  ): Promise<string | null> {
    const member = await this.memberRepository.findOne({ where: { userId, workspaceId } });
    if (member && workspaceRoleAllows(writer.permission, member.role, member.permissions)) {
      return member.id;
    }
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });
    if (user?.role === UserRole.ADMIN) {
      return member?.id ?? null;
    }
    throw new ForbiddenException(appError('SOURCE_EDIT_FORBIDDEN'));
  }

  private context(
    userId: string,
    workspaceId: string,
    memberId: string | null,
    sourceKey: string,
    current: Record<string, SourceValue>,
  ): WriteContext {
    return {
      userId,
      workspaceId,
      memberId,
      sourceKey,
      current,
      resolveCategory: (name, type) => this.resolveCategory(workspaceId, name, type),
      resolveClient: name => this.resolveClient(workspaceId, name),
    };
  }

  /** Same matching as spreadsheet imports: case- and punctuation-blind, same type first. */
  private async resolveCategory(
    workspaceId: string,
    name: string,
    type: 'income' | 'expense',
  ): Promise<string | null> {
    const key = nameKey(name);
    if (!key) {
      return null;
    }
    const all = await this.categoryRepository.find({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        type: true,
        isEnabled: true,
      },
    });
    const named = all.filter(item => item.isEnabled !== false && nameKey(item.name) === key);
    return (named.find(item => item.type === type) ?? named[0])?.id ?? null;
  }

  private async resolveClient(workspaceId: string, name: string): Promise<string | null> {
    const key = nameKey(name);
    const clients = await this.clientRepository.find({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
      },
    });
    return clients.find(client => nameKey(client.name) === key)?.id ?? null;
  }

  /** Payables and invoices audit only in their controllers; a write from the table must too. */
  private async auditField(
    writer: SourceWriter,
    params: {
      userId: string;
      workspaceId: string;
      tableId: string;
      sourceKey: string;
      field: string;
      before: unknown;
      after: unknown;
    },
  ): Promise<void> {
    if (!writer.auditEntity) {
      return;
    }
    try {
      await this.auditService.createEvent({
        workspaceId: params.workspaceId,
        actorType: ActorType.USER,
        actorId: params.userId,
        entityType: writer.auditEntity === 'payable' ? EntityType.PAYABLE : EntityType.INVOICE,
        entityId: params.sourceKey,
        action: AuditAction.UPDATE,
        diff: {
          before: { [params.field]: params.before as never },
          after: { [params.field]: params.after as never },
        },
        meta: { via: 'custom_table', tableId: params.tableId, field: params.field },
        severity: Severity.INFO,
      });
    } catch (error) {
      this.logger.warn(
        `Audit event write failed for ${writer.auditEntity} ${params.sourceKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
