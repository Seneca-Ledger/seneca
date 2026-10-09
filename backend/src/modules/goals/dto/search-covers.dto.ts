import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { COVER_SEARCH_MAX_PAGE } from '../goal-cover.constants';

export class SearchCoversDto {
  /** What the person typed. Passed to Openverse as the search term, nothing else. */
  @IsString()
  @Length(1, 100)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COVER_SEARCH_MAX_PAGE)
  page?: number;
}
