import { Controller, Delete, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  ImportMappingProfile,
  ImportMappingProfileMatch,
  ImportMappingProfileParams,
  MatchImportMappingBody,
  OkResult,
  SaveImportMappingBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ImportMappingProfilesService } from './import-mapping-profiles.service';

/**
 * Column roles the import wizard remembers per header row. Writing checks the
 * same permission as importing into the target; reading needs only the workspace.
 */
@Controller('entity-imports/mapping-profiles')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class ImportMappingProfilesController {
  constructor(private readonly profiles: ImportMappingProfilesService) {}

  @Post('match')
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(ImportMappingProfileMatch)
  match(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(MatchImportMappingBody) body: MatchImportMappingBody,
  ) {
    return this.profiles.match(workspaceId, body);
  }

  @Put()
  @SchemaResponse(ImportMappingProfile)
  save(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveImportMappingBody) body: SaveImportMappingBody,
  ) {
    return this.profiles.save(user.id, workspaceId, body);
  }

  @Delete(':id')
  @SchemaResponse(OkResult)
  remove(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(ImportMappingProfileParams) { id }: ImportMappingProfileParams,
  ) {
    return this.profiles.remove(user.id, workspaceId, id);
  }
}
