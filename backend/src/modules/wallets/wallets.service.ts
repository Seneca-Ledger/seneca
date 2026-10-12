import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceCrudBaseService } from '../../common/services/workspace-crud-base.service';
import { assertOwnerMemberInWorkspace } from '../../common/utils/transaction-owner.util';
import type { CreateWalletBody, UpdateWalletBody } from '../../contracts';
import { Wallet } from '../../entities/wallet.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';

@Injectable()
export class WalletsService extends WorkspaceCrudBaseService<Wallet> {
  constructor(
    @InjectRepository(Wallet)
    repository: Repository<Wallet>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {
    super(repository, 'Wallet');
  }

  async create(workspaceId: string, userId: string, createDto: CreateWalletBody): Promise<Wallet> {
    await assertOwnerMemberInWorkspace(
      this.workspaceMemberRepository,
      workspaceId,
      createDto.ownerMemberId,
    );

    // wallets.user_id is NOT NULL: without it every create failed with a 500.
    const wallet = this.repository.create({
      workspaceId,
      userId,
      ...createDto,
      currency: await this.workspaceCurrency.resolveFor(workspaceId, createDto.currency),
      initialBalance: createDto.initialBalance || 0,
      isActive: true,
    });

    return this.repository.save(wallet);
  }

  override async update(id: string, workspaceId: string, dto: UpdateWalletBody): Promise<Wallet> {
    await assertOwnerMemberInWorkspace(
      this.workspaceMemberRepository,
      workspaceId,
      dto.ownerMemberId,
    );
    return super.update(id, workspaceId, dto);
  }
}
