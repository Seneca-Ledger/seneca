import * as crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveUploadsDir } from '../../common/utils/uploads.util';

const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where versions live: on the uploads volume, so a version's files can be hard links. */
export function resolveVersionsRoot(): string {
  return process.env.VERSIONS_ROOT || path.join(resolveUploadsDir(), '.versions');
}

/**
 * Content-addressed storage for workspace versions. A document is stored once
 * under its sha256 however many versions hold it, and a day with no changes
 * writes nothing new. Stored files are read only: a version is a record of the
 * past, and anything that tries to change one in place fails loudly.
 */
export class VersionBlobStore {
  constructor(private readonly root: string = resolveVersionsRoot()) {}

  /** Stores a file by its content and returns its sha256. */
  async putFile(workspaceId: string, sourcePath: string): Promise<string> {
    const sha = await this.hashFile(sourcePath);
    const target = this.blobPath(workspaceId, sha);
    if (!(await this.exists(target))) {
      await this.writeOnce(target, temporary => fs.copyFile(sourcePath, temporary));
    }
    return sha;
  }

  /** Stores bytes by their content and returns their sha256. */
  async putBytes(workspaceId: string, bytes: Buffer): Promise<string> {
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    const target = this.blobPath(workspaceId, sha);
    if (!(await this.exists(target))) {
      await this.writeOnce(target, temporary => fs.writeFile(temporary, bytes, { flag: 'wx' }));
    }
    return sha;
  }

  readBytes(workspaceId: string, sha: string): Promise<Buffer> {
    return fs.readFile(this.blobPath(workspaceId, sha));
  }

  /**
   * Puts a stored file at `target` without copying it: a hard link on the same
   * volume, a copy when the target is on another one.
   */
  async linkInto(workspaceId: string, sha: string, target: string): Promise<void> {
    const source = this.blobPath(workspaceId, sha);
    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      await fs.link(source, target);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EXDEV' && code !== 'EPERM') throw error;
      await fs.copyFile(source, target);
    }
  }

  /**
   * Deletes the stored files no version refers to any more, keeping fresh ones
   * a version still being taken may be about to claim.
   */
  async collectGarbage(
    workspaceId: string,
    referenced: ReadonlySet<string>,
    graceMs = 60 * 60 * 1000,
    now = Date.now(),
  ): Promise<number> {
    const blobs = path.join(this.workspaceDir(workspaceId), 'blobs');
    let removed = 0;
    for (const prefix of await this.readDir(blobs)) {
      for (const sha of await this.readDir(path.join(blobs, prefix))) {
        if (!SHA256.test(sha) || referenced.has(sha)) continue;
        const file = path.join(blobs, prefix, sha);
        const stat = await fs.stat(file);
        if (now - stat.mtimeMs < graceMs) continue;
        await fs.rm(file, { force: true });
        removed += 1;
      }
    }
    return removed;
  }

  /** Removes everything stored for a workspace (it was deleted). */
  async removeWorkspace(workspaceId: string): Promise<void> {
    await fs.rm(this.workspaceDir(workspaceId), { recursive: true, force: true });
  }

  blobPath(workspaceId: string, sha: string): string {
    if (!SHA256.test(sha)) throw new Error('invalid blob hash');
    return path.join(this.workspaceDir(workspaceId), 'blobs', sha.slice(0, 2), sha);
  }

  private workspaceDir(workspaceId: string): string {
    if (!UUID.test(workspaceId)) throw new Error('invalid workspace id');
    return path.join(this.root, workspaceId.toLowerCase());
  }

  private async writeOnce(
    target: string,
    write: (temporary: string) => Promise<void>,
  ): Promise<void> {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${crypto.randomUUID()}.partial`;
    try {
      await write(temporary);
      await fs.chmod(temporary, 0o444);
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  private async hashFile(file: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    for await (const chunk of createReadStream(file)) {
      hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
  }

  private async exists(file: string): Promise<boolean> {
    return fs
      .access(file)
      .then(() => true)
      .catch(() => false);
  }

  private async readDir(directory: string): Promise<string[]> {
    try {
      return await fs.readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
}
