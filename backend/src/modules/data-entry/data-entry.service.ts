import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { User, WorkspaceMember } from '../../entities';
import { DataEntry, type DataEntryType } from '../../entities/data-entry.entity';
import { DataEntryCustomField } from '../../entities/data-entry-custom-field.entity';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import type { CreateDataEntryDto } from './dto/create-data-entry.dto';
import type { CreateDataEntryCustomFieldDto } from './dto/create-data-entry-custom-field.dto';
import type { UpdateDataEntryCustomFieldDto } from './dto/update-data-entry-custom-field.dto';

type DriverErrorLike = { driverError?: { code?: string } };

const getDriverErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  return (error as DriverErrorLike).driverError?.code;
};

interface ListParams {
  workspaceId: string;
  type?: DataEntryType;
  customTabId?: string;
  limit?: number;
  page?: number;
  query?: string; // note search
  date?: string; // yyyy-mm-dd
}

interface ListResult {
  items: DataEntry[];
  total: number;
}

@Injectable()
export class DataEntryService {
  constructor(
    @InjectRepository(DataEntry)
    private readonly dataEntryRepository: Repository<DataEntry>,
    @InjectRepository(DataEntryCustomField)
    private readonly dataEntryCustomFieldRepository: Repository<DataEntryCustomField>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {}

  private async ensureCanEditDataEntry(workspaceId: string, userId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditDataEntry',
      'DATA_ENTRY_EDIT_FORBIDDEN',
    );
  }

  async create(workspaceId: string, userId: string, dto: CreateDataEntryDto): Promise<DataEntry> {
    await this.ensureCanEditDataEntry(workspaceId, userId);
    const customFieldName = dto.customFieldName?.trim() || null;
    const customFieldValue = dto.customFieldValue?.trim() || null;
    const customFieldIconRaw = dto.customFieldIcon?.trim() || null;
    const customFieldIcon = customFieldName ? customFieldIconRaw : null;
    if (customFieldValue && !customFieldName) {
      throw new BadRequestException(appError('ENTRY_CUSTOM_COLUMN_TITLE_REQUIRED'));
    }

    let customTabId: string | null = null;
    if (dto.customTabId) {
      const customTab = await this.dataEntryCustomFieldRepository.findOne({
        where: { id: dto.customTabId, workspaceId },
      });
      if (!customTab) {
        throw new BadRequestException(appError('VIEW_NOT_FOUND'));
      }
      customTabId = customTab.id;
    }

    const entry = this.dataEntryRepository.create({
      userId,
      workspaceId,
      type: dto.type,
      date: dto.date,
      amount: dto.amount,
      note: dto.note || null,
      currency: await this.workspaceCurrency.resolveFor(workspaceId, dto.currency),
      customFieldName,
      customFieldIcon,
      customFieldValue,
      customTabId,
    });
    return this.dataEntryRepository.save(entry);
  }

