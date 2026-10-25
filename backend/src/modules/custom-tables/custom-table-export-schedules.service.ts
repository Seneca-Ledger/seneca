import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { sanitizeArchiveEntryName } from '../../common/utils/filename.util';
import { resolveInUploadsDir, resolveUploadsDir } from '../../common/utils/uploads.util';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import { CustomTable } from '../../entities/custom-table.entity';
import {
  CustomTableExportSchedule,
  ExportScheduleFormat,
} from '../../entities/custom-table-export-schedule.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { CustomTablesService } from './custom-tables.service';
import type {
  CustomTableRowFilterDto,
  CustomTableRowSortDto,
} from './dto/list-custom-table-rows.dto';

/**
 * Периодическая выгрузка таблицы в файл. Файл собирается тем же кодом, что и
 * ручной экспорт (T1.2), поэтому расписание и кнопка «Выгрузить» не могут
 * разойтись в том, что попадает в файл.
 */
@Injectable()
export class CustomTableExportSchedulesService {
  private readonly logger = new Logger(CustomTableExportSchedulesService.name);

  constructor(
    @InjectRepository(CustomTableExportSchedule)
    private readonly scheduleRepository: Repository<CustomTableExportSchedule>,
    @InjectRepository(CustomTable)
    private readonly tableRepository: Repository<CustomTable>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly customTablesService: CustomTablesService,
  ) {}

  private async ensureCanEditCustomTables(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditCustomTables',
      'TABLES_EDIT_FORBIDDEN',
    );
  }

  private async requireTable(workspaceId: string, tableId: string): Promise<CustomTable> {
    const table = await this.tableRepository
      .createQueryBuilder('table')
      .where('table.id = :tableId', { tableId })
      .andWhere('table.workspaceId = :workspaceId', { workspaceId })
      .getOne();
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }
    return table;
  }

  async createSchedule(
    userId: string,
    workspaceId: string,
    tableId: string,
    dto: {
      format?: ExportScheduleFormat;
      intervalHours?: number;
      viewConfig?: Record<string, unknown> | null;
    },
  ): Promise<CustomTableExportSchedule> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireTable(workspaceId, tableId);
    const intervalHours = Math.min(Math.max(dto.intervalHours ?? 168, 1), 24 * 31);

    const saved = await this.scheduleRepository.save(
      this.scheduleRepository.create({
        tableId,
        workspaceId,
        createdById: userId,
        format: dto.format ?? ExportScheduleFormat.XLSX,
        intervalHours,
        viewConfig: dto.viewConfig ?? null,
        enabled: true,
      }),
    );
    // Answer the stored row, as the list reads it: save() leaves unset columns undefined.
    return this.scheduleRepository.findOneByOrFail({ id: saved.id, workspaceId });
  }

  async listSchedules(workspaceId: string, tableId: string): Promise<CustomTableExportSchedule[]> {
    await this.requireTable(workspaceId, tableId);
    return this.scheduleRepository.find({
      where: { tableId, workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteSchedule(userId: string, workspaceId: string, scheduleId: string): Promise<void> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, workspaceId },
    });
    if (!schedule) {
      throw new NotFoundException(appError('SCHEDULE_NOT_FOUND'));
    }
    await this.scheduleRepository.delete({ id: scheduleId });
  }

  async findDueSchedules(now: Date = new Date()): Promise<CustomTableExportSchedule[]> {
    // A past version keeps its copied schedules but never runs them.
    const candidates = await this.scheduleRepository.find({
      where: { enabled: true, workspace: STANDARD_WORKSPACE },
      take: 50,
    });
    return candidates.filter(schedule => {
      if (!schedule.lastRunAt) {
        return true;
      }
      const intervalMs = Math.max(schedule.intervalHours || 168, 1) * 60 * 60 * 1000;
      return new Date(schedule.lastRunAt).getTime() + intervalMs <= now.getTime();
    });
  }

  async runSchedule(scheduleId: string): Promise<{ fileName: string; rows: number }> {
    const schedule = await this.scheduleRepository.findOne({ where: { id: scheduleId } });
    if (!schedule) {
      throw new NotFoundException(appError('SCHEDULE_NOT_FOUND'));
    }

    const view = (schedule.viewConfig ?? {}) as {
      filters?: CustomTableRowFilterDto[];
      sort?: CustomTableRowSortDto;
      columnKeys?: string[];
    };

    const { buffer, fileName } = await this.customTablesService.exportRows(
      schedule.workspaceId,
      schedule.tableId,
      {
        format: schedule.format === ExportScheduleFormat.CSV ? 'csv' : 'xlsx',
        filters: view.filters,
        sort: view.sort,
        columnKeys: view.columnKeys,
      },
    );

    const dir = this.exportsDir();
    await fs.promises.mkdir(dir, { recursive: true });
    // Имя со штампом времени: прошлые выгрузки не затираются, их можно сверить.
    const date = new Date().toISOString().slice(0, 10);
    // Пользователь видит имя из названия таблицы, но без пути и управляющих символов.
    const stamped = `${date}-${sanitizeArchiveEntryName(fileName)}`;
    // На диске — только id, дата и формат: название таблицы задаёт редактор,
    // и `../` в нём раньше уводил запись в любой каталог сервера.
    const filePath = path.join(dir, `${schedule.id}-${date}.${schedule.format}`);
    if (!resolveInUploadsDir(filePath, dir)) {
      throw new BadRequestException(appError('EXPORT_FILE_UNAVAILABLE'));
    }
    await fs.promises.writeFile(filePath, buffer);

    schedule.lastRunAt = new Date();
    schedule.lastError = null;
    schedule.lastFilePath = filePath;
    schedule.lastFileName = stamped;
    await this.scheduleRepository.save(schedule);

    this.logger.log(`Scheduled export ${schedule.id} written to ${filePath}`);
    return { fileName: stamped, rows: buffer.length };
  }

  private exportsDir(): string {
    return path.resolve(resolveUploadsDir(), 'scheduled-exports');
  }

  async recordFailure(scheduleId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.scheduleRepository.update(
      { id: scheduleId },
      { lastError: message.slice(0, 500), lastRunAt: new Date() },
    );
  }

  /** Отдаёт последний готовый файл владельцу воркспейса. */
  async readLastFile(
    workspaceId: string,
    scheduleId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, workspaceId },
    });
    if (!(schedule?.lastFilePath && schedule.lastFileName)) {
      throw new NotFoundException(appError('EXPORT_FILE_NOT_READY'));
    }
    // Строки, записанные до исправления, могли указывать за пределы каталога.
    const filePath = resolveInUploadsDir(schedule.lastFilePath, this.exportsDir());
    if (!filePath) {
      throw new BadRequestException(appError('EXPORT_FILE_UNAVAILABLE'));
    }
    try {
      const buffer = await fs.promises.readFile(filePath);
      return { buffer, fileName: sanitizeArchiveEntryName(schedule.lastFileName) };
    } catch {
      throw new BadRequestException(appError('EXPORT_FILE_UNAVAILABLE'));
    }
  }
}
