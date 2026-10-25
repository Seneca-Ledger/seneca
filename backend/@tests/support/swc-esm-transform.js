// Jest runs the ESM-only packages it transforms as CommonJS. SWC turns their
// import/export, import(), import.meta.url and a local `require` (renamed, so
// @nestjs/typeorm's `const require = createRequire(...)` no longer shadows the
// module's own) into CommonJS. The one thing it leaves is `import.meta.env`,
// which effect's ConfigProvider spreads next to process.env; it becomes
// `undefined` here, as it is under Node.
const { createTransformer } = require('@swc/jest');

const withoutImportMetaEnv = src => src.replace(/import\.meta\??\.env\b/g, 'undefined');

/**
 * `isModule: 'unknown'` (the default here) leaves a package's CommonJS files as
 * they are; `true` is for a CommonJS file that itself calls import() (unpdf's
 * index.cjs), which then becomes a require.
 */
module.exports = {
  createTransformer({ isModule = 'unknown' } = {}) {
    const swc = createTransformer({
      isModule,
      jsc: { parser: { syntax: 'ecmascript' }, target: 'es2022' },
      module: { type: 'commonjs' },
    });
    return {
      ...swc,
      process: (src, filename, options) => swc.process(withoutImportMetaEnv(src), filename, options),
      getCacheKey: (src, ...rest) => swc.getCacheKey(withoutImportMetaEnv(src), ...rest),
    };
  },
};
