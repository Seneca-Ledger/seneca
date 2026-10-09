import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ViewPreferenceDto, ViewScopeParam } from './dto/view-preference.dto';
import { ViewPreferencesService } from './view-preferences.service';

/**
 * A page's own memory of how one person left it.
 *
 * Behind `TRANSACTION_VIEW` rather than a permission of its own: it stores no
 * money, only which filter someone had open, and everyone who can open a page
 * can remember it.
 */
@Controller('view-preferences')
export class ViewPreferencesController {
  constructor(private readonly service: ViewPreferencesService) {}

  @Get(':scope')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async read(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param() params: ViewScopeParam,
  ) {
    return { state: await this.service.read(user.id, workspaceId, params.scope) };
  }

  @Put(':scope')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async write(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param() params: ViewScopeParam,
    @Body() dto: ViewPreferenceDto,
  ) {
    return { state: await this.service.write(user.id, workspaceId, params.scope, dto.state) };
  }
}
