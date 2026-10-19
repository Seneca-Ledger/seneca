import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { DailyQuote, InsightList } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InsightsService } from './insights.service';
import { DailyQuoteService } from './quotes/daily-quote.service';

@Controller('insights')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class InsightsController {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly dailyQuoteService: DailyQuoteService,
  ) {}

  @Get()
  @SchemaResponse(InsightList)
  async list(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('locale') locale?: string,
  ) {
    return this.insightsService.list({
      userId: user.id,
      workspaceId,
      category,
      limit: limit ? Number(limit) : 30,
      offset: offset ? Number(offset) : 0,
      locale,
    });
  }

  @Get('summary')
  async summary(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.insightsService.getSummary(user.id, workspaceId);
  }

  /**
   * A source-checked quote chosen for the user's current situation; changes
   * daily. `date` is the reader's own calendar day (YYYY-MM-DD) — the server's
   * clock may already be on another day.
   */
  @Get('daily-quote')
  @SchemaResponse(DailyQuote)
  async dailyQuote(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query('date') date?: string,
    @Query('locale') locale?: string,
  ) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
    const day = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
      : new Date();
    return this.dailyQuoteService.forUser(user.id, workspaceId, day, locale);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query('locale') locale?: string,
  ) {
    return this.insightsService.refresh(user.id, workspaceId, { locale });
  }

  @Post('dismiss-all')
  @HttpCode(HttpStatus.OK)
  async dismissAll(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query('category') category?: string,
  ) {
    return this.insightsService.dismissAll(user.id, workspaceId, category);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismiss(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.insightsService.dismiss(user.id, workspaceId, id);
  }
}
