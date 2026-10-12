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
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-typescript', { allowDeclareFields: true }],
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    'babel-plugin-transform-typescript-metadata',
    importMetaToEmptyObject,
  ],
};
