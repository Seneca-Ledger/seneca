import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WorkspaceId } from '../../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../../common/decorators/workspace-auth.decorator';
import { SchemaParams } from '../../../common/effect/schema-query';
import { SchemaResponse } from '../../../common/effect/schema-response';
import { Permission } from '../../../common/enums/permissions.enum';
import { StatementSuggestionsParams, StatementSuggestionsResult } from '../../../contracts';
import type { User } from '../../../entities/user.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { StatementSuggestionsService } from './statement-suggestions.service';

/** Suggesting rewrites the category of rows nobody decided, so it takes the right to edit transactions. */
@Controller('classification')
export class StatementSuggestionsController {
  constructor(private readonly suggestions: StatementSuggestionsService) {}

  @Post('statements/:id/suggestions')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(StatementSuggestionsResult)
  suggest(
    @SchemaParams(StatementSuggestionsParams) { id }: StatementSuggestionsParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.suggestions.suggest(workspaceId, user.id, id);
  }
}
