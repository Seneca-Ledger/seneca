import { PERMISSIONS_KEY } from '@/common/decorators/require-permission.decorator';
import { Permission } from '@/common/enums/permissions.enum';
import { CategoriesController } from '@/modules/categories/categories.controller';
import { toToolInputSchema } from '@/modules/mcp/mcp-json-schema';
import { McpToolRegistry } from '@/modules/mcp/mcp-tool-registry.service';
import { TransactionsController } from '@/modules/transactions/transactions.controller';

const registry = new McpToolRegistry({} as never, {} as never, {} as never);

/** The REST route each tool stands in for: the tool must ask for what the route asks for. */
const ROUTES: Record<string, [{ prototype: object }, string]> = {
  list_transactions: [TransactionsController, 'findAll'],
  get_transaction: [TransactionsController, 'findOne'],
  list_categories: [CategoriesController, 'findAll'],
};

/** Routes with no permission of their own (membership only): the tool picks the nearest one. */
const UNGUARDED_ROUTES: Record<string, Permission[]> = {
  get_dashboard: [Permission.REPORT_VIEW],
};

describe('McpToolRegistry', () => {
  it('maps every tool to a REST route, or names the permission it stands in with', () => {
    expect(registry.tools.map(tool => tool.name).sort()).toEqual(
      [...Object.keys(ROUTES), ...Object.keys(UNGUARDED_ROUTES)].sort(),
    );
  });

  it.each(Object.entries(ROUTES))('%s asks for what its REST route asks for', (name, route) => {
    const [controller, method] = route;
    const handler = (controller.prototype as Record<string, unknown>)[method] as object;
    const routePermissions = Reflect.getMetadata(PERMISSIONS_KEY, handler);

    expect(routePermissions?.length).toBeGreaterThan(0);
    expect([...(registry.find(name)?.permissions ?? [])].sort()).toEqual(
      [...routePermissions].sort(),
    );
  });

  it.each(Object.entries(UNGUARDED_ROUTES))('%s asks for %j', (name, permissions) => {
    expect(registry.find(name)?.permissions).toEqual(permissions);
  });

  it.each(registry.tools.map(tool => [tool.name, tool] as const))(
    '%s describes its arguments as a closed object with no dangling references',
    (_name, tool) => {
      const schema = toToolInputSchema(tool.input);
      expect(schema.type).toBe('object');
      expect(schema.additionalProperties).toBe(false);
      const refs = JSON.stringify(schema).match(/"\$ref":"[^"]+"/g) ?? [];
      const defs = Object.keys((schema.$defs as Record<string, unknown>) ?? {});
      for (const ref of refs) {
        expect(defs.some(def => ref.endsWith(`/${def}"`))).toBe(true);
      }
    },
  );

  it('has a description on every tool', () => {
    for (const tool of registry.tools) {
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });
});
