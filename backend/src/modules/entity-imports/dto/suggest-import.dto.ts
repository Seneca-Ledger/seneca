import { ArrayMaxSize, IsArray, IsOptional } from 'class-validator';

export class SuggestImportDto {
  @IsArray()
  @ArrayMaxSize(60)
  headers: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  samples?: string[][];
}
