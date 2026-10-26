import { Controller, ForbiddenException, Get, Headers, Res } from '@nestjs/common';
import type { Response } from 'express';
import { appError } from '../../common/errors/app-error';
import { secretsMatch } from '../../common/utils/secret-compare.util';
import { Public } from '../auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response, @Headers('authorization') authorization?: string) {
    const token = process.env.METRICS_AUTH_TOKEN;
    if (!token && process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(appError('OBSERVABILITY_METRICS_TOKEN_REQUIRED'));
    }
    if (token) {
      const expected = `Bearer ${token}`;
      if (!secretsMatch((authorization || '').trim(), expected)) {
        throw new ForbiddenException(appError('OBSERVABILITY_METRICS_TOKEN_INVALID'));
      }
    }

    res.setHeader('Content-Type', this.metricsService.contentType());
    res.send(await this.metricsService.metrics());
  }
}
