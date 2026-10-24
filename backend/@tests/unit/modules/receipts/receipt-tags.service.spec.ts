import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { ReceiptTagsService } from '@/modules/receipts/services/receipt-tags.service';

const tag = (id: string, name: string) => ({ id, name, workspaceId: 'ws-1' });

function build(receipt: unknown) {
  const relationQb = {
    relation: jest.fn(),
    of: jest.fn(),
    addAndRemove: jest.fn().mockResolvedValue(undefined),
  };
  relationQb.relation.mockReturnValue(relationQb);
  relationQb.of.mockReturnValue(relationQb);
  const receiptRepo = {
    findOne: jest.fn().mockResolvedValue(receipt),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(relationQb),
  };
  const tagRepo = { find: jest.fn() };
  return {
    service: new ReceiptTagsService(receiptRepo as never, tagRepo as never),
    receiptRepo,
    tagRepo,
    relationQb,
  };
}

describe('ReceiptTagsService', () => {
  it("reads a receipt's tags sorted by name, scoped to the workspace", async () => {
    const { service, receiptRepo } = build({
      id: 'r-1',
      tags: [tag('t-2', 'Work'), tag('t-1', 'Almaty')],
    });

    const tags = await service.getTags('r-1', 'ws-1');

    expect(tags.map(t => t.name)).toEqual(['Almaty', 'Work']);
    expect(receiptRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'r-1', workspaceId: 'ws-1' },
      relations: ['tags'],
    });
  });

  it('refuses a receipt outside the workspace', async () => {
    const { service, tagRepo } = build(null);
    await expect(service.getTags('r-1', 'ws-2')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setTags('r-1', 'ws-2', ['t-1'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tagRepo.find).not.toHaveBeenCalled();
  });

  it('replaces the tag set by changing only the link rows', async () => {
    const { service, receiptRepo, tagRepo, relationQb } = build({
      id: 'r-1',
      tags: [tag('t-1', 'Almaty'), tag('t-2', 'Work')],
    });
    tagRepo.find.mockResolvedValue([tag('t-2', 'Work'), tag('t-3', 'Trip')]);

    const result = await service.setTags('r-1', 'ws-1', ['t-2', 't-3', 't-3']);

    expect(tagRepo.find).toHaveBeenCalledWith({
      where: { id: In(['t-2', 't-3']), workspaceId: 'ws-1' },
      order: { name: 'ASC' },
    });
    expect(relationQb.of).toHaveBeenCalledWith('r-1');
    expect(relationQb.addAndRemove).toHaveBeenCalledWith(['t-3'], ['t-1']);
    expect(receiptRepo.save).not.toHaveBeenCalled();
    expect(result.map(t => t.id)).toEqual(['t-2', 't-3']);
  });

  it('clears every tag on an empty list without looking tags up', async () => {
    const { service, tagRepo, relationQb } = build({ id: 'r-1', tags: [tag('t-1', 'Almaty')] });

    await expect(service.setTags('r-1', 'ws-1', [])).resolves.toEqual([]);
    expect(tagRepo.find).not.toHaveBeenCalled();
    expect(relationQb.addAndRemove).toHaveBeenCalledWith([], ['t-1']);
  });

  it("refuses an unknown or another workspace's tag instead of dropping it", async () => {
    const { service, tagRepo, relationQb } = build({ id: 'r-1', tags: [] });
    tagRepo.find.mockResolvedValue([tag('t-1', 'Almaty')]);

    await expect(service.setTags('r-1', 'ws-1', ['t-1', 't-foreign'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(relationQb.addAndRemove).not.toHaveBeenCalled();
  });
});
