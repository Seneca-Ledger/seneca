import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'seneca-backend',
    };
  }

  async getReadiness(): Promise<{
    status: 'ok' | 'error';
    checks: Record<string, 'ok' | 'error'>;
  }> {
    const checks: Record<string, 'ok' | 'error'> = {};

    try {
      await this.dataSource.query('SELECT 1');
      checks.db = 'ok';
    } catch {
      checks.db = 'error';
    }

    const status = Object.values(checks).every(v => v === 'ok') ? 'ok' : 'error';
    return { status, checks };
  }
}
