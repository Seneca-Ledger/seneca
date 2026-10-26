import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { resolveUploadsDir } from './uploads.util';

export function calculateFileHash(filePath: string): Promise<string> {
  const uploadsRoot = path.resolve(resolveUploadsDir());
  const safePath = path.resolve(filePath);
  if (!safePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return Promise.reject(new Error('File is outside the uploads directory'));
  }
  // Opened here, not inside the executor, so the bound above guards the read.
  const stream = fs.createReadStream(safePath);
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');

    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function calculateFileHashFromBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
