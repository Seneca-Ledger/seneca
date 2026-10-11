import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { SchemaBody } from '../../../common/effect/schema-body';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { validateFile } from '../../../common/utils/file-validator.util';
import { assertSafeZipDecompressionRatio } from '../../../common/utils/zip-bomb-guard.util';
import { multerConfig } from '../../../config/multer.config';
import { ParseDocumentBody } from '../../../contracts';
import { UniversalExtractorService } from '../services/universal-extractor.service';

// Local type alias prevents babel-plugin-transform-typescript-metadata from emitting
// the ambient `Express` namespace as a runtime expression in decorator metadata.
type MulterFile = Express.Multer.File;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp']);
// `sheetRows` (used below) only skips building JS row objects — xlsx still
// fully inflates every ZIP entry first, so it doesn't bound decompression
// cost. assertSafeZipDecompressionRatio, called before xlsx.read, does that.
const MAX_SHEET_ROWS = 50_000;

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class ParsingController {
  constructor(private readonly universalExtractor: UniversalExtractorService) {}

  @Post('parse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parse uploaded document and extract structured financial fields' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async parseDocument(
    @UploadedFile() file: MulterFile,
    @SchemaBody(ParseDocumentBody) payload: ParseDocumentBody,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    validateFile(file);

    const ext = path.extname(file.originalname || '').toLowerCase();
    const buffer = await fs.readFile(file.path);
    const context = {
      sender: payload.sender,
      subject: payload.subject,
      emailBody: payload.emailBody,
      fileNameHint: file.originalname,
    };

    try {
      if (IMAGE_EXTENSIONS.has(ext)) {
        const parsed = await this.universalExtractor.extractFromImage(
          buffer,
          file.mimetype || this.mimeFromExtension(ext),
          context,
        );

        return {
          source: payload.source || 'upload',
          ...parsed,
        };
      }

      if (ext === '.pdf') {
        const parsed = await this.universalExtractor.extractFromPdf(buffer, context);
        return {
          source: payload.source || 'upload',
          ...parsed,
        };
      }

      if (ext === '.csv') {
        const text = buffer.toString('utf-8');
        const parsed = await this.universalExtractor.extractFromText(text, context);
        return {
          source: payload.source || 'upload',
          ...parsed,
        };
      }

      if (ext === '.xlsx' || ext === '.xls') {
        assertSafeZipDecompressionRatio(buffer);
        const workbook = xlsx.read(buffer, { type: 'buffer', sheetRows: MAX_SHEET_ROWS });
        const firstSheet = workbook.SheetNames[0];

        if (!firstSheet) {
          throw new BadRequestException('Spreadsheet has no sheets to parse');
        }

        const csvText = xlsx.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
        const parsed = await this.universalExtractor.extractFromText(csvText, context);

        return {
          source: payload.source || 'upload',
          ...parsed,
        };
      }

      throw new BadRequestException(
        `Unsupported file extension: ${ext || 'unknown'}. Supported: PDF, CSV, XLSX/XLS, JPG, PNG`,
      );
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  private mimeFromExtension(ext: string): string {
    if (ext === '.jpg' || ext === '.jpeg') {
      return 'image/jpeg';
    }

    if (ext === '.png') {
      return 'image/png';
    }

    return 'application/octet-stream';
  }
}
