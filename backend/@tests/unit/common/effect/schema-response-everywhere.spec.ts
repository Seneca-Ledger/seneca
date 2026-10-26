import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * Every handler that answers JSON names its contract with @SchemaResponse, so
 * the answer is reduced to what the contract declares and checked against it.
 * Handlers that answer something else are recognised: @Res, @Redirect, @Sse, a
 * file @Header, StreamableFile, void or 204.
 */
const SRC = path.resolve(__dirname, '../../../../src');
const HTTP = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete']);

/** Class.method → why it has no contract. */
const NOT_JSON: Record<string, string> = {
  // Telegram posts its own update payloads; the answer is an ack Telegram ignores.
  'TelegramWebhookController.handleUpdate': 'third-party webhook receiver',
  'TelegramWebhookController.handleBotUpdate': 'third-party webhook receiver',
  // The GDPR export is saved as a file by the client; it carries the whole account.
  'UsersController.exportMyData': 'account export download',
};

const controllers = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return controllers(full);
    return entry.name.endsWith('.controller.ts') ? [full] : [];
  });

const decoratorName = (decorator: ts.Decorator): string => {
  const expression = ts.isCallExpression(decorator.expression)
    ? decorator.expression.expression
    : decorator.expression;
  return expression.getText();
};

const answersNoJson = (method: ts.MethodDeclaration): boolean => {
  const decorators = ts.getDecorators(method) ?? [];
  const text = decorators.map(decorator => decorator.getText()).join('\n');
  if (/@(Redirect|Sse)\(/.test(text)) return true;
  if (/@Header\(\s*['"]Content-(Type|Disposition)/.test(text)) return true;
  if (/@HttpCode\(\s*(HttpStatus\.NO_CONTENT|204)\s*\)/.test(text)) return true;
  const params = method.parameters.flatMap(param => ts.getDecorators(param) ?? []);
  if (params.some(decorator => decoratorName(decorator) === 'Res')) return true;
  const returns = method.type?.getText() ?? '';
  return /StreamableFile|^void$|^Promise<void>$/.test(returns);
};

const uncontracted = (file: string): string[] => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const names = (ts.getDecorators(member) ?? []).map(decoratorName);
        if (!names.some(name => HTTP.has(name)) || names.includes('SchemaResponse')) continue;
        const key = `${node.name.text}.${member.name.getText()}`;
        if (answersNoJson(member) || key in NOT_JSON) continue;
        found.push(`${path.relative(SRC, file)} ${key}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

describe('response contracts', () => {
  it('names a contract on every handler that answers JSON', () => {
    expect(controllers(SRC).flatMap(uncontracted)).toEqual([]);
  });
});
