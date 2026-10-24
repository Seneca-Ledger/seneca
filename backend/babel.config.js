// Jest runs everything as CommonJS, where `import.meta` is a syntax error.
// effect's ConfigProvider.fromEnv spreads `import.meta?.env` next to
// process.env, so an empty object keeps its behaviour under Node.
const importMetaToEmptyObject = ({ types: t }) => ({
  visitor: {
    MetaProperty(path) {
      if (path.node.meta.name === 'import') path.replaceWith(t.objectExpression([]));
    },
  },
});

module.exports = {
  // Class fields are assigned, as tsc emits them: defined fields would replace
  // the accessors legacy decorators (TypeORM, class-validator) put on the prototype.
  assumptions: { setPublicClassFields: true },
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    // Babel 8 keeps `declare` fields out of the output by default.
    '@babel/preset-typescript',
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
    '@babel/plugin-transform-class-properties',
    'babel-plugin-transform-typescript-metadata',
    importMetaToEmptyObject,
  ],
};
