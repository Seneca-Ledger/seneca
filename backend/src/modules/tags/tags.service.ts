import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { CreateTagBody, UpdateTagBody } from '../../contracts';
import { Folder } from '../../entities/folder.entity';
import { Tag } from '../../entities/tag.entity';
import { TRANSACTION_TAG_PAIRS_SQL } from './transaction-tag-pairs.util';

/** A tag as the app reads it: no workspace or author bookkeeping. */
export type TagView = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  tagDate: string | null;
};

export type TagListItemView = TagView & { usageCount: number };

const toView = (tag: Tag): TagView => ({
  id: tag.id,
  name: tag.name,
  color: tag.color ?? null,
  description: tag.description ?? null,
  tagDate: tag.tagDate ?? null,
});

/**
 * The workspace's tag vocabulary, shared by statements, receipts and
 * transactions. Every lookup is by `{ id, workspaceId }`.
 */
@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  async list(workspaceId: string): Promise<TagView[]> {
    const tags = await this.tagRepository.find({
      where: { workspaceId },
      order: { name: 'ASC' },
    });
    return tags.map(toView);
  }

  /** The list with how many statements, receipts and transactions carry each tag. */
  async listWithUsage(workspaceId: string): Promise<TagListItemView[]> {
    const [tags, counts] = await Promise.all([
      this.list(workspaceId),
      this.usageCounts(workspaceId),
    ]);
    return tags.map(tag => ({ ...tag, usageCount: counts.get(tag.id) ?? 0 }));
  }

  /** Which tags each transaction carries, however it got them (see TRANSACTION_TAG_PAIRS_SQL). */
  async transactionLinks(
    workspaceId: string,
  ): Promise<Array<{ transactionId: string; tagId: string }>> {
    return this.tagRepository.manager
      .createQueryBuilder()
      .select('p.transaction_id', 'transactionId')
      .addSelect('p.tag_id', 'tagId')
      .from(`(${TRANSACTION_TAG_PAIRS_SQL})`, 'p')
      .setParameters({ workspaceId })
      .getRawMany();
  }

  async create(body: CreateTagBody, workspaceId: string): Promise<TagView> {
    const tag = this.tagRepository.create({
      name: this.requireName(body.name),
      color: body.color ?? null,
      description: this.cleanDescription(body.description),
      tagDate: body.tagDate ?? null,
      workspaceId,
    });
    return toView(await this.tagRepository.save(tag));
  }

  async update(tagId: string, body: UpdateTagBody, workspaceId: string): Promise<TagView> {
    const tag = await this.requireTag(tagId, workspaceId);
    // null leaves the NOT NULL name as it is; it clears the nullable fields.
    if (body.name != null) {
      tag.name = this.requireName(body.name);
    }
    if (body.color !== undefined) {
      tag.color = body.color ?? null;
    }
    if (body.description !== undefined) {
      tag.description = this.cleanDescription(body.description);
    }
    if (body.tagDate !== undefined) {
      tag.tagDate = body.tagDate ?? null;
    }
    return toView(await this.tagRepository.save(tag));
  }

  /** Folders filed under the tag lose it; the link rows go with the tag (ON DELETE CASCADE). */
  async remove(tagId: string, workspaceId: string): Promise<void> {
    const tag = await this.requireTag(tagId, workspaceId);
    await this.tagRepository.manager.transaction(async manager => {
      await manager.getRepository(Folder).update({ tagId, workspaceId }, { tagId: null });
      await manager.getRepository(Tag).delete({ id: tag.id, workspaceId });
    });
  }

  private async requireTag(tagId: string, workspaceId: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId, workspaceId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return tag;
  }

  private requireName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Tag name is required');
    }
    return trimmed;
  }

  private cleanDescription(description: string | null | undefined): string | null {
    const trimmed = description?.trim();
    return trimmed ? trimmed : null;
  }

  private async usageCounts(workspaceId: string): Promise<Map<string, number>> {
    const rows: Array<{ tagId: string; count: string }> = await this.tagRepository.query(
      `SELECT u.tag_id AS "tagId", COUNT(*) AS count
         FROM (
           SELECT tag_id FROM statement_tags
            WHERE tag_id IN (SELECT id FROM tags WHERE workspace_id = $1)
           UNION ALL
           SELECT tag_id FROM receipt_tags
            WHERE tag_id IN (SELECT id FROM tags WHERE workspace_id = $1)
           UNION ALL
           SELECT tag_id FROM transaction_tags
            WHERE tag_id IN (SELECT id FROM tags WHERE workspace_id = $1)
           UNION ALL
           SELECT pt.tag_id FROM payable_tags pt
             JOIN payables p ON p.id = pt.payable_id AND p.deleted_at IS NULL
            WHERE pt.tag_id IN (SELECT id FROM tags WHERE workspace_id = $1)
         ) u
        GROUP BY u.tag_id`,
      [workspaceId],
    );
    return new Map(rows.map(row => [row.tagId, Number(row.count)]));
  }
}
