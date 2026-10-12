import * as Schema from 'effect/Schema';
import { IsoDateString, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateGoalBody = Schema.Struct({
  name: Schema.String.check(Schema.isBetweenLength(1, 150)),
  targetAmount: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0.01)),
  currency: optionalNullable(Schema.String),
  targetDate: optionalNullable(IsoDateString),
});
export type CreateGoalBody = Wire<typeof CreateGoalBody>;

/**
 * Exactly one of these is sent. Which one is which kind of cover is checked in
 * the service, where the "one or the other" rule can be stated in one place
 * instead of as a pair of conditional decorators.
 */
export const SetGoalCoverBody = Schema.Struct({
  /** A bundled tile, by id. */
  preset: optionalNullable(
    Schema.Literals([
      'travel',
      'home',
      'car',
      'education',
      'emergency',
      'wedding',
      'retirement',
      'camera',
      'tech',
      'health',
      'gift',
      'pet',
      'sport',
      'renovation',
      'business',
      'investment',
    ]),
  ),
  /**
   * An Openverse image id, as returned by the search. A uuid, which is also
   * what makes it safe to put in the upstream path: it cannot carry a host.
   */
  photoId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type SetGoalCoverBody = Wire<typeof SetGoalCoverBody>;

export const UpdateGoalBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isBetweenLength(1, 150))),
  targetAmount: optionalNullable(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0.01))),
  currency: optionalNullable(Schema.String),
  /** Explicit null clears the deadline; omitting the field leaves it alone. */
  targetDate: optionalNullable(IsoDateString),
});
export type UpdateGoalBody = Wire<typeof UpdateGoalBody>;

export const CreateContributionBody = Schema.Struct({
  /** Negative withdraws from the goal — corrections are new rows, not edits. */
  amount: Schema.Finite,
  contributionDate: optionalNullable(IsoDateString),
  note: optionalNullable(Schema.String.check(Schema.isBetweenLength(1, 200))),
});
export type CreateContributionBody = Wire<typeof CreateContributionBody>;
