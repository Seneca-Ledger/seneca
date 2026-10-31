import { resolveStaticAssetMounts } from '@/common/utils/static-assets.util';

describe('static asset mounts', () => {
  const mounts = () => resolveStaticAssetMounts('/srv/seneca/uploads', '/srv/seneca/dist/public');

  it('does not expose the private uploads root as a static directory', () => {
    expect(mounts()).toEqual([
      { root: '/srv/seneca/dist/public' },
      {
        root: '/srv/seneca/uploads/custom-field-icons',
        prefix: '/uploads/custom-field-icons',
      },
      {
        root: '/srv/seneca/uploads/goal-covers',
        prefix: '/uploads/goal-covers',
        ensure: true,
      },
      {
        root: '/srv/seneca/uploads/workspace-backgrounds',
        prefix: '/uploads/workspace-backgrounds',
        ensure: true,
      },
      {
        root: '/srv/seneca/uploads/metal-photos',
        prefix: '/uploads/metal-photos',
        ensure: true,
      },
      {
        root: '/srv/seneca/uploads/item-images',
        prefix: '/uploads/item-images',
        ensure: true,
      },
    ]);
    // Stated as a property too, so a future mount cannot quietly widen this to
    // the whole uploads tree while still matching a list someone updated.
    expect(mounts().map(mount => mount.root)).not.toContain('/srv/seneca/uploads');
  });

  it('only creates the subtree that is mounted before anything writes to it', () => {
    const ensured = mounts().filter(mount => mount.ensure);

    expect(ensured.map(mount => mount.prefix)).toEqual([
      '/uploads/goal-covers',
      '/uploads/workspace-backgrounds',
      '/uploads/metal-photos',
      '/uploads/item-images',
    ]);
  });
});
