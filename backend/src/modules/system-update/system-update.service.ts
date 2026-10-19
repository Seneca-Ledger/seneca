import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Effect, Schema } from 'effect';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { describeHttpFailure, getJson } from '../../common/effect/http-json';
import { appError } from '../../common/errors/app-error';
import type { SystemUpdateRun, SystemUpdateStatus } from '../../contracts';
import { type User, UserRole } from '../../entities';

const LATEST_RELEASE_URL = 'https://api.github.com/repos/symonbaikov/seneca/releases/latest';
/** GitHub allows 60 unauthenticated requests an hour per IP; one an hour is plenty. */
const RELEASE_CACHE_MS = 60 * 60 * 1000;
/** A failed check is retried sooner, so a GitHub hiccup does not hide a release for an hour. */
const RELEASE_FAILURE_CACHE_MS = 5 * 60 * 1000;
/** The updater touches its heartbeat every 3 s. */
const HEARTBEAT_MAX_AGE_MS = 30_000;
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

const LatestRelease = Schema.Struct({ tag_name: Schema.String, html_url: Schema.String });

const RUN_STATES = ['idle', 'running', 'succeeded', 'failed'] as const;

const IDLE_RUN: SystemUpdateRun = {
  state: 'idle',
  tag: null,
  step: null,
  message: null,
  backup: null,
  startedAt: null,
  finishedAt: null,
};

type Release = { tag: string; url: string };

/** -1, 0 or 1; null when either side is not a `vX.Y.Z` release tag. */
export function compareReleaseTags(a: string, b: string): number | null {
  const left = RELEASE_TAG.exec(a);
  const right = RELEASE_TAG.exec(b);
  if (!(left && right)) {
    return null;
  }
  for (let i = 1; i <= 3; i++) {
    const diff = Number(left[i]) - Number(right[i]);
    if (diff !== 0) {
      return Math.sign(diff);
    }
  }
  return 0;
}

/**
 * The Settings side of `make upgrade`. The backend cannot touch Docker; it
 * hands a release tag to the updater container through a shared volume
 * (`infra/updater/updater.sh`) and reads back the progress it writes.
 */
@Injectable()
export class SystemUpdateService {
  private readonly logger = new Logger(SystemUpdateService.name);
  private readonly updateDir = process.env.UPDATE_DIR || path.join(process.cwd(), 'update');
  private release: { value: Release | null; fetchedAt: number } | null = null;

  constructor(private readonly effects: EffectRuntime) {}

  async getStatus(user: User): Promise<SystemUpdateStatus> {
    this.assertInstanceAdmin(user);
    const [release, updaterAvailable, run] = await Promise.all([
      this.latestRelease(),
      this.isUpdaterRunning(),
      this.readRun(),
    ]);
    const current = process.env.APP_VERSION?.trim() || '';
    const currentVersion = RELEASE_TAG.test(current) ? current : null;
    const updateAvailable =
      !!currentVersion && !!release && compareReleaseTags(release.tag, currentVersion) === 1;

    return {
      currentVersion,
      latestVersion: release?.tag ?? null,
      releaseUrl: release?.url ?? null,
      updateAvailable,
      updaterAvailable,
      run,
    };
  }

  async requestUpdate(user: User): Promise<SystemUpdateStatus> {
    const status = await this.getStatus(user);
    if (!status.updaterAvailable) {
      throw new ConflictException(appError('SYSTEM_UPDATER_UNAVAILABLE'));
    }
    if (status.run.state === 'running') {
      throw new ConflictException(appError('SYSTEM_UPDATE_IN_PROGRESS'));
    }
    const tag = status.latestVersion;
    if (!(status.updateAvailable && tag)) {
      throw new ConflictException(appError('SYSTEM_UPDATE_NOT_AVAILABLE'));
    }

    try {
      // `wx` fails when a request is already waiting for the updater.
      await fs.writeFile(this.requestPath(), `${tag}\n`, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new ConflictException(appError('SYSTEM_UPDATE_IN_PROGRESS'));
      }
      throw error;
    }
    this.logger.log(`Update to ${tag} requested by user ${user.id}`);

    return { ...status, run: this.queuedRun(tag) };
  }

  private assertInstanceAdmin(user: User): void {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(appError('SYSTEM_UPDATE_ADMIN_ONLY'));
    }
  }

  private requestPath(): string {
    return path.join(this.updateDir, 'request');
  }

  private queuedRun(tag: string): SystemUpdateRun {
    return { ...IDLE_RUN, state: 'running', tag, step: 'queued' };
  }

  private async isUpdaterRunning(): Promise<boolean> {
    try {
      const { mtimeMs } = await fs.stat(path.join(this.updateDir, 'heartbeat'));
      return Date.now() - mtimeMs < HEARTBEAT_MAX_AGE_MS;
    } catch {
      return false;
    }
  }

  /** The updater's status file; a request it has not picked up yet counts as running. */
  private async readRun(): Promise<SystemUpdateRun> {
    const pending = await fs.readFile(this.requestPath(), 'utf8').catch(() => null);
    if (pending !== null) {
      return this.queuedRun(pending.trim());
    }

    const raw = await fs
      .readFile(path.join(this.updateDir, 'status.json'), 'utf8')
      .catch(() => null);
    if (raw === null) {
      return IDLE_RUN;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('Updater status file is not valid JSON');
      return IDLE_RUN;
    }
    const text = (key: string): string | null => {
      const value = parsed[key];
      return typeof value === 'string' && value !== '' ? value : null;
    };
    const state = RUN_STATES.find(candidate => candidate === parsed.state) ?? 'idle';
    return {
      state,
      tag: text('tag'),
      step: text('step'),
      message: text('message'),
      backup: text('backup'),
      startedAt: text('startedAt'),
      finishedAt: text('finishedAt'),
    };
  }

  private async latestRelease(): Promise<Release | null> {
    if (this.release) {
      const ttl = this.release.value ? RELEASE_CACHE_MS : RELEASE_FAILURE_CACHE_MS;
      if (Date.now() - this.release.fetchedAt < ttl) {
        return this.release.value;
      }
    }
    const value = await this.effects.run(
      getJson(LATEST_RELEASE_URL, LatestRelease, {
        timeout: '5 seconds',
        headers: { accept: 'application/vnd.github+json' },
      }).pipe(
        Effect.map(release => ({ tag: release.tag_name, url: release.html_url })),
        Effect.catch(error =>
          Effect.sync(() => {
            // 404 until the first release is published.
            this.logger.warn(`Latest release check failed: ${describeHttpFailure(error)}`);
            return null;
          }),
        ),
      ),
    );
    this.release = { value, fetchedAt: Date.now() };
    return value;
  }
}
