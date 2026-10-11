import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { BACKGROUND_SEARCH_MAX_PAGE } from '../workspace-background.constants';

export class SearchBackgroundsDto {
  /** What the person typed or tapped. Passed to Openverse as the search term, nothing else. */
  @IsString()
  @Length(1, 100)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BACKGROUND_SEARCH_MAX_PAGE)
  page?: number;
}
