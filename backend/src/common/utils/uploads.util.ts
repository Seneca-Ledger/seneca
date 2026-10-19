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
