import { BadGatewayException, BadRequestException, Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { appError } from '../../common/errors/app-error';
import { MapStyles } from '../../contracts';
import { MapTileParams } from '../../contracts/requests/maps';
import { MapsService } from './maps.service';

// No workspace scope: tiles carry no tenant data. The global JwtAuthGuard still
// requires a signed-in user, so this is not an open proxy.
@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('styles')
  @ApiOperation({ summary: 'Map styles offered by the self-hosted tile server' })
  @ApiResponse({
    status: 200,
    description: 'Empty list when no tile server is configured',
    schema: {
      example: {
        styles: [
          { id: 'osm-bright', name: 'OSM Bright' },
          { id: 'dark-matter', name: 'Dark Matter' },
        ],
        defaultStyleId: 'osm-bright',
      },
    },
  })
  @SchemaResponse(MapStyles)
  getStyles() {
    return this.mapsService.getStyles();
  }

  // Panning a map fires dozens of tile requests at once; the global limit is
  // sized for API calls, not for images.
  @Get('tiles/:styleId/:z/:x/:y')
  @SkipThrottle()
  @ApiOperation({ summary: 'Raster map tile (PNG)' })
  @ApiResponse({ status: 200, description: 'image/png' })
  @ApiResponse({ status: 400, description: 'Unknown style or tile outside the zoom grid' })
  @ApiResponse({ status: 502, description: 'Tile server unavailable' })
  async getTile(
    @SchemaParams(MapTileParams) { styleId, z, x, y }: MapTileParams,
    @Res() res: Response,
  ) {
    const tile = await this.mapsService.fetchTile(styleId, z, x, y);
    if (tile.status === 'invalid') {
      throw new BadRequestException(appError('MAPS_TILE_UNKNOWN'));
    }
    if (tile.status === 'unavailable') {
      throw new BadGatewayException(appError('MAPS_TILES_UNAVAILABLE'));
    }

    res.setHeader('Content-Type', tile.contentType);
    // private: the response sits behind the session cookie.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.send(tile.body);
  }
}
