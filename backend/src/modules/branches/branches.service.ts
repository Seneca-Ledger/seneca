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

  async create(workspaceId: string, createDto: CreateBranchBody): Promise<Branch> {
    const branch = this.repository.create({
      workspaceId,
      ...createDto,
      isActive: true,
    });

    return this.repository.save(branch);
  }
}