  async list(params: ListParams): Promise<ListResult> {
    const take = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const page = Math.max(params.page ?? 1, 1);
    const skip = (page - 1) * take;
    const noteQuery = (params.query ?? '').trim().slice(0, 200);
    const date = (params.date ?? '').trim().slice(0, 32);

    const qb = this.dataEntryRepository
      .createQueryBuilder('e')
      .where('"e"."workspace_id" = :workspaceId', { workspaceId: params.workspaceId });

    if (params.customTabId) {
      qb.andWhere('"e"."custom_tab_id" = :customTabId', { customTabId: params.customTabId });
    } else {
      qb.andWhere('"e"."custom_tab_id" IS NULL');
      if (params.type) {
        qb.andWhere('"e"."type" = :type', { type: params.type });
      }
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      qb.andWhere('"e"."date" = :date', { date });
    }

    if (noteQuery) {
      const like = `%${noteQuery.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      qb.andWhere('"e"."note" ILIKE :like', { like });
    }

    const [items, total] = await qb
      .orderBy('"e"."date"', 'DESC')
      .addOrderBy('"e"."created_at"', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return { items, total };
  }

  async remove(workspaceId: string, userId: string, id: string): Promise<void> {
    await this.ensureCanEditDataEntry(workspaceId, userId);
    const entry = await this.dataEntryRepository.findOne({ where: { id, workspaceId } });
    if (!entry) {
      throw new NotFoundException(appError('ENTRY_NOT_FOUND'));
    }
    await this.dataEntryRepository.delete(id);
  }

  async listCustomFields(
    workspaceId: string,
  ): Promise<Array<DataEntryCustomField & { entriesCount: number }>> {
    const rows = await this.dataEntryCustomFieldRepository
      .createQueryBuilder('f')
      .leftJoin(
        DataEntry,
        'e',
        '"e"."custom_tab_id" = "f"."id" AND "e"."workspace_id" = "f"."workspace_id"',
      )
      .where('"f"."workspace_id" = :workspaceId', { workspaceId })
      .select(['f.id AS id', 'f.name AS name', 'f.icon AS icon'])
      .addSelect('COUNT("e"."id")', 'entriesCount')
      .groupBy('"f"."id"')
      .orderBy('"f"."name"', 'ASC')
      .getRawMany<{ id: string; name: string; icon: string | null; entriesCount: string }>();

    return rows.map(row => ({
      ...Object.assign(
        this.dataEntryCustomFieldRepository.create({
          id: row.id,
          workspaceId,
          name: row.name,
          icon: row.icon,
        }),
        { entriesCount: Number(row.entriesCount || 0) },
      ),
    }));
  }

  async getHiddenBaseTabs(userId: string): Promise<DataEntryType[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'dataEntryHiddenBaseTabs'],
    });
    const hidden = user?.dataEntryHiddenBaseTabs;
    return Array.isArray(hidden) ? hidden : [];
  }

  async removeBaseTab(workspaceId: string, userId: string, type: DataEntryType): Promise<void> {
    await this.ensureCanEditDataEntry(workspaceId, userId);

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'dataEntryHiddenBaseTabs'],
    });
    if (!user) {
      throw new NotFoundException(appError('USER_NOT_FOUND'));
    }

    const current = Array.isArray(user.dataEntryHiddenBaseTabs) ? user.dataEntryHiddenBaseTabs : [];

    if (!current.includes(type)) {
      user.dataEntryHiddenBaseTabs = [...current, type];
      await this.userRepository.save(user);
    }

    await this.dataEntryRepository.delete({ workspaceId, type, customTabId: IsNull() });
  }

  async createCustomField(
    workspaceId: string,
    userId: string,
    dto: CreateDataEntryCustomFieldDto,
  ): Promise<DataEntryCustomField> {
    await this.ensureCanEditDataEntry(workspaceId, userId);
    const name = dto.name.trim();
    if (!name.length) {
      throw new BadRequestException(appError('COLUMN_TITLE_REQUIRED'));
    }
    const icon = dto.icon?.trim() || null;
    try {
      return await this.dataEntryCustomFieldRepository.save(
        this.dataEntryCustomFieldRepository.create({
          userId,
          workspaceId,
          name,
          icon,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = getDriverErrorCode(error);
        if (code === '23505') {
          throw new BadRequestException(appError('COLUMN_NAME_TAKEN'));
        }
      }
      throw error;
    }
  }

  async updateCustomField(
    workspaceId: string,
    userId: string,
    id: string,
    dto: UpdateDataEntryCustomFieldDto,
  ): Promise<DataEntryCustomField> {
    await this.ensureCanEditDataEntry(workspaceId, userId);
    const item = await this.dataEntryCustomFieldRepository.findOne({ where: { id, workspaceId } });
    if (!item) {
      throw new NotFoundException(appError('COLUMN_NOT_FOUND'));
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name.length) {
        throw new BadRequestException(appError('COLUMN_TITLE_REQUIRED'));
      }
      item.name = name;
    }
    if (dto.icon !== undefined) {
      item.icon = dto.icon === null ? null : dto.icon?.trim() || null;
    }
    try {
      return await this.dataEntryCustomFieldRepository.save(item);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = getDriverErrorCode(error);
        if (code === '23505') {
          throw new BadRequestException(appError('COLUMN_NAME_TAKEN'));
        }
      }
      throw error;
    }
  }

  async removeCustomField(workspaceId: string, userId: string, id: string): Promise<void> {
    await this.ensureCanEditDataEntry(workspaceId, userId);
    const item = await this.dataEntryCustomFieldRepository.findOne({ where: { id, workspaceId } });
    if (!item) {
      throw new NotFoundException(appError('COLUMN_NOT_FOUND'));
    }
    await this.dataEntryRepository.delete({ workspaceId, customTabId: id });
    await this.dataEntryCustomFieldRepository.delete(id);
  }
}
