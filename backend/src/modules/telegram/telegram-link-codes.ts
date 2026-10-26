import { createHash, randomBytes } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/** How long a link from the Connect button stays usable. */
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;

/** Who pressed Connect, where, and for which bot (the token's numeric prefix). */
export interface LinkCodeClaim {
  userId: string;
  workspaceId: string;
  botId: string;
}

// 24 random bytes are 32 base64url characters; Telegram takes up to 64 of [A-Za-z0-9_-].
const CODE_PATTERN = /^[\w-]{32}$/;

const cacheKey = (code: string) =>
  `telegram:link:${createHash('sha256').update(code).digest('hex')}`;

/**
 * One-time codes behind the `t.me/<bot>?start=<code>` links. Telegram hands
 * the code back with /start, which proves the chat belongs to whoever pressed
 * Connect, so nobody has to find and type a chat id.
 */
@Injectable()
export class TelegramLinkCodes {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async issue(claim: LinkCodeClaim): Promise<{ code: string; expiresAt: Date }> {
    const code = randomBytes(24).toString('base64url');
    await this.cache.set(cacheKey(code), claim, LINK_CODE_TTL_MS);
    return { code, expiresAt: new Date(Date.now() + LINK_CODE_TTL_MS) };
  }

  /** The claim behind a code, once: the code is gone after this. */
  async take(code: string): Promise<LinkCodeClaim | null> {
    if (!CODE_PATTERN.test(code)) {
      return null;
    }
    const claim = await this.cache.get<LinkCodeClaim>(cacheKey(code));
    if (!claim) {
      return null;
    }
    await this.cache.del(cacheKey(code));
    return claim;
  }
}
