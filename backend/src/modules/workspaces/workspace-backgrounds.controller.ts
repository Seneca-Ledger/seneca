import { Controller, Get, Param, ParseUUIDPipe, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SchemaBody } from '../../common/effect/schema-body';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SetWorkspaceBackgroundBody } from '../../contracts';
import type { User } from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SearchBackgroundsDto } from './dto/search-backgrounds.dto';
import { WorkspaceBackgroundsService } from './workspace-backgrounds.service';

/**
 * Photo search for workspace backgrounds. The workspaces API takes its
 * workspace from the path rather than the x-workspace-id header, so these
 * follow it: search and preview carry no tenant data at all, and the save
 * checks membership in the service.
 */
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceBackgroundsController {
  constructor(private readonly backgroundsService: WorkspaceBackgroundsService) {}

  @Get('backgrounds/search')
  @ApiOperation({ summary: 'Search Openverse for a workspace background photo' })
  @ApiResponse({ status: 200, description: 'A page of results with their credit lines' })
  @ApiResponse({ status: 502, description: 'The image search did not answer' })
  @ApiResponse({ status: 503, description: 'The daily search allowance is used up' })
  search(@Query() query: SearchBackgroundsDto) {
    return this.backgroundsService.search(query.q, query.page ?? 1);
  }

  /** A result's thumbnail, proxied — an <img> cannot send headers anyway. */
  @Get('backgrounds/preview/:photoId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Thumbnail for a background search result' })
  @ApiResponse({ status: 200, description: 'A raster image' })
  @ApiResponse({ status: 404, description: 'No such image upstream' })
  async preview(@Param('photoId', ParseUUIDPipe) photoId: string, @Res() res: Response) {
    const image = await this.backgroundsService.getThumbnail(photoId);
    // private: the response sits behind the session cookie.
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(image.body);
  }

  @Put(':id/background')
  @ApiOperation({ summary: 'Use a searched photo as the workspace background' })
  @ApiResponse({ status: 200, description: 'The new background with its credit line' })
  @ApiResponse({ status: 403, description: 'Only owners and admins change workspace settings' })
  setPhoto(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @SchemaBody(SetWorkspaceBackgroundBody) dto: SetWorkspaceBackgroundBody,
  ) {
    return this.backgroundsService.setPhoto(id, user.id, dto.photoId);
  }
}
