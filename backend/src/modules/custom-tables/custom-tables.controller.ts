import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  AddSourceStatementsBody,
  BatchCreateCustomTableRowsBody,
  ClassifyPaidStatusBody,
  CreateCustomTableBody,
  CreateCustomTableColumnBody,
  CreateCustomTableFromDataEntryBody,
  CreateCustomTableFromDataEntryCustomTabBody,
  CreateCustomTableFromSourceBody,
  CreateCustomTableRowBody,
  CreatedCustomTable,
  CreatedFromSource,
  CustomTableAggregates,
  CustomTableColumnItem,
  CustomTableDetail,
  CustomTableGroups,
  CustomTableList,
  CustomTableRowBatch,
  CustomTableRowItem,
  CustomTableRowPage,
  CustomTableSummaries,
  FormulaPreview,
  PreviewCustomTableSourceBody,
  PreviewFormulaBody,
  RefreshedFromSource,
  ReorderCustomTableColumnsBody,
  SourcePreview,
  UpdateCustomTableBody,
  UpdateCustomTableColumnBody,
  UpdateCustomTableColumnStyleBody,
  UpdateCustomTableRowBody,
  UpdateCustomTableRulesBody,
  UpdateCustomTableSummariesBody,
  UpdateCustomTableViewSettingsColumnBody,
  UpdateCustomTableViewsBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CustomTablesService } from './custom-tables.service';
import { CustomTablesCacheService } from './custom-tables-cache.service';
import {
  CUSTOM_TABLE_AGGREGATE_FNS,
  type CustomTableAggregateDto,
  type CustomTableAggregateFn,
  CustomTableRowFilterDto,
  CustomTableRowSortDto,
} from './dto/list-custom-table-rows.dto';

function parseRowFiltersParam(filtersRaw?: string): CustomTableRowFilterDto[] | undefined {
  if (!filtersRaw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(filtersRaw);
  } catch {
    throw new BadRequestException(appError('FILTER_JSON_INVALID'));
  }
  if (!Array.isArray(parsed)) {
    throw new BadRequestException(appError('FILTER_FORMAT_INVALID'));
  }
  return parsed as CustomTableRowFilterDto[];
}

function parseAggregatesParam(aggsRaw?: string): CustomTableAggregateDto[] {
  if (!aggsRaw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(aggsRaw);
  } catch {
    throw new BadRequestException(appError('AGG_JSON_INVALID'));
  }
  if (!Array.isArray(parsed)) {
    throw new BadRequestException(appError('AGG_FORMAT_INVALID'));
  }
  return parsed.map(entry => {
    const { col, fn } = (entry ?? {}) as { col?: unknown; fn?: unknown };
    if (typeof col !== 'string' || !col.trim()) {
      throw new BadRequestException(appError('AGG_FORMAT_INVALID'));
    }
    if (
      typeof fn !== 'string' ||
      !CUSTOM_TABLE_AGGREGATE_FNS.includes(fn as CustomTableAggregateFn)
    ) {
      throw new BadRequestException(appError('AGG_FUNCTION_UNKNOWN', { fn: String(fn) }));
    }
    return { col: col.trim(), fn: fn as CustomTableAggregateFn };
  });
}

function parseRowSortParam(sortRaw?: string): CustomTableRowSortDto | undefined {
  if (!sortRaw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(sortRaw);
  } catch {
    throw new BadRequestException(appError('SORT_JSON_INVALID'));
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException(appError('SORT_FORMAT_INVALID'));
  }
  const { col, dir } = parsed as { col?: unknown; dir?: unknown };
  if (typeof col !== 'string' || !col.trim()) {
    throw new BadRequestException(appError('SORT_FORMAT_INVALID'));
  }
  if (dir !== 'asc' && dir !== 'desc') {
    throw new BadRequestException(appError('SORT_DIRECTION_INVALID'));
  }
  return { col: col.trim(), dir };
}

