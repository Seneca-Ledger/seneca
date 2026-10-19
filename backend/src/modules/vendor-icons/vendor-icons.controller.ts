import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { VendorIconsService } from './vendor-icons.service';

// No workspace scope: an icon carries no tenant data. The global JwtAuthGuard
// still requires a signed-in user, so this is not an open proxy.
@Controller('vendor-icons')
export class VendorIconsController {
  constructor(private readonly vendorIconsService: VendorIconsService) {}

  // A subscriptions table renders one icon per row, so a single page view fires
  // dozens of image requests; the global limit is sized for API calls.
  @Get(':domain')
  @SkipThrottle()
  @ApiOperation({ summary: 'Brand icon for a vendor domain' })
  @ApiResponse({ status: 200, description: 'A raster image' })
  @ApiResponse({ status: 400, description: 'Not a domain name' })
  @ApiResponse({ status: 404, description: 'No icon published for this domain' })
  @ApiResponse({ status: 502, description: 'Icon provider unavailable' })
  async getIcon(@Param('domain') domain: string, @Res() res: Response) {
    const icon = await this.vendorIconsService.fetchIcon(domain);
    if (icon.status === 'invalid') {
      throw new BadRequestException('Not a vendor domain');
    }
    // 404 rather than a placeholder: it fires the <img> error handler, which is
    // how the client falls back to initials.
    if (icon.status === 'missing') {
      throw new NotFoundException('No icon for this vendor');
    }
    if (icon.status === 'unavailable') {
      throw new BadGatewayException('Vendor icons are unavailable');
    }

    res.setHeader('Content-Type', icon.contentType);
    // private: the response sits behind the session cookie.
    res.setHeader('Cache-Control', 'private, max-age=604800');
    return res.send(icon.body);
  }
}
