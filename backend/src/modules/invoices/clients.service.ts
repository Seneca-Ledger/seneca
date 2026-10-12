import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsOrder, Repository } from 'typeorm';
import { WorkspaceCrudBaseService } from '../../common/services/workspace-crud-base.service';
import type { CreateClientBody, UpdateClientBody } from '../../contracts';
import { Client } from '../../entities/client.entity';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';

@Injectable()
export class ClientsService extends WorkspaceCrudBaseService<Client> {
  constructor(
    @InjectRepository(Client)
    repository: Repository<Client>,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {
    super(repository, 'Client');
  }

  /** Same clean-up as on create: an emptied field is cleared, a country is upper-cased. */
  async update(id: string, workspaceId: string, dto: UpdateClientBody): Promise<Client> {
    const normalized: UpdateClientBody & Record<string, unknown> = { ...dto };
    for (const field of ['street', 'postalCode', 'city', 'buyerReference'] as const) {
      if (dto[field] !== undefined) {
        normalized[field] = (dto[field]?.trim() || null) as never;
      }
    }
    if (dto.countryCode !== undefined) {
      normalized.countryCode = (dto.countryCode ? dto.countryCode.toUpperCase() : null) as never;
    }
    return super.update(id, workspaceId, normalized as never);
  }

  protected getDefaultOrder(): FindOptionsOrder<Client> {
    return { name: 'ASC' };
  }

  async create(workspaceId: string, dto: CreateClientBody): Promise<Client> {
    const client = this.repository.create({
      workspaceId,
      name: dto.name.trim(),
      email: dto.email || null,
      billingAddress: dto.billingAddress || null,
      taxId: dto.taxId || null,
      currency: await this.workspaceCurrency.resolveFor(workspaceId, dto.currency),
      locale: dto.locale?.trim() || null,
      remindersEnabled: dto.remindersEnabled ?? true,
      paymentTermsDays: dto.paymentTermsDays ?? null,
      street: dto.street?.trim() || null,
      postalCode: dto.postalCode?.trim() || null,
      city: dto.city?.trim() || null,
      countryCode: dto.countryCode ? dto.countryCode.toUpperCase() : null,
      buyerReference: dto.buyerReference?.trim() || null,
      supplyType: dto.supplyType ?? null,
    });
    return this.repository.save(client);
  }
}
