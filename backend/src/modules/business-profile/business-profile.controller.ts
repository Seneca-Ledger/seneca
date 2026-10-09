import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import {
  isAllowedAvatarMime,
  resolveAvatarContentType,
} from '../../common/utils/avatar-filename.util';
import { removeUploadedFile, validateImageSignature } from '../../common/utils/file-validator.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { EntityType } from '../../entities/audit-event.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { BusinessProfileService, LOGO_DIRECTORY } from './business-profile.service';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';

// Aliased: `Express.Multer.File` in a decorated parameter would be emitted as a
// runtime reference to `Express`, which does not exist.
type MulterFile = Express.Multer.File;

const LOGO_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Controller('business-profile')
export class BusinessProfileController {
  constructor(private readonly businessProfileService: BusinessProfileService) {}

  @Get()
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async get(@WorkspaceId() workspaceId: string) {
    const profile = await this.businessProfileService.get(workspaceId);
    return {
      ...profile,
      missingRequired: this.businessProfileService.missingRequiredFields(profile),
    };
  }

  @Put()
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @Audit({ entityType: EntityType.WORKSPACE, includeDiff: true, isUndoable: true })
  async update(@Body() dto: UpdateBusinessProfileDto, @WorkspaceId() workspaceId: string) {
    const profile = await this.businessProfileService.update(workspaceId, dto);
    return {
      ...profile,
      missingRequired: this.businessProfileService.missingRequiredFields(profile),
    };
  }

  @Post('logo')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const targetDir = path.join(resolveUploadsDir(), LOGO_DIRECTORY);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          cb(null, targetDir);
        },
        // Random name, extension from the declared type: the file is served
        // from a public route, so it must be neither guessable nor able to
        // choose its own extension.
        filename: (_req, file, cb) => {
          const extension = LOGO_EXTENSION_BY_MIME[file.mimetype];
          if (!extension) {
            return cb(new BadRequestException('Unsupported logo type'), '');
          }
          cb(null, `${randomUUID()}${extension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!isAllowedAvatarMime(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 2_000_000 },
    }),
  )
  async uploadLogo(
    @UploadedFile() file: MulterFile | undefined,
    @WorkspaceId() workspaceId: string,
  ) {
    if (!file) {
      throw new BadRequestException(appError('FILE_NOT_UPLOADED'));
    }
    // The declared type picked the extension; confirm the bytes agree before
    // the file becomes reachable through the public logo route.
    try {
      validateImageSignature(file);
    } catch (error) {
      await removeUploadedFile(file);
      throw error;
    }

    const profile = await this.businessProfileService.setLogo(workspaceId, file.filename);
    return {
      logoFile: profile.logoFile,
      logoUrl: `/api/v1/business-profile/logo/${file.filename}`,
    };
  }

  @Delete('logo')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async deleteLogo(@WorkspaceId() workspaceId: string) {
    await this.businessProfileService.clearLogo(workspaceId);
    return { logoFile: null };
  }

  /**
   * Public like the avatar route, for the same reason: an `<img>` tag sends no
   * workspace header. The file name is a random uuid, so the url is the secret.
   */
  @Public()
  @Get('logo/:fileName')
  getLogo(@Param('fileName') fileName: string, @Res() res: Response) {
    const safeFileName = path.basename(fileName);
    const filePath = this.businessProfileService.logoPath(safeFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Logo not found');
    }

    const contentType = resolveAvatarContentType(safeFileName);
    if (!contentType) {
      return res.status(404).send('Logo not found');
    }

    return res.sendFile(filePath, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'Content-Type': contentType,
      },
    });
  }
}
