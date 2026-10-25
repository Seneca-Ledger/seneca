// Jest runs the ESM-only packages it transforms (unpdf's pdf.js bundle, the
// @nestjs packages from v12) as CommonJS. Two ESM idioms do not survive that:
// - `import.meta` is a syntax error there; only `import.meta.url` is read (to
//   locate the module), so it becomes the file URL of the module being run;
// - `const require = createRequire(import.meta.url)` shadows the CommonJS
//   `require` the transformed imports call (a TDZ error), and is not needed:
//   the module already has one.
module.exports = ({ types: t }) => ({
  visitor: {
    MemberExpression(path) {
      const { object, property } = path.node;
      if (t.isMetaProperty(object) && object.meta.name === 'import' && property.name === 'url') {
        path.replaceWithSourceString("require('url').pathToFileURL(__filename).href");
      }
    },
    VariableDeclarator(path) {
      const { id, init } = path.node;
      const isCreateRequire =
        t.isCallExpression(init) && t.isIdentifier(init.callee, { name: 'createRequire' });
      if (t.isIdentifier(id, { name: 'require' }) && isCreateRequire) {
        path.remove();
      }
    },
  },
});
