import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

/**
 * Stands in for the workspace-currency lookup in unit specs.
 *
 * Returns a currency the spec names rather than reading a workspace, so a test
 * asserting "falls back to the workspace currency" can say which one that is.
 */
export function workspaceCurrencyStub(currency = 'USD') {
  return {
    resolve: jest.fn(async () => currency),
    resolveFor: jest.fn(async (_workspaceId: string, given: string | null | undefined) =>
      given?.trim() ? given.trim().toUpperCase() : currency,
    ),
  };
}

/** The same stub as a Nest provider. */
export function workspaceCurrencyProvider(currency = 'USD') {
  return { provide: WorkspaceCurrencyService, useValue: workspaceCurrencyStub(currency) };
}
