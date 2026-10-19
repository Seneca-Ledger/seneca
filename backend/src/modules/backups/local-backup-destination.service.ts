import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isBackupFileName } from './backup-archive.service';

export class LocalBackupDestinationService {
  constructor(private readonly rootPath: string) {}

  async put(directory: string, fileName: string, contents: Buffer): Promise<string> {
    const targetDirectory = this.resolveDirectory(directory);
    const safeFileName = this.assertFileName(fileName);
    await fs.mkdir(targetDirectory, { recursive: true });

    const targetPath = path.join(targetDirectory, safeFileName);
    const temporaryPath = `${targetPath}.${crypto.randomUUID()}.partial`;
    try {
      await fs.writeFile(temporaryPath, contents, { flag: 'wx' });
      await fs.rename(temporaryPath, targetPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
    return path.posix.join(directory, safeFileName);
  }

  async list(directory: string): Promise<string[]> {
    const targetDirectory = this.resolveDirectory(directory);
    let entries: string[];
    try {
      entries = await fs.readdir(targetDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return entries
      .filter(isBackupFileName)
      .sort()
      .map(entry => path.posix.join(directory, entry));
  }

  async retainNewest(directory: string, keep: number): Promise<void> {
    if (!Number.isInteger(keep) || keep < 1) {
      throw new Error('backup retention must be at least one');
    }
    const snapshots = await this.list(directory);
    const stale = snapshots.slice(0, Math.max(0, snapshots.length - keep));
    await Promise.all(
      stale.map(snapshot => fs.rm(this.resolveRelativeFile(snapshot), { force: true })),
    );
  }

  private resolveDirectory(directory: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(directory)) {
      throw new Error('invalid backup path');
    }
    return this.resolveRelativeFile(directory);
  }

  private resolveRelativeFile(relativePath: string): string {
    const resolvedRoot = path.resolve(this.rootPath);
    const resolved = path.resolve(resolvedRoot, relativePath);
    if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error('invalid backup path');
    }
    return resolved;
  }

  private assertFileName(fileName: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(seneca|lumio)-backup$/.test(fileName)) {
      throw new Error('invalid backup file name');
    }
    return fileName;
  }
}
