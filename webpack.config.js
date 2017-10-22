module.exports = {
  entry: './src/index.js',
  output: {
    library: 'Iterffect'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'babel-loader'
      }
    ]
  }
}
