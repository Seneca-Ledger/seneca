import { Controller, Get, Header, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { PublicInvoiceParams, PublicInvoiceView } from '../../contracts';
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
  @SchemaResponse(PublicInvoiceView)
  async view(@SchemaParams(PublicInvoiceParams) { token }: PublicInvoiceParams) {
    return this.publicInvoicesService.view(token);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token/pdf')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'no-store')
  async pdf(
    @SchemaParams(PublicInvoiceParams) { token }: PublicInvoiceParams,
    @Res() res: Response,
  ) {
    const { fileName, data } = await this.publicInvoicesService.pdf(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDisposition('inline', fileName));
    res.send(data);
  }
}
