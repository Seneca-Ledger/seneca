import { Controller, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { ReorderCategorizationRulesBody } from '../../contracts';
import {
  CategorizationRuleList,
  CategorizationRuleSuggestionList,
} from '../../contracts/classification/categorization-rules';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RuleOrderService } from './services/rule-order.service';
import { RuleSuggestionsService } from './services/rule-suggestions.service';

/**
 * The rules list as a whole: its order and the rules worth adding. Registered
 * before `CategorizationRulesController`, whose `/:id` would otherwise take
 * `/order` and `/suggestions` for an id.
 */
@Controller('categorization-rules')
export class CategorizationRuleToolsController {
  constructor(
    private readonly ruleOrderService: RuleOrderService,
    private readonly ruleSuggestionsService: RuleSuggestionsService,
  ) {}

  @Put('order')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  @SchemaResponse(CategorizationRuleList)
  async reorder(
    @SchemaBody(ReorderCategorizationRulesBody) body: ReorderCategorizationRulesBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const rules = await this.ruleOrderService.reorder({
      workspaceId,
      userId: user.id,
      ids: body.ids,
    });
    return { data: rules, total: rules.length };
  }

  @Get('suggestions')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(CategorizationRuleSuggestionList)
  async suggestions(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return { data: await this.ruleSuggestionsService.suggest(workspaceId, selfMemberId) };
  }
}
