import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceCrudBaseService } from '../../common/services/workspace-crud-base.service';
import type { CreateBranchBody } from '../../contracts';
import { Branch } from '../../entities/branch.entity';

@Injectable()
export class BranchesService extends WorkspaceCrudBaseService<Branch> {
  constructor(
    @InjectRepository(Branch)
    repository: Repository<Branch>,
  ) {
    super(repository, 'Branch');
  }

  async create(workspaceId: string, userId: string, createDto: CreateBranchBody): Promise<Branch> {
    // branches.user_id is NOT NULL: without it every create failed with a 500.
    const branch = this.repository.create({
      workspaceId,
      userId,
      ...createDto,
      isActive: true,
    });

    return this.repository.save(branch);
  }
}
