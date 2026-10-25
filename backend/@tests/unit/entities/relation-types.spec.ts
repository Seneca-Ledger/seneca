import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * Jest compiles the backend with SWC, whose CommonJS output reads imports
 * through getters. A relation property typed with the related class puts that
 * class into its decorator metadata, which is evaluated while the class is
 * being defined — with circular entity imports the other class is not
 * initialised yet (TDZ). `Relation<T>` keeps the class out of the metadata;
 * TypeORM takes the type from the decorator's `() => Entity` anyway.
 */
const RELATION_DECORATORS = new Set(['ManyToOne', 'OneToMany', 'OneToOne', 'ManyToMany']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

function unwrappedRelations(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  if (!/@(ManyToOne|OneToMany|OneToOne|ManyToMany)\(/.test(text)) {
    return [];
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyDeclaration(node) && node.type) {
      const isRelation = (ts.getDecorators(node) ?? []).some(
        decorator =>
          ts.isCallExpression(decorator.expression) &&
          RELATION_DECORATORS.has(decorator.expression.expression.getText(source)),
      );
      if (isRelation && !node.type.getText(source).startsWith('Relation<')) {
        found.push(`${path.relative(process.cwd(), file)}: ${node.name.getText(source)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('TypeORM relation properties', () => {
  it('are all typed Relation<T>', () => {
    const offenders = sourceFiles(path.join(process.cwd(), 'src')).flatMap(unwrappedRelations);

    expect(offenders).toEqual([]);
  });
});
