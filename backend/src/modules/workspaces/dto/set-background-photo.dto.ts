import { IsUUID } from 'class-validator';

export class SetBackgroundPhotoDto {
  /**
   * An Openverse image id, as returned by the search. A uuid, which is also
   * what makes it safe to put in the upstream path: it cannot carry a host.
   */
  @IsUUID()
  photoId: string;
}
