const path = require('path');

module.exports = {
    entry: './src/example.ts',
    module: {
    rules: [
        {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
        }
    ]
    },
    resolve: {
        extensions: [ '.ts', '.tsx', '.js' ]
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    }
};