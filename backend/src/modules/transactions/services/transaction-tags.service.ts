import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Tag } from '../../../entities/tag.entity';
import { Transaction } from '../../../entities/transaction.entity';

@Injectable()
export class TransactionTagsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  async getTags(transactionId: string, workspaceId: string): Promise<Tag[]> {
    const transaction = await this.loadTransaction(transactionId, workspaceId);
    return transaction.tags ?? [];
  }

  /** Replaces the whole tag set — the payload is the desired end state, not a delta. */
  async setTags(transactionId: string, workspaceId: string, tagIds: string[]): Promise<Tag[]> {
    const transaction = await this.loadTransaction(transactionId, workspaceId);
    const uniqueIds = [...new Set(tagIds)];

    if (uniqueIds.length === 0) {
      transaction.tags = [];
      await this.transactionRepository.save(transaction);
      return [];
    }

    const tags = await this.tagRepository.find({
      where: { id: In(uniqueIds), workspaceId },
    });

    // Anything missing is either a bad id or another tenant's tag; both are refused
    // rather than silently dropped, so the caller never thinks a tag was applied.
    if (tags.length !== uniqueIds.length) {
      throw new BadRequestException('One or more tags do not exist in this workspace');
    }

    transaction.tags = tags;
    await this.transactionRepository.save(transaction);
    return tags;
  }

  private async loadTransaction(transactionId: string, workspaceId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, workspaceId },
      relations: {
        tags: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }
}
