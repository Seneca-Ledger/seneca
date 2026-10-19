jest.mock('franc', () => ({
  franc: () => 'und',
}));

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { resolveUploadsDir } from '../../src/common/utils/uploads.util';
import { CustomTableExportSchedulesService } from '../../src/modules/custom-tables/custom-table-export-schedules.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A scheduled table export is written by the hourly job under
 * uploads/scheduled-exports. The table's name used to be part of the stored
 * path, so a name with `../` in it let any table editor write a file anywhere
 * the server could. The job is run directly here rather than waiting for cron.
 */
describe('Scheduled custom table export path (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let schedules: CustomTableExportSchedulesService;
  let owner: E2eAccount;
  const email = 'ct-export-path-owner@example.com';
  const marker = `escaped-${Date.now()}`;
  const tableName = `x/../../${marker}`;
  const exportsDir = path.resolve(resolveUploadsDir(), 'scheduled-exports');
  const escapedFile = path.join(resolveUploadsDir(), `${marker}.csv`);

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    schedules = moduleFixture.get(CustomTableExportSchedulesService);

    await deleteUserByEmail(dataSource, email);
    owner = await registerAccount(app, email, 'Export Path Owner');
  });

  afterAll(async () => {
    if (dataSource && owner) {
      const rows: Array<{ last_file_path: string | null }> = await dataSource.query(
        'SELECT last_file_path FROM custom_table_export_schedules WHERE workspace_id = $1',
        [owner.workspaceId],
      );
      for (const row of rows) {
        if (row.last_file_path) {
          fs.rmSync(row.last_file_path, { force: true });
        }
      }
      await dataSource.query('DELETE FROM custom_table_export_schedules WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      await dataSource.query('DELETE FROM custom_tables WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      await deleteUserByEmail(dataSource, email);
    }
    fs.rmSync(escapedFile, { force: true });
    await app.close();
  });

  it('writes inside the export directory whatever the table is called', async () => {
    const server = app.getHttpServer();
    const table = await as(request(server).post('/custom-tables'))
      .send({ name: tableName })
      .expect(201);
    const column = await as(request(server).post(`/custom-tables/${table.body.id}/columns`))
      .send({ title: 'Note', type: 'text' })
      .expect(201);
    await as(request(server).post(`/custom-tables/${table.body.id}/rows`))
      .send({ data: { [column.body.key]: 'payload' } })
      .expect(201);
    const schedule = await as(
      request(server).post(`/custom-tables/${table.body.id}/export-schedules`),
    )
      .send({ format: 'csv', intervalHours: 1 })
      .expect(201);

    await schedules.runSchedule(schedule.body.id);

    expect(fs.existsSync(escapedFile)).toBe(false);
    const [stored] = await dataSource.query(
      'SELECT last_file_path, last_file_name FROM custom_table_export_schedules WHERE id = $1',
      [schedule.body.id],
    );
    expect(path.dirname(path.resolve(stored.last_file_path))).toBe(exportsDir);
    expect(fs.readFileSync(stored.last_file_path, 'utf-8')).toContain('payload');

    // The download keeps a name from the table, with no path in it.
    const file = await as(
      request(server).get(
        `/custom-tables/${table.body.id}/export-schedules/${schedule.body.id}/file`,
      ),
    ).expect(200);
    const disposition = decodeURIComponent(String(file.headers['content-disposition']));
    expect(disposition).toContain(`${marker}.csv`);
    expect(disposition).not.toContain('/');
    expect(file.text).toContain('payload');
  });
});
