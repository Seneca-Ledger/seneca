import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PreviewCustomTableSourceDto } from './preview-custom-table-source.dto';

export class CreateCustomTableFromSourceDto extends PreviewCustomTableSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  /** Workspace currency for money columns, same as the templates flow. */
  @IsOptional()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;
}
