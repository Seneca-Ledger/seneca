import { Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { Permission } from '../../common/enums/permissions.enum';
import { ApiKeyIdParams, CreateApiKeyBody } from '../../contracts';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GRANTABLE_SCOPES, groupScopes, SCOPE_PRESETS } from './api-key-scopes';
import { ApiKeysService } from './api-keys.service';

@ApiTags('API Keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @WorkspaceAuth(Permission.API_KEY_MANAGE)
  @ApiOperation({ summary: 'Create API key (returned only once)' })
  async create(
    @SchemaBody(CreateApiKeyBody) dto: CreateApiKeyBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.apiKeysService.generate(workspaceId, user.id, dto.name, {
      scopes: dto.scopes,
      expiresAt: dto.expiresAt,
    });
  }

  /** Every scope a key may carry, with the read-only and read-and-write presets. */
  @Get('scopes')
  @WorkspaceAuth(Permission.API_KEY_MANAGE)
  @ApiOperation({ summary: 'List grantable API key scopes and presets' })
  scopes() {
    return { all: GRANTABLE_SCOPES, groups: groupScopes(GRANTABLE_SCOPES), presets: SCOPE_PRESETS };
  }

  @Get()
  @WorkspaceAuth(Permission.API_KEY_MANAGE)
  @ApiOperation({ summary: 'List API keys (without secrets)' })
  async list(@WorkspaceId() workspaceId: string) {
    const keys = await this.apiKeysService.list(workspaceId);
    return keys.map(({ keyHash, ...rest }) => rest);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.API_KEY_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke API key' })
  async revoke(
    @SchemaParams(ApiKeyIdParams) { id }: ApiKeyIdParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.apiKeysService.revoke(id, workspaceId, user.id);
  }
}
