import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

type JsonObject = Record<string, unknown>;

class BatchRowItemDto {
  @IsObject()
  data: JsonObject;

  @IsOptional()
  @IsInt()
  @Min(1)
  rowNumber?: number;

  /** Cell styles by column key, e.g. an import marking cells it kept as text. */
  @IsOptional()
  @IsObject()
  styles?: JsonObject;
}

/** One request per chunk: the client splits bigger imports and shows progress. */
export const BATCH_ROWS_MAX = 1000;

export class BatchCreateCustomTableRowsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BATCH_ROWS_MAX)
  @ValidateNested({ each: true })
  @Type(() => BatchRowItemDto)
  rows: BatchRowItemDto[];
}
