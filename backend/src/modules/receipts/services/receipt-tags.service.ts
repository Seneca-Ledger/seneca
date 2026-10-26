import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Receipt } from '../../../entities/receipt.entity';
import { Tag } from '../../../entities/tag.entity';

/** A receipt's tags, from the workspace's shared tag vocabulary. */
@Injectable()
export class ReceiptTagsService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  async getTags(receiptId: string, workspaceId: string): Promise<Tag[]> {
    const receipt = await this.loadReceipt(receiptId, workspaceId);
    return [...(receipt.tags ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Replaces the whole tag set: the payload is the desired end state, not a delta. */
  async setTags(receiptId: string, workspaceId: string, tagIds: readonly string[]): Promise<Tag[]> {
    const receipt = await this.loadReceipt(receiptId, workspaceId);
    const uniqueIds = [...new Set(tagIds)];
    const tags = uniqueIds.length
      ? await this.tagRepository.find({
          where: { id: In(uniqueIds), workspaceId },
          order: { name: 'ASC' },
        })
      : [];

    // A bad id and another workspace's tag are refused alike, never dropped
    // silently, so the caller never thinks a tag was applied.
    if (tags.length !== uniqueIds.length) {
      throw new BadRequestException('One or more tags do not exist in this workspace');
    }

    // Only the link rows change: saving the receipt would rewrite its columns.
    const current = new Set((receipt.tags ?? []).map(tag => tag.id));
    const wanted = new Set(uniqueIds);
    await this.receiptRepository
      .createQueryBuilder()
      .relation(Receipt, 'tags')
      .of(receipt.id)
      .addAndRemove(
        uniqueIds.filter(id => !current.has(id)),
        [...current].filter(id => !wanted.has(id)),
      );
    return tags;
  }

  private async loadReceipt(receiptId: string, workspaceId: string): Promise<Receipt> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId, workspaceId },
      relations: ['tags'],
    });
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    return receipt;
  }
}
