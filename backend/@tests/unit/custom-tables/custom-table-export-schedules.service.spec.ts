import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExportScheduleFormat } from '../../../src/entities/custom-table-export-schedule.entity';
import { CustomTableExportSchedulesService } from '../../../src/modules/custom-tables/custom-table-export-schedules.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(async (v: unknown) => v),
  create: jest.fn((v?: unknown) => v),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const SCHEDULE_ID = '66666666-6666-4666-8666-666666666666';

function buildService(schedule?: Record<string, unknown>) {
  const scheduleRepository = createRepositoryMock();
  const tableRepository = createRepositoryMock();
  const workspaceMemberRepository = createRepositoryMock();

  tableRepository.createQueryBuilder.mockReturnValue({
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ id: TABLE_ID, name: 'Отчёт' }),
  });
  scheduleRepository.findOne.mockResolvedValue(
    schedule ?? {
      id: SCHEDULE_ID,
      tableId: TABLE_ID,
      workspaceId: 'ws-1',
      format: ExportScheduleFormat.XLSX,
      viewConfig: { columnKeys: ['a'] },
      intervalHours: 168,
    },
  );

  const customTablesService = {
    exportRows: jest.fn().mockResolvedValue({
      buffer: Buffer.from('file-bytes'),
      fileName: 'report.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  };

  const service = new CustomTableExportSchedulesService(
    scheduleRepository as never,
    tableRepository as never,
    workspaceMemberRepository as never,
    customTablesService as never,
  );

  return { service, scheduleRepository, workspaceMemberRepository, customTablesService };
}

describe('CustomTableExportSchedulesService', () => {
  const tmp = path.join(os.tmpdir(), `seneca-sched-${Date.now()}`);

  beforeAll(() => {
    process.env.UPLOADS_DIR = tmp;
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('refuses schedule changes for a member without edit permission', async () => {
    const { service, workspaceMemberRepository } = buildService();
    workspaceMemberRepository.findOne.mockResolvedValue({
      role: 'member',
      permissions: { canEditCustomTables: false },
    });

    await expect(service.createSchedule('u1', 'ws-1', TABLE_ID, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.deleteSchedule('u1', 'ws-1', SCHEDULE_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('builds the file through the same export path as the manual button', async () => {
    const { service, customTablesService } = buildService();

    await service.runSchedule(SCHEDULE_ID);

    // Расписание и ручной экспорт обязаны давать одинаковое содержимое.
    expect(customTablesService.exportRows).toHaveBeenCalledWith(
      'ws-1',
      TABLE_ID,
      expect.objectContaining({ format: 'xlsx', columnKeys: ['a'] }),
    );
  });

  it('writes the file and remembers where it is', async () => {
    const { service, scheduleRepository } = buildService();

    const result = await service.runSchedule(SCHEDULE_ID);

    expect(result.fileName).toContain('.xlsx');
    const saved = scheduleRepository.save.mock.calls.at(-1)?.[0] as { lastFilePath: string };
    expect(fs.existsSync(saved.lastFilePath)).toBe(true);
  });

  it('stamps the file name with a date so past runs are not overwritten', async () => {
    const { service } = buildService();

    const result = await service.runSchedule(SCHEDULE_ID);

    expect(result.fileName).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('selects only schedules whose interval has elapsed', async () => {
    const { service, scheduleRepository } = buildService();
    const now = new Date('2026-03-08T12:00:00Z');
    scheduleRepository.find.mockResolvedValue([
      { id: 'never', intervalHours: 168, lastRunAt: null },
      { id: 'due', intervalHours: 1, lastRunAt: new Date('2026-03-08T10:00:00Z') },
      { id: 'not-due', intervalHours: 168, lastRunAt: new Date('2026-03-07T12:00:00Z') },
    ]);

    const due = await service.findDueSchedules(now);

    expect(due.map(s => s.id)).toEqual(['never', 'due']);
  });

  it('records a failure so one broken schedule does not stop the rest', async () => {
    const { service, scheduleRepository } = buildService();

    await service.recordFailure(SCHEDULE_ID, new Error('disk full'));

    expect(scheduleRepository.update).toHaveBeenCalledWith(
      { id: SCHEDULE_ID },
      expect.objectContaining({ lastError: 'disk full' }),
    );
  });

  it('refuses to hand out a file that was never produced', async () => {
    const { service } = buildService({
      id: SCHEDULE_ID,
      workspaceId: 'ws-1',
      lastFilePath: null,
      lastFileName: null,
    });

    await expect(service.readLastFile('ws-1', SCHEDULE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
