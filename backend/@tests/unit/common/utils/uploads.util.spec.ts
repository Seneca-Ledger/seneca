import * as os from 'os';
import * as path from 'path';
import { readUploadedFile, resolveInUploadsDir } from '@/common/utils/uploads.util';
import { calculateFileHash } from '@/common/utils/file-hash.util';

describe('resolveInUploadsDir', () => {
  const root = path.join(os.tmpdir(), 'uploads-root');

  it('keeps a path inside the uploads directory', () => {
    expect(resolveInUploadsDir(path.join(root, 'a.pdf'), root)).toBe(path.join(root, 'a.pdf'));
  });

  it('rejects an absolute path elsewhere', () => {
    expect(resolveInUploadsDir('/etc/passwd', root)).toBeNull();
  });

  it('rejects a path that climbs out with ..', () => {
    expect(resolveInUploadsDir(path.join(root, '..', 'secret'), root)).toBeNull();
  });

  it('rejects a sibling directory that shares the prefix', () => {
    expect(resolveInUploadsDir(`${root}-evil/a.pdf`, root)).toBeNull();
  });
});

describe('calculateFileHash', () => {
  it('refuses to read a file outside the uploads directory', async () => {
    await expect(calculateFileHash('/etc/hostname')).rejects.toThrow(/outside the uploads/);
  });
});

describe('readUploadedFile', () => {
  it('refuses to read a file outside the uploads directory', async () => {
    await expect(readUploadedFile('/etc/hostname')).rejects.toThrow(/outside the uploads/);
  });
});
