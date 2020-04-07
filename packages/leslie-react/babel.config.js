const { BABEL_ENV } = process.env;

module.exports = {
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