@Controller('custom-tables')
@UseGuards(JwtAuthGuard)
export class CustomTablesController {
  constructor(
    private readonly customTablesService: CustomTablesService,
    private readonly customTablesCache: CustomTablesCacheService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CreatedCustomTable)
  async createTable(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateCustomTableBody) dto: CreateCustomTableBody,
  ) {
    const table = await this.customTablesService.createTable(user.id, workspaceId, dto);
    await this.customTablesCache.bumpList(workspaceId);
    return table;
  }

  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableList)
  async listTables(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    const cacheKey = await this.customTablesCache.listKey(workspaceId);
    return this.customTablesCache.getOrSet(cacheKey, async () => {
      const items = await this.customTablesService.listTables(workspaceId);
      return { items };
    });
  }

  @Post('from-data-entry')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async createFromDataEntry(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateCustomTableFromDataEntryBody) dto: CreateCustomTableFromDataEntryBody,
  ) {
    const table = await this.customTablesService.createFromDataEntry(user.id, workspaceId, dto);
    await this.customTablesCache.bumpList(workspaceId);
    return table;
  }

  @Post('from-data-entry-custom-tab')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async createFromDataEntryCustomTab(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateCustomTableFromDataEntryCustomTabBody)
    dto: CreateCustomTableFromDataEntryCustomTabBody,
  ) {
    const table = await this.customTablesService.createFromDataEntryCustomTab(
      user.id,
      workspaceId,
      dto,
    );
    await this.customTablesCache.bumpList(workspaceId);
    return table;
  }

  @Post(':id/sync-from-data-entry')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async syncFromDataEntry(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const table = await this.customTablesService.syncFromDataEntry(user.id, workspaceId, id);
    await this.customTablesCache.bumpTable(workspaceId, id);
    await this.customTablesCache.bumpRows(workspaceId, id);
    return table;
  }

  @Post('source-preview')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(SourcePreview)
  async previewSource(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(PreviewCustomTableSourceBody) dto: PreviewCustomTableSourceBody,
  ) {
    return this.customTablesService.previewSource(user.id, workspaceId, dto);
  }

  @Post('from-source')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CreatedFromSource)
  async createFromSource(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateCustomTableFromSourceBody) dto: CreateCustomTableFromSourceBody,
  ) {
    const table = await this.customTablesService.createFromSource(user.id, workspaceId, dto);
    await this.customTablesCache.bumpList(workspaceId);
    return table;
  }

  @Post(':id/refresh-from-source')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(RefreshedFromSource)
  async refreshFromSource(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.customTablesService.refreshFromSource(user.id, workspaceId, id);
    await this.customTablesCache.bumpTable(workspaceId, id);
    await this.customTablesCache.bumpRows(workspaceId, id);
    await this.customTablesCache.bumpList(workspaceId);
    return result;
  }

  @Post(':id/source-statements')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(RefreshedFromSource)
  async addSourceStatements(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(AddSourceStatementsBody) dto: AddSourceStatementsBody,
  ) {
    const result = await this.customTablesService.addSourceStatements(
      user.id,
      workspaceId,
      id,
      dto.statementIds,
    );
    await this.customTablesCache.bumpTable(workspaceId, id);
    await this.customTablesCache.bumpRows(workspaceId, id);
    await this.customTablesCache.bumpList(workspaceId);
    return result;
  }

  /**
   * "Restore to default": undoes the app record changes made from this table,
   * then rebuilds it as a fresh copy of its source. Idempotent.
   */
  @Post(':id/restore-default')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async restoreDefault(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.customTablesService.restoreDefault(user.id, workspaceId, id);
    await this.customTablesCache.bumpTable(workspaceId, id);
    await this.customTablesCache.bumpRows(workspaceId, id);
    await this.customTablesCache.bumpList(workspaceId);
    return result;
  }

  @Post(':id/formula-preview')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(FormulaPreview)
  async previewFormula(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(PreviewFormulaBody) dto: PreviewFormulaBody,
  ) {
    return this.customTablesService.previewFormula(user.id, workspaceId, id, dto);
  }

  @Get(':id/summaries')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableSummaries)
  async getSummaries(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customTablesService.getSummaries(workspaceId, id);
  }

  @Patch(':id/view-settings/summaries')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async updateViewSettingsSummaries(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(UpdateCustomTableSummariesBody) dto: UpdateCustomTableSummariesBody,
  ) {
    const table = await this.customTablesService.updateViewSettingsSummaries(
      user.id,
      workspaceId,
      id,
      dto,
    );
    await this.customTablesCache.bumpTable(workspaceId, id);
    return table;
  }

  @Post(':id/convert-to-statement')
  @WorkspaceAuth(Permission.STATEMENT_UPLOAD, Permission.STATEMENT_EDIT)
  async convertToStatement(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customTablesService.convertToStatement(user.id, workspaceId, id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableDetail)
  async getTable(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const cacheKey = await this.customTablesCache.tableKey(workspaceId, id);
    return this.customTablesCache.getOrSet(cacheKey, async () => {
      const table = await this.customTablesService.getTable(workspaceId, id);
      return table;
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  // The saved table carries its owner's user row: the contract keeps it out.
  @SchemaResponse(CreatedCustomTable)
  async updateTable(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(UpdateCustomTableBody) dto: UpdateCustomTableBody,
  ) {
    const table = await this.customTablesService.updateTable(user.id, workspaceId, id, dto);
    await this.customTablesCache.bumpTable(workspaceId, id);
    await this.customTablesCache.bumpList(workspaceId);
    return table;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async removeTable(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.customTablesService.removeTable(user.id, workspaceId, id);
    await this.customTablesCache.bumpList(workspaceId);
    return { ok: true };
  }

  @Post(':id/columns')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableColumnItem)
  async addColumn(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @SchemaBody(CreateCustomTableColumnBody) dto: CreateCustomTableColumnBody,
  ) {
    const column = await this.customTablesService.addColumn(user.id, workspaceId, tableId, dto);
    await this.customTablesCache.bumpTable(workspaceId, tableId);
    await this.customTablesCache.bumpRows(workspaceId, tableId);
    return column;
  }

  @Patch(':id/columns/:columnId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async updateColumn(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Param('columnId', new ParseUUIDPipe()) columnId: string,
    @SchemaBody(UpdateCustomTableColumnBody) dto: UpdateCustomTableColumnBody,
  ) {
    const column = await this.customTablesService.updateColumn(
      user.id,
      workspaceId,
      tableId,
      columnId,
      dto,
    );
    await this.customTablesCache.bumpTable(workspaceId, tableId);
    await this.customTablesCache.bumpRows(workspaceId, tableId);
    return column;
  }

  @Patch(':id/columns/:columnId/style')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async updateColumnStyle(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Param('columnId', new ParseUUIDPipe()) columnId: string,
    @SchemaBody(UpdateCustomTableColumnStyleBody) dto: UpdateCustomTableColumnStyleBody,
  ) {
    const result = await this.customTablesService.updateColumnStyle(
      user.id,
      workspaceId,
      tableId,
      columnId,
      dto,
    );
    await this.customTablesCache.bumpTable(workspaceId, tableId);
    return result;
  }

  @Delete(':id/columns/:columnId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async removeColumn(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Param('columnId', new ParseUUIDPipe()) columnId: string,
  ) {
    await this.customTablesService.removeColumn(user.id, workspaceId, tableId, columnId);
    await this.customTablesCache.bumpTable(workspaceId, tableId);
    await this.customTablesCache.bumpRows(workspaceId, tableId);
    return { ok: true };
  }

  @Post(':id/columns/reorder')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async reorderColumns(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @SchemaBody(ReorderCustomTableColumnsBody) dto: ReorderCustomTableColumnsBody,
  ) {
    await this.customTablesService.reorderColumns(user.id, workspaceId, tableId, dto);
    await this.customTablesCache.bumpTable(workspaceId, tableId);
    return { ok: true };
  }

  @Get(':id/relation-options')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async listRelationOptions(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Query('column') column?: string,
    @Query('search') search?: string,
  ) {
    if (!column?.trim()) {
      throw new BadRequestException(appError('RELATION_COLUMN_REQUIRED'));
    }
    return this.customTablesService.listRelationOptions(
      workspaceId,
      tableId,
      column.trim(),
      search,
    );
  }

  @Get(':id/duplicates')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async findDuplicates(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Query('keys') keysRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const keys = (keysRaw ?? '')
      .split(',')
      .map(key => key.trim())
      .filter(Boolean);
    if (!keys.length) {
      throw new BadRequestException(appError('DUPLICATE_KEY_COLUMNS_REQUIRED'));
    }
    const limitNumber = limitRaw ? Number(limitRaw) : undefined;
    const { items, groupCount } = await this.customTablesService.findDuplicateRows(
      workspaceId,
      tableId,
      { keys, limit: Number.isFinite(limitNumber) ? limitNumber : undefined },
    );
    return { items, meta: { groupCount } };
  }

  @Get(':id/groups')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableGroups)
  async groupRows(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Query('groupBy') groupBy?: string,
    @Query('aggs') aggsRaw?: string,
    @Query('filters') filtersRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    if (!groupBy?.trim()) {
      throw new BadRequestException(appError('GROUP_COLUMN_REQUIRED'));
    }
    const aggs = parseAggregatesParam(aggsRaw);
    const filters = parseRowFiltersParam(filtersRaw);
    const limitNumber = limitRaw ? Number(limitRaw) : undefined;
    const queryParams = {
      groupBy: groupBy.trim(),
      aggs,
      filters,
      limit: Number.isFinite(limitNumber) ? limitNumber : undefined,
    };
    const cacheKey = await this.customTablesCache.rowsKey(workspaceId, tableId, queryParams);
    return this.customTablesCache.getOrSet(cacheKey, async () => {
      const { items, groupCount } = await this.customTablesService.groupRows(
        workspaceId,
        tableId,
        queryParams,
      );
      return { items, meta: { groupCount } };
    });
  }

  @Get(':id/aggregates')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableAggregates)
  async aggregateRows(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Query('aggs') aggsRaw?: string,
    @Query('filters') filtersRaw?: string,
  ) {
    const aggs = parseAggregatesParam(aggsRaw);
    const filters = parseRowFiltersParam(filtersRaw);
    const cacheKey = await this.customTablesCache.rowsKey(workspaceId, tableId, {
      aggs,
      filters,
    });
    return this.customTablesCache.getOrSet(cacheKey, async () => {
      const { items, total } = await this.customTablesService.aggregateRows(workspaceId, tableId, {
        filters,
        aggs,
      });
      return { items, meta: { total } };
    });
  }

  @Get(':id/export')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async exportRows(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Res() res: Response,
    @Query('format') formatRaw?: string,
    @Query('filters') filtersRaw?: string,
    @Query('sort') sortRaw?: string,
    @Query('columns') columnsRaw?: string,
  ) {
    const format = formatRaw === 'csv' ? 'csv' : 'xlsx';
    const columnKeys = columnsRaw
      ? columnsRaw
          .split(',')
          .map(key => key.trim())
          .filter(Boolean)
      : undefined;

    const { buffer, fileName, contentType } = await this.customTablesService.exportRows(
      workspaceId,
      tableId,
      {
        format,
        filters: parseRowFiltersParam(filtersRaw),
        sort: parseRowSortParam(sortRaw),
        columnKeys,
      },
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  @Get(':id/rows')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableRowPage)
  async listRows(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('filters') filtersRaw?: string,
    // Новые параметры идут в конец: позиционный порядок прежних сохраняется.
    @Query('sort') sortRaw?: string,
    @Query('offset') offset?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit ?? 50, 1), 500);
    const cursorNumber = cursor ? Number(cursor) : undefined;
    const offsetNumber = offset ? Number(offset) : undefined;
    const filters = parseRowFiltersParam(filtersRaw);
    const sort = parseRowSortParam(sortRaw);
    const queryParams = {
      cursor: Number.isFinite(cursorNumber) ? cursorNumber : undefined,
      offset:
        Number.isFinite(offsetNumber) && (offsetNumber as number) >= 0 ? offsetNumber : undefined,
      limit: safeLimit,
      filters,
      sort,
    };
    const cacheKey = await this.customTablesCache.rowsKey(workspaceId, tableId, queryParams);
    return this.customTablesCache.getOrSet(cacheKey, async () => {
      const { items, total } = await this.customTablesService.listRows(
        workspaceId,
        tableId,
        queryParams,
      );
      return { items, meta: { total } };
    });
  }

  @Post(':id/rows/paid-classify')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async classifyPaidStatus(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @SchemaBody(ClassifyPaidStatusBody) dto: ClassifyPaidStatusBody,
  ) {
    return this.customTablesService.classifyPaidStatus(workspaceId, tableId, dto);
  }

  @Post(':id/rows')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableRowItem)
  async createRow(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @SchemaBody(CreateCustomTableRowBody) dto: CreateCustomTableRowBody,
  ) {
    const row = await this.customTablesService.createRow(user.id, workspaceId, tableId, dto);
    await this.customTablesCache.bumpRows(workspaceId, tableId);
    return row;
  }

  @Patch(':id/rows/:rowId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableRowItem)
  async updateRow(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Param('rowId', new ParseUUIDPipe()) rowId: string,
    @SchemaBody(UpdateCustomTableRowBody) dto: UpdateCustomTableRowBody,
  ) {
    const row = await this.customTablesService.updateRow(user.id, workspaceId, tableId, rowId, dto);
    await this.customTablesCache.bumpRows(workspaceId, tableId);
    return row;
  }

  @Delete(':id/rows/:rowId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async removeRow(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @Param('rowId', new ParseUUIDPipe()) rowId: string,
  ) {
    await this.customTablesService.removeRow(user.id, workspaceId, tableId, rowId);
    await this.customTablesCache.bumpRows(workspaceId, tableId);
    return { ok: true };
  }

  @Post(':id/rows/batch')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableRowBatch)
  async batchCreateRows(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @SchemaBody(BatchCreateCustomTableRowsBody) dto: BatchCreateCustomTableRowsBody,
  ) {
    const result = await this.customTablesService.batchCreateRows(
      user.id,
      workspaceId,
      tableId,
      dto,
    );
    await this.customTablesCache.bumpRows(workspaceId, tableId);
    return { ok: true, ...result };
  }

  @Patch(':id/view-settings/rules')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async updateViewSettingsRules(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @SchemaBody(UpdateCustomTableRulesBody) dto: UpdateCustomTableRulesBody,
  ) {
    const table = await this.customTablesService.updateViewSettingsRules(
      user.id,
      workspaceId,
      tableId,
      dto.rules,
    );
    await this.customTablesCache.bumpTable(workspaceId, tableId);
    return table;
  }

  @Patch(':id/view-settings/views')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async updateViewSettingsViews(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @SchemaBody(UpdateCustomTableViewsBody) dto: UpdateCustomTableViewsBody,
  ) {
    const table = await this.customTablesService.updateViewSettingsViews(
      user.id,
      workspaceId,
      tableId,
      dto,
    );
    await this.customTablesCache.bumpTable(workspaceId, tableId);
    return table;
  }

  @Patch(':id/view-settings/columns')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async updateViewSettingsColumn(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
    @SchemaBody(UpdateCustomTableViewSettingsColumnBody)
    dto: UpdateCustomTableViewSettingsColumnBody,
  ) {
    const table = await this.customTablesService.updateViewSettingsColumn(
      user.id,
      workspaceId,
      tableId,
      dto,
    );
    await this.customTablesCache.bumpTable(workspaceId, tableId);
    return table;
  }
}
