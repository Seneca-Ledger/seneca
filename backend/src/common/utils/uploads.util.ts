import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function resolveUploadsDir(): string {
  const candidates = [
    process.env.UPLOADS_DIR,
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), '..', 'uploads'),
    path.join(os.tmpdir(), 'seneca-uploads'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // Try next candidate
    }
  }

  throw new Error('No writable uploads directory available');
}

/**
 * The path resolved, or NULL when it falls outside the uploads directory. Every
 * file the server reads back was written there (multer, Gmail, restore), so a
 * path elsewhere means a tampered row or a broken invariant. Callers repeat the
 * prefix check next to the filesystem call so the bound is visible there.
 */
export function resolveInUploadsDir(
  candidatePath: string,
  uploadsRoot: string = path.resolve(resolveUploadsDir()),
): string | null {
  const resolved = path.resolve(candidatePath);
  return resolved === uploadsRoot || resolved.startsWith(`${uploadsRoot}${path.sep}`)
    ? resolved
    : null;
}
