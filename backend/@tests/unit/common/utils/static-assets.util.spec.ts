import { resolveStaticAssetMounts } from '@/common/utils/static-assets.util';

describe('static asset mounts', () => {
  const mounts = () => resolveStaticAssetMounts('/srv/lumio/uploads', '/srv/lumio/dist/public');

  it('does not expose the private uploads root as a static directory', () => {
    expect(mounts()).toEqual([
      { root: '/srv/lumio/dist/public' },
      {
        root: '/srv/lumio/uploads/custom-field-icons',
        prefix: '/uploads/custom-field-icons',
      },
      {
        root: '/srv/lumio/uploads/goal-covers',
        prefix: '/uploads/goal-covers',
        ensure: true,
      },
      {
        root: '/srv/lumio/uploads/metal-photos',
        prefix: '/uploads/metal-photos',
        ensure: true,
      },
    ]);
    // Stated as a property too, so a future mount cannot quietly widen this to
    // the whole uploads tree while still matching a list someone updated.
    expect(mounts().map(mount => mount.root)).not.toContain('/srv/lumio/uploads');
  });

  it('only creates the subtree that is mounted before anything writes to it', () => {
    const ensured = mounts().filter(mount => mount.ensure);

    expect(ensured.map(mount => mount.prefix)).toEqual(['/uploads/goal-covers', '/uploads/metal-photos']);
  });
});
