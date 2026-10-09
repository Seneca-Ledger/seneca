import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { resolveAvatarContentType } from '../../common/utils/avatar-filename.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { WorkspaceBusinessProfile } from '../../entities/workspace-business-profile.entity';
import type { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';

export const LOGO_DIRECTORY = 'workspace-logos';

/** What a document cannot be issued without. */
export const REQUIRED_PROFILE_FIELDS = ['legalName', 'addressLines'] as const;

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number];

@Injectable()
export class BusinessProfileService {
  private readonly logger = new Logger(BusinessProfileService.name);

  constructor(
    @InjectRepository(WorkspaceBusinessProfile)
    private readonly profileRepository: Repository<WorkspaceBusinessProfile>,
  ) {}

  /** The stored profile, or an empty one so callers never branch on null. */
  async get(workspaceId: string): Promise<WorkspaceBusinessProfile> {
    const stored = await this.profileRepository.findOne({ where: { workspaceId } });
    return stored ?? this.profileRepository.create({ workspaceId });
  }

  async update(
    workspaceId: string,
    dto: UpdateBusinessProfileDto,
  ): Promise<WorkspaceBusinessProfile> {
    const profile = await this.get(workspaceId);
    const writable = profile as unknown as Record<string, string | null>;
    for (const [field, value] of Object.entries(dto)) {
      if (value === undefined) {
        continue;
      }
      const trimmed = String(value).trim();
      // An emptied field is cleared rather than stored as '': the document
      // renderer decides what to leave out by checking for null.
      writable[field] =
        trimmed === '' ? null : field === 'countryCode' ? trimmed.toUpperCase() : trimmed;
    }
    return this.profileRepository.save(profile);
  }

  /** Fields a document needs that are still empty. */
  missingRequiredFields(profile: WorkspaceBusinessProfile): RequiredProfileField[] {
    return REQUIRED_PROFILE_FIELDS.filter(field => !profile[field]?.trim());
  }

  async setLogo(workspaceId: string, fileName: string): Promise<WorkspaceBusinessProfile> {
    const profile = await this.get(workspaceId);
    const previous = profile.logoFile;
    profile.logoFile = fileName;
    const saved = await this.profileRepository.save(profile);
    if (previous && previous !== fileName) {
      await this.removeLogoFile(previous);
    }
    return saved;
  }

  async clearLogo(workspaceId: string): Promise<WorkspaceBusinessProfile> {
    const profile = await this.get(workspaceId);
    const previous = profile.logoFile;
    profile.logoFile = null;
    const saved = await this.profileRepository.save(profile);
    if (previous) {
      await this.removeLogoFile(previous);
    }
    return saved;
  }

  logoPath(fileName: string): string {
    return path.join(resolveUploadsDir(), LOGO_DIRECTORY, path.basename(fileName));
  }

  /**
   * The logo as a data URI for pdfmake, or null when there is none or it has
   * gone missing from disk — a missing file must not stop an invoice going out.
   */
  async logoDataUri(profile: WorkspaceBusinessProfile): Promise<string | null> {
    if (!profile.logoFile) {
      return null;
    }
    const contentType = resolveAvatarContentType(profile.logoFile);
    if (!contentType) {
      return null;
    }
    try {
      const bytes = await fs.readFile(this.logoPath(profile.logoFile));
      return `data:${contentType};base64,${bytes.toString('base64')}`;
    } catch (error) {
      this.logger.warn(
        `Logo ${profile.logoFile} for workspace ${profile.workspaceId} could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async removeLogoFile(fileName: string): Promise<void> {
    try {
      await fs.unlink(this.logoPath(fileName));
    } catch {
      // Already gone, or never written: nothing to clean up.
    }
  }
}
