import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type {
  ImportMappingProfile as ImportMappingProfileAnswer,
  MatchImportMappingBody,
  SaveImportMappingBody,
} from '../../contracts';
import { ImportMappingProfile } from '../../entities/import-mapping-profile.entity';
import { EntityImportService } from './entity-import.service';
import { type ImportTargetKind, TARGET_FIELDS } from './target-aliases';

/**
 * Case, spacing and blank trailing cells do not change which export a header
 * row belongs to.
 */
export const headerSignature = (headers: readonly string[]): string => {
  const titles = headers.map(title =>
    String(title ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '),
  );
  while (titles.length > 0 && titles[titles.length - 1] === '') {
    titles.pop();
  }
  return createHash('sha256').update(titles.join('|')).digest('hex');
};

const toAnswer = (profile: ImportMappingProfile): ImportMappingProfileAnswer => ({
  id: profile.id,
  target: profile.target as ImportTargetKind,
  mapping: profile.mapping,
});

/** Column roles remembered per workspace, import target and header row. */
@Injectable()
export class ImportMappingProfilesService {
  constructor(
    @InjectRepository(ImportMappingProfile)
    private readonly repository: Repository<ImportMappingProfile>,
    private readonly entityImport: EntityImportService,
  ) {}

  /** The mapping remembered for this header row, or null. */
  async match(
    workspaceId: string,
    body: MatchImportMappingBody,
  ): Promise<{ profile: ImportMappingProfileAnswer | null }> {
    const saved = await this.repository.findOne({
      where: { workspaceId, target: body.target, headerSignature: headerSignature(body.headers) },
    });
    return { profile: saved ? toAnswer(saved) : null };
  }

  /**
   * Remembers the mapping for this header row, replacing an earlier one. Only
   * fields the target knows and columns the header row has are kept. An upsert
   * on the unique key, so a repeated or concurrent save settles on one row.
   */
  async save(
    userId: string,
    workspaceId: string,
    body: SaveImportMappingBody,
  ): Promise<ImportMappingProfileAnswer> {
    await this.entityImport.ensurePermission(userId, workspaceId, body.target, undefined);
    const fields = new Set(TARGET_FIELDS[body.target].map(field => field.key));
    const mapping = Object.fromEntries(
      Object.entries(body.mapping).filter(
        ([field, index]) => fields.has(field) && index >= 0 && index < body.headers.length,
      ),
    );
    const signature = headerSignature(body.headers);
    await this.repository.upsert(
      { workspaceId, target: body.target, headerSignature: signature, mapping, savedBy: userId },
      { conflictPaths: ['workspaceId', 'target', 'headerSignature'] },
    );
    const saved = await this.repository.findOneOrFail({
      where: { workspaceId, target: body.target, headerSignature: signature },
    });
    return toAnswer(saved);
  }

  /** Forgets a remembered mapping. Forgetting one that is not there is not an error. */
  async remove(userId: string, workspaceId: string, id: string): Promise<{ ok: true }> {
    const saved = await this.repository.findOne({ where: { id, workspaceId } });
    if (saved) {
      await this.entityImport.ensurePermission(
        userId,
        workspaceId,
        saved.target as ImportTargetKind,
        undefined,
      );
      await this.repository.delete({ id, workspaceId });
    }
    return { ok: true };
  }
}
