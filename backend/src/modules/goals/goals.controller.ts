import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { deletedResponse } from '../../common/utils/responses.util';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateGoalItemDto } from './dto/create-goal-item.dto';
import { GoalFlowQueryDto } from './dto/goal-flow-query.dto';
import { ListGoalsQueryDto } from './dto/list-goals-query.dto';
import { SearchCoversDto } from './dto/search-covers.dto';
import { SetGoalCoverDto } from './dto/set-goal-cover.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { UpdateGoalItemDto } from './dto/update-goal-item.dto';
import { GOAL_COVER_PRESETS } from './goal-cover.constants';
import { GoalCoversService } from './goal-covers.service';
import { GoalFlowService } from './goal-flow.service';
import { GoalItemsService } from './goal-items.service';
import { GoalPlanService } from './goal-plan.service';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly goalFlowService: GoalFlowService,
    private readonly goalItemsService: GoalItemsService,
    private readonly goalPlanService: GoalPlanService,
    private readonly goalCoversService: GoalCoversService,
  ) {}

  /**
   * The bundled covers, so the picker has something to show before anyone
   * types — and still has something to show when the photo search is out of
   * allowance. Declared before every `:id` route so "covers" is never read as
   * a goal id.
   */
  @Get('covers/presets')
  @WorkspaceAuth(Permission.GOAL_VIEW)
  @ApiOperation({ summary: 'Bundled goal cover ids' })
  @ApiResponse({ status: 200, description: 'The preset ids the client can draw' })
  listCoverPresets() {
    return { presets: GOAL_COVER_PRESETS };
  }

  @Get('covers/search')
  @WorkspaceAuth(Permission.GOAL_VIEW)
  @ApiOperation({ summary: 'Search Openverse for a goal cover photo' })
  @ApiResponse({ status: 200, description: 'A page of results with their credit lines' })
  @ApiResponse({ status: 502, description: 'The image search did not answer' })
  @ApiResponse({ status: 503, description: 'The daily search allowance is used up' })
  async searchCovers(@Query() query: SearchCoversDto) {
    return this.goalCoversService.search(query.q, query.page ?? 1);
  }

  /**
   * A search result's thumbnail, proxied. One grid of results is 18 image
   * requests, which the API-wide limit is not sized for.
   */
  // Signed-in users only, but no workspace scope: an Openverse thumbnail is a
  // public picture and carries no tenant data. It also cannot have one — an
  // <img> tag cannot send the x-workspace-id header the workspace guard reads.
  @Get('covers/preview/:photoId')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @ApiOperation({ summary: 'Thumbnail for a search result' })
  @ApiResponse({ status: 200, description: 'A raster image' })
  @ApiResponse({ status: 404, description: 'No such image upstream' })
  async getCoverPreview(@Param('photoId', ParseUUIDPipe) photoId: string, @Res() res: Response) {
    const image = await this.goalCoversService.getThumbnail(photoId);
    // private: the response sits behind the session cookie.
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(image.body);
  }

  @Post()
  @WorkspaceAuth(Permission.GOAL_CREATE)
  async create(
    @Body() createDto: CreateGoalDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.goalsService.create(workspaceId, user.id, createDto);
  }

  @Get()
  @WorkspaceAuth(Permission.GOAL_VIEW)
  async findAll(@WorkspaceId() workspaceId: string, @Query() query: ListGoalsQueryDto) {
    return this.goalsService.findAll(workspaceId, query.month);
  }

  /**
   * Plan versus actual for one goal. Reads budget limits as well as spending,
   * so it asks for both permissions; the guard requires all of them.
   */
  @Get(':id/flow')
  @WorkspaceAuth(Permission.GOAL_VIEW, Permission.BUDGET_VIEW)
  async getFlow(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @Query() query: GoalFlowQueryDto,
  ) {
    return this.goalFlowService.getFlow(id, workspaceId, query.month);
  }

  /**
   * Whether the goal is reachable, and on what terms. Reads budget limits to
   * work out free cash flow, so it asks for both permissions.
   */
  @Get(':id/plan')
  @WorkspaceAuth(Permission.GOAL_VIEW, Permission.BUDGET_VIEW)
  async getPlan(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.goalPlanService.getPlan(id, workspaceId);
  }

  /** The goal's cost breakdown: what the move is made of, line by line. */
  @Get(':id/items')
  @WorkspaceAuth(Permission.GOAL_VIEW)
  async listItems(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.goalItemsService.list(id, workspaceId);
  }

  @Post(':id/items')
  @WorkspaceAuth(Permission.GOAL_EDIT)
  async createItem(
    @Param('id') id: string,
    @Body() itemDto: CreateGoalItemDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.goalItemsService.create(id, workspaceId, user.id, itemDto);
  }

  @Patch(':id/items/:itemId')
  @WorkspaceAuth(Permission.GOAL_EDIT)
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() itemDto: UpdateGoalItemDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.goalItemsService.update(id, itemId, workspaceId, user.id, itemDto);
  }

  @Delete(':id/items/:itemId')
  @WorkspaceAuth(Permission.GOAL_EDIT)
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.goalItemsService.remove(id, itemId, workspaceId, user.id);
  }

  /** Full replacement of the cover: one preset id, or one photo id, never both. */
  @Put(':id/cover')
  @WorkspaceAuth(Permission.GOAL_EDIT)
  @ApiOperation({ summary: "Set a goal's cover" })
  @ApiResponse({ status: 200, description: 'The goal, with its new cover' })
  @ApiResponse({ status: 400, description: 'Neither or both of preset and photoId were sent' })
  async setCover(
    @Param('id') id: string,
    @Body() coverDto: SetGoalCoverDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const goal = await this.goalCoversService.setCover(id, workspaceId, user.id, coverDto);
    return this.goalsService.findOne(goal.id, workspaceId);
  }

  @Delete(':id/cover')
  @WorkspaceAuth(Permission.GOAL_EDIT)
  @ApiOperation({ summary: "Remove a goal's cover" })
  @ApiResponse({ status: 200, description: 'The goal, with no cover' })
  async removeCover(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const goal = await this.goalCoversService.clearCover(id, workspaceId, user.id);
    return this.goalsService.findOne(goal.id, workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.GOAL_VIEW)
  async findOne(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.goalsService.findOne(id, workspaceId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.GOAL_EDIT)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateGoalDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.goalsService.update(id, workspaceId, user.id, updateDto);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.GOAL_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.goalsService.remove(id, workspaceId, user.id);
    return deletedResponse('Goal');
  }

  @Post(':id/contributions')
  @WorkspaceAuth(Permission.GOAL_EDIT)
  async addContribution(
    @Param('id') id: string,
    @Body() contributionDto: CreateContributionDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.goalsService.addContribution(id, workspaceId, user.id, contributionDto);
  }

  @Delete(':id/contributions/:contributionId')
  @WorkspaceAuth(Permission.GOAL_EDIT)
  async removeContribution(
    @Param('id') id: string,
    @Param('contributionId') contributionId: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.goalsService.removeContribution(id, contributionId, workspaceId, user.id);
  }
}
