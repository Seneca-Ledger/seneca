import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Put,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import {
  CategorizationRuleParams,
  CreateCategorizationRuleBody,
  TestCategorizationRuleBody,
  UpdateCategorizationRuleBody,
} from '../../contracts';
import {
  CategorizationRuleApplyResult,
  CategorizationRule as CategorizationRuleContract,
  CategorizationRuleList,
  CategorizationRuleTestResult,
} from '../../contracts/classification/categorization-rules';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { CategorizationRule } from '../../entities/categorization-rule.entity';
import type { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toRuleAuditSnapshot } from './helpers/rule-audit';
import { assertConditionsValid, assertRuleRefs } from './helpers/rule-validation';
import { RuleApplicationService } from './services/rule-application.service';
import { RuleOrderService } from './services/rule-order.service';

@Controller('categorization-rules')
export class CategorizationRulesController {
  constructor(
    @InjectRepository(CategorizationRule)
    private categorizationRuleRepository: Repository<CategorizationRule>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    private ruleApplicationService: RuleApplicationService,
    private ruleOrderService: RuleOrderService,
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
  async findOne(
    @SchemaParams(CategorizationRuleParams) { id }: CategorizationRuleParams,
    @WorkspaceId() workspaceId: string,
  ) {
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
    assertConditionsValid(dto.conditions);
    await this.assertRefs(workspaceId, dto);

    const rule = this.categorizationRuleRepository.create({
      userId: user.id,
      workspaceId,
      name: dto.name,
      description: dto.description || null,
      conditions: dto.conditions,
      result: dto.result,
      // A new rule is usually the more specific one, so it goes on top.
      priority: dto.priority ?? (await this.ruleOrderService.topPriority(workspaceId)),
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
      diff: { before: null, after: toRuleAuditSnapshot(rule) },
    });

    return rule;
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  @SchemaResponse(CategorizationRuleContract)
  async update(
    @SchemaParams(CategorizationRuleParams) { id }: CategorizationRuleParams,
    @SchemaBody(UpdateCategorizationRuleBody) dto: UpdateCategorizationRuleBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const rule = await this.findRule(id, workspaceId);

    const before = toRuleAuditSnapshot(rule);
    if (dto.name != null) {
      rule.name = dto.name;
    }
    if (dto.description !== undefined) {
      rule.description = dto.description;
    }
    if (dto.conditions != null) {
      assertConditionsValid(dto.conditions);
    }
    await this.assertRefs(workspaceId, dto);
    if (dto.conditions != null) {
      rule.conditions = dto.conditions;
    }
    if (dto.result != null) {
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
      diff: { before, after: toRuleAuditSnapshot(rule) },
      isUndoable: true,
    });

    return rule;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.CATEGORY_DELETE)
  async remove(
    @SchemaParams(CategorizationRuleParams) { id }: CategorizationRuleParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const rule = await this.findRule(id, workspaceId);
    // Taken before remove(), which clears the entity's id.
    const before = toRuleAuditSnapshot(rule);

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
    assertConditionsValid(dto.conditions);
    // Ids from the request are looked up in this workspace only; without ids the
    // preview runs on the workspace's recent rows.
    return this.ruleApplicationService.previewRule({
      workspaceId,
      viewerMemberId: selfMemberId,
      conditions: dto.conditions,
      transactionIds: dto.transactionIds,
      ruleId: dto.ruleId,
    });
  }

  /**
   * Files the existing rows the rule matches under its category and adds its
   * tags. Asked for by the user after saving a rule, never run on its own.
   */
  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_EDIT, Permission.TRANSACTION_EDIT)
  @SchemaResponse(CategorizationRuleApplyResult)
  async applyRule(
    @SchemaParams(CategorizationRuleParams) { id }: CategorizationRuleParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const rule = await this.findRule(id, workspaceId);
    if (!(rule.result.categoryId || rule.result.tagIds?.length)) {
      throw new BadRequestException(appError('CATEGORIZATION_RULE_NO_CATEGORY'));
    }
    return this.ruleApplicationService.applyRuleToExisting({
      rule,
      userId: user.id,
      viewerMemberId: selfMemberId,
    });
  }

  /** Rules belong to the workspace: any member who may see categories sees them all. */
  private async findRule(id: string, workspaceId: string): Promise<CategorizationRule> {
    const rule = await this.categorizationRuleRepository.findOne({ where: { id, workspaceId } });
    if (!rule) {
      throw new NotFoundException(appError('CATEGORIZATION_RULE_NOT_FOUND'));
    }
    return rule;
  }

  /** Every id the rule names, in what it matches and what it sets, is this workspace's. */
  private assertRefs(
    workspaceId: string,
    dto: Pick<UpdateCategorizationRuleBody, 'conditions' | 'result'>,
  ) {
    return assertRuleRefs(
      this.categorizationRuleRepository.manager,
      this.workspaceMemberRepository,
      workspaceId,
      dto,
    );
  }
}
