import { SetMetadata } from '@nestjs/common';

export const API_KEY_ALLOWED_KEY = 'apiKeyAllowed';

/**
 * Lets a scoped API key reach a route that declares no permission, because the
 * route checks the key's scopes itself (the MCP endpoint, per tool). Every
 * other such route refuses scoped keys: see `JwtAuthGuard`.
 */
export const ApiKeyAllowed = () => SetMetadata(API_KEY_ALLOWED_KEY, true);
