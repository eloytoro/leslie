const { BABEL_ENV, NODE_ENV } = process.env;

module.exports = {
  ignore: NODE_ENV !== 'test' ? ['**/*.test.js'] : [],
  presets: [
    ['@babel/preset-env', {
      modules: BABEL_ENV === 'esm' ? false : 'commonjs',
      targets: {
        browsers: ['last 2 versions', 'safari >= 7']
      },
    }]
  ],
  plugins: [
    '@babel/plugin-transform-runtime'
  ]
};
