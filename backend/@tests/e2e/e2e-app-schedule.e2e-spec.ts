import type { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppModule } from '../../src/app.module';
import { CustomTableExportSchedulesScheduler } from '../../src/modules/custom-tables/custom-table-export-schedules.scheduler';
import { e2eTestingModule } from './helpers/e2e-app';

/**
 * e2e apps start no cron jobs: a suite that crosses the hour would otherwise
 * have the hourly jobs change rows under it (the scheduled table export once
 * rewrote another workspace's schedule mid-sweep). The jobs' services are
 * still there for the suites that call them directly.
 */
describe('Cron jobs in e2e apps', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers none, while the scheduled services stay callable', () => {
    expect(app.get(SchedulerRegistry).getCronJobs().size).toBe(0);
    expect(typeof app.get(CustomTableExportSchedulesScheduler).runDueExports).toBe('function');
  });
});
