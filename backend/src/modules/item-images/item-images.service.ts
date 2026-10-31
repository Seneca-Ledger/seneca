import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { canReadPrivate } from '../../common/utils/transaction-privacy.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import type { ItemImage as ItemImageAnswer, ItemVendor } from '../../contracts';
import { ItemImage, Payable, PayablePayment, Transaction } from '../../entities';
import { vendorsOfTransactions } from './transaction-vendors';
import { ITEM_IMAGE_CONTENT_TYPES, WikidataImagesService } from './wikidata-images.service';

export const ITEM_IMAGE_DIRECTORY = 'item-images';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** One list page; a longer query is someone else's problem, not a bigger IN. */
const MAX_IDS = 200;

type Subject = 'transaction' | 'payable';

/**
 * Pictures of what was bought or sold, kept on a transaction or a bill.
 *
 * A bill and the transaction that settled it are one purchase seen from two
 * pages, so each shows the other's picture when it has none of its own. The
 * file is copied into uploads (the Commons URL is not ours to rely on) and
 * served as a static file under an unguessable name, like goal covers.
 */
@Injectable()
export class ItemImagesService {
  constructor(
    @InjectRepository(ItemImage)
    private readonly images: Repository<ItemImage>,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Payable)
    private readonly payables: Repository<Payable>,
    @InjectRepository(PayablePayment)
    private readonly payments: Repository<PayablePayment>,
    private readonly source: WikidataImagesService,
  ) {}

  async forTransactions(
    workspaceId: string,
    rawIds: readonly string[],
    viewerMemberId: string | null,
  ): Promise<ItemImageAnswer[]> {
    const ids = await this.readableTransactionIds(workspaceId, cleanIds(rawIds), viewerMemberId);
    if (ids.length === 0) {
      return [];
    }
    const own = await this.images.find({ where: { workspaceId, transactionId: In(ids) } });
    const answers = own.map(image => answer(image.transactionId as string, image));
    const rest = ids.filter(id => !own.some(image => image.transactionId === id));
    const bills = await this.billsOf(workspaceId, rest);
    const linked = await this.imagesOf(workspaceId, 'payableId', [...bills.values()].flat());
    for (const id of rest) {
      const image = bills
        .get(id)
        ?.map(billId => linked.get(billId))
        .find(Boolean);
      if (image) {
        answers.push(answer(id, image));
      }
    }
    return answers;
  }

  /** The subscription vendors of the transactions the viewer may read. */
  async vendorsForTransactions(
    workspaceId: string,
    rawIds: readonly string[],
    viewerMemberId: string | null,
  ): Promise<ItemVendor[]> {
    const ids = await this.readableTransactionIds(workspaceId, cleanIds(rawIds), viewerMemberId);
    return vendorsOfTransactions(this.images.manager, workspaceId, ids);
  }

  async forPayables(
    workspaceId: string,
    rawIds: readonly string[],
    viewerMemberId: string | null,
  ): Promise<ItemImageAnswer[]> {
    const ids = cleanIds(rawIds);
    if (ids.length === 0) {
      return [];
    }
    const own = await this.images.find({ where: { workspaceId, payableId: In(ids) } });
    const answers = own.map(image => answer(image.payableId as string, image));
    const rest = ids.filter(id => !own.some(image => image.payableId === id));
    const settledBy = await this.transactionsOf(workspaceId, rest);
    const readable = new Set(
      await this.readableTransactionIds(
        workspaceId,
        [...settledBy.values()].flat(),
        viewerMemberId,
      ),
    );
    const linked = await this.imagesOf(workspaceId, 'transactionId', [...readable]);
    for (const id of rest) {
      const image = settledBy
        .get(id)
        ?.filter(txId => readable.has(txId))
        .map(txId => linked.get(txId))
        .find(Boolean);
      if (image) {
        answers.push(answer(id, image));
      }
    }
    return answers;
  }

  async set(
    subject: Subject,
    workspaceId: string,
    subjectId: string,
    wikidataId: string,
    viewerMemberId: string | null,
    lang = 'en',
  ): Promise<ItemImageAnswer> {
    await this.assertSubject(subject, workspaceId, subjectId, viewerMemberId);
    const [picture, label] = await Promise.all([
      this.source.picture(wikidataId),
      this.source.labelOf(wikidataId, lang).catch(() => null),
    ]);
    const fileName = `${randomUUID()}${ITEM_IMAGE_CONTENT_TYPES[picture.contentType]}`;
    await fs.mkdir(this.directory(), { recursive: true });
    await fs.writeFile(this.filePath(fileName), picture.body);

    const column = subject === 'transaction' ? 'transactionId' : 'payableId';
    const existing = await this.images.findOne({ where: { workspaceId, [column]: subjectId } });
    const saved = await this.images.save(
      this.images.create({
        ...(existing ?? { workspaceId, [column]: subjectId }),
        fileName,
        label,
        wikidataId,
      }),
    );
    // Only once the row points at the new file.
    if (existing) {
      await this.deleteFile(existing.fileName);
    }
    return answer(subjectId, saved);
  }

  /** Removes the subject's picture, or, without one, the linked one it showed. */
  async remove(
    subject: Subject,
    workspaceId: string,
    subjectId: string,
    viewerMemberId: string | null,
  ): Promise<void> {
    await this.assertSubject(subject, workspaceId, subjectId, viewerMemberId);
    const column = subject === 'transaction' ? 'transactionId' : 'payableId';
    let doomed = await this.images.find({ where: { workspaceId, [column]: subjectId } });
    if (doomed.length === 0) {
      const linked =
        subject === 'transaction'
          ? (await this.billsOf(workspaceId, [subjectId])).get(subjectId)
          : (await this.transactionsOf(workspaceId, [subjectId])).get(subjectId);
      const other = subject === 'transaction' ? 'payableId' : 'transactionId';
      doomed = linked?.length
        ? await this.images.find({ where: { workspaceId, [other]: In(linked) } })
        : [];
    }
    if (doomed.length === 0) {
      return;
    }
    await this.images.delete({ workspaceId, id: In(doomed.map(image => image.id)) });
    await Promise.all(doomed.map(image => this.deleteFile(image.fileName)));
  }

  private async assertSubject(
    subject: Subject,
    workspaceId: string,
    id: string,
    viewerMemberId: string | null,
  ): Promise<void> {
    const found =
      subject === 'transaction'
        ? (await this.readableTransactionIds(workspaceId, [id], viewerMemberId)).length > 0
        : await this.payables.exists({ where: { id, workspaceId } });
    if (!found) {
      throw new NotFoundException(
        appError(subject === 'transaction' ? 'TRANSACTION_NOT_FOUND' : 'PAYABLE_NOT_FOUND'),
      );
    }
  }

  /** Someone else's private row shows nothing that would say what it was. */
  private async readableTransactionIds(
    workspaceId: string,
    ids: string[],
    viewerMemberId: string | null,
  ): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.transactions.find({
      select: { id: true, isPrivate: true, ownerMemberId: true },
      where: { workspaceId, id: In(ids) },
    });
    return rows.filter(row => canReadPrivate(row, viewerMemberId)).map(row => row.id);
  }

  /** Bills each transaction settled: the one it is linked to, and recorded payments. */
  private async billsOf(workspaceId: string, txIds: string[]): Promise<Map<string, string[]>> {
    const bills = new Map<string, string[]>();
    if (txIds.length === 0) {
      return bills;
    }
    const [linked, payments] = await Promise.all([
      this.payables.find({
        select: { id: true, linkedTransactionId: true },
        where: { workspaceId, linkedTransactionId: In(txIds) },
      }),
      this.payments.find({
        select: { payableId: true, transactionId: true },
        where: { workspaceId, transactionId: In(txIds) },
      }),
    ]);
    for (const { id, linkedTransactionId } of linked) {
      push(bills, linkedTransactionId, id);
    }
    for (const { payableId, transactionId } of payments) {
      push(bills, transactionId, payableId);
    }
    return bills;
  }

  /** Transactions that settled each bill. */
  private async transactionsOf(
    workspaceId: string,
    billIds: string[],
  ): Promise<Map<string, string[]>> {
    const settled = new Map<string, string[]>();
    if (billIds.length === 0) {
      return settled;
    }
    const [linked, payments] = await Promise.all([
      this.payables.find({
        select: { id: true, linkedTransactionId: true },
        where: { workspaceId, id: In(billIds) },
      }),
      this.payments.find({
        select: { payableId: true, transactionId: true },
        where: { workspaceId, payableId: In(billIds) },
      }),
    ]);
    for (const { id, linkedTransactionId } of linked) {
      push(settled, id, linkedTransactionId);
    }
    for (const { payableId, transactionId } of payments) {
      push(settled, payableId, transactionId);
    }
    return settled;
  }

  private async imagesOf(
    workspaceId: string,
    column: 'transactionId' | 'payableId',
    ids: string[],
  ): Promise<Map<string, ItemImage>> {
    const byId = new Map<string, ItemImage>();
    if (ids.length === 0) {
      return byId;
    }
    const found = await this.images.find({ where: { workspaceId, [column]: In(ids) } });
    for (const image of found) {
      byId.set(image[column] as string, image);
    }
    return byId;
  }

  private directory(): string {
    return path.join(resolveUploadsDir(), ITEM_IMAGE_DIRECTORY);
  }

  /** basename strips any traversal a malformed stored value could carry. */
  private filePath(fileName: string): string {
    return path.join(this.directory(), path.basename(fileName));
  }

  private async deleteFile(fileName: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(fileName));
    } catch {
      // Already gone, or a read-only volume: an orphaned file is not worth an error.
    }
  }
}

function answer(subjectId: string, image: ItemImage): ItemImageAnswer {
  return {
    subjectId,
    url: `/uploads/${ITEM_IMAGE_DIRECTORY}/${image.fileName}`,
    label: image.label,
  };
}

function cleanIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(id => UUID.test(id)))].slice(0, MAX_IDS);
}

function push(map: Map<string, string[]>, key: string | null, value: string | null): void {
  if (!(key && value)) {
    return;
  }
  const list = map.get(key) ?? [];
  if (!list.includes(value)) {
    list.push(value);
  }
  map.set(key, list);
}
