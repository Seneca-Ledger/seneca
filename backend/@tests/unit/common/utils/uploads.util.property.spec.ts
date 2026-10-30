import * as os from 'os';
import * as path from 'path';
import fc from 'fast-check';
import { resolveInUploadsDir } from '@/common/utils/uploads.util';

// Property-based: whatever path segments an upload name is built from, the guard either
// returns a path inside the uploads root or refuses it.
describe('resolveInUploadsDir (property)', () => {
  const root = path.join(os.tmpdir(), 'uploads-root');
  const segment = fc.oneof(
    fc.constantFrom('..', '.', '', '/', '-evil', 'uploads-root', 'uploads-root-evil'),
    fc.string(),
  );

  it('never returns a path outside the uploads root', () => {
    fc.assert(
      fc.property(fc.nat(2), fc.array(segment, { maxLength: 8 }), (form, segments) => {
        // Absolute elsewhere, joined under the root, or glued onto the root's name.
        const candidate = [
          path.join('/', ...segments),
          path.join(root, ...segments),
          `${root}${segments.join('')}`,
        ][form];
        const resolved = resolveInUploadsDir(candidate, root);
        if (resolved === null) return;
        expect(resolved === root || resolved.startsWith(`${root}${path.sep}`)).toBe(true);
        expect(resolved).toBe(path.resolve(candidate));
      }),
    );
  });

  it('keeps every plain file name under the root', () => {
    const name = fc.stringMatching(/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,40}$/);
    fc.assert(
      fc.property(name, (file) => {
        expect(resolveInUploadsDir(path.join(root, file), root)).toBe(path.join(root, file));
      }),
    );
  });
});
