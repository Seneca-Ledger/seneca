import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { assertOwnerMemberInWorkspace } from '../../common/utils/transaction-owner.util';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CategorizationRule } from '../../entities/categorization-rule.entity';
import { Transaction } from '../../entities/transaction.entity';
import type { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCategorizationRuleDto } from './dto/create-categorization-rule.dto';
import { TestCategorizationRuleDto } from './dto/test-categorization-rule.dto';
import { UpdateCategorizationRuleDto } from './dto/update-categorization-rule.dto';
import type { ClassificationCondition } from './interfaces/classification-rule.interface';
import { ClassificationService } from './services/classification.service';

type CategorizationRuleAuditSnapshot = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  conditions: ClassificationCondition[];
  result: CategorizationRule['result'];
  priority: number;
  isActive: boolean;
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

@Controller('categorization-rules')
export class CategorizationRulesController {
  constructor(
    @InjectRepository(CategorizationRule)
    private categorizationRuleRepository: Repository<CategorizationRule>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    private classificationService: ClassificationService,
    private auditService: AuditService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async findAll(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const rules = await this.categorizationRuleRepository.find({
      where: {
        userId: user.id,
        workspaceId,
      },
      order: {
        priority: 'DESC',
        createdAt: 'DESC',
      },
    });

    return {
      data: rules,
      total: rules.length,
    };
  }

  @Get(':id')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const rule = await this.categorizationRuleRepository.findOne({
      where: {
        id,
        userId: user.id,
        workspaceId,
      },
    });

    if (!rule) {
      throw new Error('Categorization rule not found');
    }

    return rule;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  async create(
    @Body() dto: CreateCategorizationRuleDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await assertOwnerMemberInWorkspace(
      this.workspaceMemberRepository,
      workspaceId,
      dto.result?.ownerMemberId,
    );

    const rule = this.categorizationRuleRepository.create({
      userId: user.id,
      workspaceId,
      name: dto.name,
      description: dto.description || null,
      conditions: dto.conditions,
      result: dto.result,
      priority: dto.priority || 0,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      matchCount: 0,
      lastMatchedAt: null,
    });

    await this.categorizationRuleRepository.save(rule);

    // Audit: record rule creation for audit trail.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: user.id,
      entityType: EntityType.RULE,
      entityId: rule.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: this.toAuditSnapshot(rule) },
    });

    return rule;
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategorizationRuleDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const rule = await this.categorizationRuleRepository.findOne({
      where: {
        id,
        userId: user.id,
        workspaceId,
      },
    });

    if (!rule) {
      throw new Error('Categorization rule not found');
    }

    const before = this.toAuditSnapshot(rule);
    if (dto.name !== undefined) {
      rule.name = dto.name;
    }
    if (dto.description !== undefined) {
      rule.description = dto.description;
    }
    if (dto.conditions !== undefined) {
      rule.conditions = dto.conditions;
    }
    if (dto.result !== undefined) {
      await assertOwnerMemberInWorkspace(
        this.workspaceMemberRepository,
        workspaceId,
        dto.result.ownerMemberId,
      );
      rule.result = dto.result;
    }
    if (dto.priority !== undefined) {
      rule.priority = dto.priority;
    }
    if (dto.isActive !== undefined) {
      rule.isActive = dto.isActive;
    }

    await this.categorizationRuleRepository.save(rule);

    // Audit: record rule updates with before/after snapshots.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: user.id,
      entityType: EntityType.RULE,
      entityId: rule.id,
      action: AuditAction.UPDATE,
      diff: { before, after: this.toAuditSnapshot(rule) },
      isUndoable: true,
    });

    return rule;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.CATEGORY_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const rule = await this.categorizationRuleRepository.findOne({
      where: {
        id,
        userId: user.id,
        workspaceId,
      },
    });

    if (!rule) {
      throw new Error('Categorization rule not found');
    }

    await this.categorizationRuleRepository.remove(rule);

    // Audit: record rule deletion for rollback.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: user.id,
      entityType: EntityType.RULE,
      entityId: rule.id,
      action: AuditAction.DELETE,
      diff: { before: this.toAuditSnapshot(rule), after: null },
      isUndoable: true,
    });
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async testRule(
    @Body() dto: TestCategorizationRuleDto,
    @CurrentUser() _user: User,
    @WorkspaceId() _workspaceId: string,
  ) {
    const transactions = await this.transactionRepository.findByIds(dto.transactionIds);

    const matches = transactions.filter(transaction =>
      this.classificationService.matchesRule(transaction, dto.conditions),
    );

    return {
      totalTransactions: transactions.length,
      matchedTransactions: matches.length,
      matches: matches.map(t => ({
        id: t.id,
        date: t.transactionDate,
        amount: t.debit || t.credit || t.amount,
        counterparty: t.counterpartyName,
        purpose: t.paymentPurpose,
        matchReason: this.getMatchReason(t, dto.conditions),
      })),
    };
  }

  private getMatchReason(transaction: Transaction, conditions: ClassificationCondition[]): string {
    const matchedConditions: string[] = [];

    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(transaction, condition.field);
      if (!fieldValue) {
        continue;
      }

      let matches = false;
      const value = String(fieldValue).toLowerCase();
      const conditionValue = String(condition.value).toLowerCase();

      switch (condition.operator) {
        case 'contains':
          matches = value.includes(conditionValue);
          break;
        case 'equals':
          matches = value === conditionValue;
          break;
        case 'starts_with':
          matches = value.startsWith(conditionValue);
          break;
        case 'ends_with':
          matches = value.endsWith(conditionValue);
          break;
        case 'regex':
          matches = new RegExp(conditionValue, 'i').test(value);
          break;
        case 'greater_than':
          matches = Number(fieldValue) > Number(condition.value);
          break;
        case 'less_than':
          matches = Number(fieldValue) < Number(condition.value);
          break;
      }

      if (matches) {
        matchedConditions.push(`${condition.field} ${condition.operator} "${condition.value}"`);
      }
    }

    return matchedConditions.join(' AND ');
  }

  private getFieldValue(
    transaction: Transaction,
    field: ClassificationCondition['field'],
  ): string | number | null {
    switch (field) {
      case 'counterparty_name':
        return transaction.counterpartyName;
      case 'payment_purpose':
        return transaction.paymentPurpose;
      case 'amount':
        return transaction.amount || transaction.debit || transaction.credit || 0;
      case 'counterparty_bin':
        return transaction.counterpartyBin || null;
      case 'document_number':
        return transaction.documentNumber || null;
    }
  }

  private toAuditSnapshot(rule: CategorizationRule): CategorizationRuleAuditSnapshot {
    return {
      id: rule.id,
      userId: rule.userId,
      workspaceId: rule.workspaceId,
      name: rule.name,
      description: rule.description,
      conditions: rule.conditions,
      result: rule.result,
      priority: rule.priority,
      isActive: rule.isActive,
      matchCount: rule.matchCount,
      lastMatchedAt: rule.lastMatchedAt?.toISOString() || null,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}
