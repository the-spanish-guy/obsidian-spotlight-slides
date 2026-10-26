export const stubRenderingEngines = {
  name: 'stub-rendering-engines',
  setup(build) {
    build.onResolve({ filter: /^(highlight\.js|mathjax-full|katex)(\/|$)/ }, (args) => ({
      path: args.path,
      namespace: 'stub-rendering-engines',
    }));
    build.onResolve({ filter: /^(fs|path|url|source-map-js)$/ }, (args) =>
      /[\\/]node_modules[\\/]postcss[\\/]/.test(args.importer)
        ? { path: args.path, namespace: 'stub-rendering-engines' }
        : undefined,
    );
    build.onLoad({ filter: /.*/, namespace: 'stub-rendering-engines' }, (args) => ({
      contents: args.path === 'highlight.js/lib/core'
        ? `const engine = { registerLanguage() {}, getLanguage() {} };
           module.exports = { newInstance: () => engine };
           module.exports.default = module.exports;`
        : 'module.exports = {};',
      loader: 'js',
    }));
  },
};
