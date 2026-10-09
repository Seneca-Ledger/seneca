import * as path from 'node:path';

export type StaticAssetMount = {
  root: string;
  prefix?: string;
  /**
   * Create the directory if it is missing, instead of skipping the mount.
   * An uploads subtree that only comes into existence the first time someone
   * saves a file would otherwise stay unmounted until the next restart.
   */
  ensure?: boolean;
};

export function resolveStaticAssetMounts(
  uploadsDir: string,
  publicPath: string,
): StaticAssetMount[] {
  return [
    { root: publicPath },
    {
      root: path.join(uploadsDir, 'custom-field-icons'),
      prefix: '/uploads/custom-field-icons',
    },
    // Goal covers: stock photos, named with a fresh uuid that only ever appears
    // in an authenticated response. Same trade as user avatars — the picture is
    // public, the link to it is not guessable.
    {
      root: path.join(uploadsDir, 'goal-covers'),
      prefix: '/uploads/goal-covers',
      ensure: true,
    },
    // Photos of metal lots. Same trade as the covers above — the file is
    // served without a session, and a fresh uuid for a name is what keeps the
    // link unguessable. It only ever appears in an authenticated response.
    {
      root: path.join(uploadsDir, 'metal-photos'),
      prefix: '/uploads/metal-photos',
      ensure: true,
    },
  ];
}
