const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

const workspaceRoot = __dirname;

const sharedDependencies = {
  react: { singleton: true, requiredVersion: '^18.3.1', eager: false },
  'react-dom': { singleton: true, requiredVersion: '^18.3.1', eager: false },
  'react-router-dom': { singleton: true, requiredVersion: '^6.28.0' },
  'radix-ui': { singleton: true },
};

const createConfig =
  ({ name, port, exposes, remotes, appDir, publicPath = 'auto' }) =>
  (_env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
      name,
      mode: isProduction ? 'production' : 'development',
      entry: path.resolve(appDir, 'src/index.ts'),
      devtool: isProduction ? 'source-map' : 'eval-source-map',
      output: {
        path: path.resolve(appDir, 'dist'),
        publicPath,
        clean: true,
      },
      resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js'],
        alias: {
          '@amm/ui': path.resolve(workspaceRoot, 'packages/ui/src'),
          '@amm/api': path.resolve(workspaceRoot, 'packages/api/src'),
        },
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            include: [
              path.resolve(appDir, 'src'),
              path.resolve(workspaceRoot, 'packages'),
            ],
            use: {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                configFile: path.resolve(workspaceRoot, 'tsconfig.build.json'),
              },
            },
          },
          {
            test: /\.css$/,
            use: ['style-loader', 'css-loader', 'postcss-loader'],
          },
        ],
      },
      plugins: [
        new ModuleFederationPlugin({
          name,
          filename: 'remoteEntry.js',
          exposes,
          remotes,
          shared: sharedDependencies,
        }),
        new HtmlWebpackPlugin({
          template: path.resolve(appDir, 'public/index.html'),
        }),
      ],
      devServer: {
        port,
        historyApiFallback: true,
        hot: false,
        liveReload: true,
        headers: { 'Access-Control-Allow-Origin': '*' },
        static: { directory: path.resolve(appDir, 'public') },
      },
      optimization: { runtimeChunk: false },
    };
  };

module.exports = { createConfig, sharedDependencies };
