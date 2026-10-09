import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { Public } from '../auth/decorators/public.decorator';
import { PublicInvoicesService } from './public-invoices.service';

/**
 * The invoice behind a share link.
 *
 * Its own controller because there is no JWT and no workspace context here —
 * the token in the url is the only thing granting access, exactly like the
 * public custom-table share.
 */
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly publicInvoicesService: PublicInvoicesService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'no-store')
  async view(@Param('token') token: string) {
    return this.publicInvoicesService.view(token);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token/pdf')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'no-store')
  async pdf(@Param('token') token: string, @Res() res: Response) {
    const { fileName, data } = await this.publicInvoicesService.pdf(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDisposition('inline', fileName));
    res.send(data);
  }
}
