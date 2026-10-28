/**
 * Where shared layouts go. The project's Worker by default
 * (infra/parser-submissions); an instance can point elsewhere or turn sharing
 * off with PARSER_SUBMISSIONS_ENABLED=false, which also hides the offer.
 */
const DEFAULT_URL = '';
const DEFAULT_EMAIL = 'peterbaikov12@proton.me';

export interface LayoutShareConfig {
  enabled: boolean;
  /** Empty: no Worker to send to, the user is offered an e-mail instead. */
  url: string;
  email: string;
}

export function layoutShareConfig(env: NodeJS.ProcessEnv = process.env): LayoutShareConfig {
  return {
    enabled: env.PARSER_SUBMISSIONS_ENABLED?.trim().toLowerCase() !== 'false',
    // Tests never reach the project's Worker unless a test points them at one.
    url: env.PARSER_SUBMISSIONS_URL?.trim() ?? (env.NODE_ENV === 'test' ? '' : DEFAULT_URL),
    email: env.PARSER_SUBMISSIONS_EMAIL?.trim() || DEFAULT_EMAIL,
  };
}
