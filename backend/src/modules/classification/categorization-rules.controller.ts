import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { assertOwnerMemberInWorkspace } from '../../common/utils/transaction-owner.util';
import { assertWorkspaceRefs } from '../../common/utils/workspace-refs.util';
import {
  CategorizationRuleApplyResult,
  CategorizationRule as CategorizationRuleContract,
  CategorizationRuleList,
  CategorizationRuleTestResult,
  CreateCategorizationRuleBody,
  TestCategorizationRuleBody,
  UpdateCategorizationRuleBody,
} from '../../contracts';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CategorizationRule } from '../../entities/categorization-rule.entity';
import type { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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

/** A regex that does not compile is the caller's mistake, not a 500 or a rule that never fires. */
function assertPatternsCompile(conditions: readonly ClassificationCondition[]): void {
  for (const condition of conditions) {
    if (condition.operator !== 'regex') {
      continue;
    }
    try {
      new RegExp(String(condition.value), 'i');
    } catch {
      throw new BadRequestException(`Invalid pattern: ${condition.value}`);
    }
  }
}

@Controller('categorization-rules')
export class CategorizationRulesController {
  constructor(
    @InjectRepository(CategorizationRule)
    private categorizationRuleRepository: Repository<CategorizationRule>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    private classificationService: ClassificationService,
    private auditService: AuditService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(CategorizationRuleList)
  async findAll(@WorkspaceId() workspaceId: string) {
    const rules = await this.categorizationRuleRepository.find({
      where: { workspaceId },
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
  @SchemaResponse(CategorizationRuleContract)
  async findOne(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.findRule(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  @SchemaResponse(CategorizationRuleContract)
  async create(
    @SchemaBody(CreateCategorizationRuleBody) dto: CreateCategorizationRuleBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await assertOwnerMemberInWorkspace(
      this.workspaceMemberRepository,
      workspaceId,
      dto.result?.ownerMemberId,
    );
    assertPatternsCompile(dto.conditions);
    // Every row the rule matches would point at what it names.
    await assertWorkspaceRefs(this.categorizationRuleRepository.manager, workspaceId, dto.result);

    const rule = this.categorizationRuleRepository.create({
      userId: user.id,
      workspaceId,
      name: dto.name,
      description: dto.description || null,
      conditions: dto.conditions,
      result: dto.result,
      priority: dto.priority || 0,
      isActive: dto.isActive ?? true,
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
  @SchemaResponse(CategorizationRuleContract)
  async update(
    @Param('id') id: string,
    @SchemaBody(UpdateCategorizationRuleBody) dto: UpdateCategorizationRuleBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const rule = await this.findRule(id, workspaceId);

    const before = this.toAuditSnapshot(rule);
    if (dto.name != null) {
      rule.name = dto.name;
    }
    if (dto.description !== undefined) {
      rule.description = dto.description;
    }
    if (dto.conditions != null) {
      assertPatternsCompile(dto.conditions);
      rule.conditions = dto.conditions;
    }
    if (dto.result != null) {
      await assertOwnerMemberInWorkspace(
        this.workspaceMemberRepository,
        workspaceId,
        dto.result.ownerMemberId,
      );
      await assertWorkspaceRefs(this.categorizationRuleRepository.manager, workspaceId, dto.result);
      rule.result = dto.result;
    }
    if (dto.priority != null) {
      rule.priority = dto.priority;
    }
    if (dto.isActive != null) {
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
    const rule = await this.findRule(id, workspaceId);
    // Taken before remove(), which clears the entity's id.
    const before = this.toAuditSnapshot(rule);

    await this.categorizationRuleRepository.remove(rule);

    // Audit: record rule deletion for rollback.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: user.id,
      entityType: EntityType.RULE,
      entityId: before.id,
      action: AuditAction.DELETE,
      diff: { before, after: null },
      isUndoable: true,
    });
  }

  @Post('test')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(CategorizationRuleTestResult)
  async testRule(
    @SchemaBody(TestCategorizationRuleBody) dto: TestCategorizationRuleBody,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    assertPatternsCompile(dto.conditions);
    // Ids from the request are looked up in this workspace only; without ids the
    // preview runs on the workspace's recent rows.
    return this.classificationService.previewRule({
      workspaceId,
      viewerMemberId: selfMemberId,
      conditions: dto.conditions,
      transactionIds: dto.transactionIds,
    });
  }

  /**
   * Files the existing rows the rule matches under its category. Asked for by
   * the user after saving a rule, never run on its own.
   */
  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_EDIT, Permission.TRANSACTION_EDIT)
  @SchemaResponse(CategorizationRuleApplyResult)
  async applyRule(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const rule = await this.findRule(id, workspaceId);
    if (!rule.result.categoryId) {
      throw new BadRequestException('The rule sets no category to apply');
    }
    return this.classificationService.applyRuleToExisting({
      rule,
      userId: user.id,
      viewerMemberId: selfMemberId,
    });
  }

  /** Rules belong to the workspace: any member who may see categories sees them all. */
  private async findRule(id: string, workspaceId: string): Promise<CategorizationRule> {
    const rule = await this.categorizationRuleRepository.findOne({ where: { id, workspaceId } });
    if (!rule) {
      throw new NotFoundException('Categorization rule not found');
    }
    return rule;
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
