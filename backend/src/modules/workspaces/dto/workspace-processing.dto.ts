import { IsBoolean, IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import {
  type DuplicateResolution,
  duplicateResolutions,
} from '../../../common/utils/workspace-processing.util';

export class WorkspaceProcessingDto {
  /** 0 categorises almost everything, 1 only exact matches. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  categorizationThreshold?: number;

  @IsOptional()
  @IsEnum(duplicateResolutions as unknown as Record<string, string>)
  duplicateResolution?: DuplicateResolution;

  @IsOptional()
  @IsBoolean()
  aiCategorization?: boolean;

  @IsOptional()
  @IsBoolean()
  aiMerchantNormalization?: boolean;

  @IsOptional()
  @IsBoolean()
  merchantLearning?: boolean;
}
