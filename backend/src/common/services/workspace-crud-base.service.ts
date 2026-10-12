import type { FindOptionsOrder, ObjectLiteral, Repository } from 'typeorm';
import { assertFound } from '../utils/assert-found.util';

/**
 * Base service for workspace-scoped CRUD entities.
 *
 * Provides standard findAll, findOne, update, remove methods.
 * Subclasses typically only need to implement create() and
 * optionally override getDefaultOrder().
 */
export abstract class WorkspaceCrudBaseService<T extends ObjectLiteral> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityName: string,
  ) {}

  protected getDefaultOrder(): FindOptionsOrder<T> {
    return { name: 'ASC' } as unknown as FindOptionsOrder<T>;
  }

  async findAll(workspaceId: string): Promise<T[]> {
    return this.repository.find({
      where: { workspaceId } as any,
      order: this.getDefaultOrder(),
    });
  }

  async findOne(id: string, workspaceId: string): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id, workspaceId } as any,
    });
    assertFound(entity, this.entityName);
    return entity;
  }

  // Keyed by the entity's fields but loose in their values: request bodies carry
  // contract literals ('income') where the entity has an enum with that value.
  async update(
    id: string,
    workspaceId: string,
    dto: Partial<Record<keyof T, unknown>>,
  ): Promise<T> {
    const entity = await this.findOne(id, workspaceId);
    Object.assign(entity, dto);
    return this.repository.save(entity);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const entity = await this.findOne(id, workspaceId);
    await this.repository.remove(entity);
  }
}
