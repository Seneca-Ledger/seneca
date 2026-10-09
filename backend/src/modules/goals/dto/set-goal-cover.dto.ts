import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { GOAL_COVER_PRESETS } from '../goal-cover.constants';

/**
 * Exactly one of these is sent. Which one is which kind of cover is checked in
 * the service, where the "one or the other" rule can be stated in one place
 * instead of as a pair of conditional decorators.
 */
export class SetGoalCoverDto {
  /** A bundled tile, by id. */
  @IsOptional()
  @IsString()
  @IsIn(GOAL_COVER_PRESETS as unknown as string[])
  preset?: string;

  /**
   * An Openverse image id, as returned by the search. A uuid, which is also
   * what makes it safe to put in the upstream path: it cannot carry a host.
   */
  @IsOptional()
  @IsUUID()
  photoId?: string;
}
