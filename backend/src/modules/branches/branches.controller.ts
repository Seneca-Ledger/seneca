import { Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import { BranchList, BranchParams, CreateBranchBody, UpdateBranchBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BranchesService } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @WorkspaceAuth(Permission.BRANCH_CREATE)
  async create(
    @SchemaBody(CreateBranchBody) createDto: CreateBranchBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.branchesService.create(workspaceId, user.id, createDto);
  }

  @Get()
  @WorkspaceAuth(Permission.BRANCH_VIEW)
  @SchemaResponse(BranchList)
  async findAll(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.branchesService.findAll(workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.BRANCH_VIEW)
  async findOne(
    @SchemaParams(BranchParams) { id }: BranchParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.branchesService.findOne(id, workspaceId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.BRANCH_EDIT)
  async update(
    @SchemaParams(BranchParams) { id }: BranchParams,
    @SchemaBody(UpdateBranchBody) updateDto: UpdateBranchBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.branchesService.update(id, workspaceId, updateDto);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.BRANCH_DELETE)
  async remove(
    @SchemaParams(BranchParams) { id }: BranchParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.branchesService.remove(id, workspaceId);
    return deletedResponse('Branch');
  }
}
