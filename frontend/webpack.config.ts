import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import webpack from 'webpack';
import type { Configuration } from 'webpack';
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';
import { config as dotenvConfig } from 'dotenv';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

// Load environment variables from .env file
dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Webpack config including devServer (typed via webpack-dev-server) */
type WebpackConfig = Configuration & { devServer?: DevServerConfiguration };

const config: WebpackConfig = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].chunk.js',
    clean: true,
    publicPath: '/',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs'],
    modules: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../node_modules'),
      path.resolve(__dirname, '../shared'),
      'node_modules',
    ],
    fallback: {
      fs: false,
      path: false,
    },
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@graphql': path.resolve(__dirname, 'src/graphql'),
      '@theme': path.resolve(__dirname, 'src/theme'),
      '@my-money/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  experiments: {
    topLevelAwait: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
        include: [path.resolve(__dirname, 'src'), path.resolve(__dirname, '../shared/src')],
      },
      {
        test: /\.m?js$/,
        include: /node_modules\/@mui\/x-date-pickers/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      inject: true,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public',
          to: '.',
          globOptions: {
            ignore: ['**/index.html'],
          },
        },
      ],
    }),
    // Add bundle analyzer only when ANALYZE environment variable is set
    ...(process.env.ANALYZE === 'true'
      ? [
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'bundle-report.html',
          }),
        ]
      : []),
    new webpack.DefinePlugin({
      'process.env.REACT_APP_GRAPHQL_URL': JSON.stringify(
        process.env.REACT_APP_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
      ),
      'process.env.REACT_APP_OPENID_DISCOVERY_URL': JSON.stringify(
        process.env.REACT_APP_OPENID_DISCOVERY_URL
      ),
      'process.env.REACT_APP_OPENID_CLIENT_ID': JSON.stringify(
        process.env.REACT_APP_OPENID_CLIENT_ID
      ),
      // SECURITY: Client secrets should NEVER be exposed in frontend code
      // REACT_APP_OPENID_CLIENT_SECRET removed - use backend proxy for OIDC flows
      'process.env': JSON.stringify({
        REACT_APP_GRAPHQL_URL: process.env.REACT_APP_GRAPHQL_URL ?? 'http://localhost:4000/graphql',
        REACT_APP_OPENID_DISCOVERY_URL: process.env.REACT_APP_OPENID_DISCOVERY_URL,
        REACT_APP_OPENID_CLIENT_ID: process.env.REACT_APP_OPENID_CLIENT_ID,
        // REACT_APP_OPENID_CLIENT_SECRET intentionally omitted for security
      }),
    }),
  ],
  optimization: {
    moduleIds: 'deterministic',
    runtimeChunk: 'single', // Extract runtime to separate chunk for better caching
    splitChunks: {
      chunks: 'all',
      minSize: 20000, // Minimum chunk size (20KB) to avoid too many small chunks
      maxSize: 244000, // Maximum chunk size (244KB) for better caching
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'react-vendor',
          priority: 20,
          reuseExistingChunk: true,
        },
        mui: {
          test: /[\\/]node_modules[\\/]@mui[\\/]/,
          name: 'mui-vendor',
          priority: 15,
          reuseExistingChunk: true,
        },
        apollo: {
          test: /[\\/]node_modules[\\/]@apollo[\\/]/,
          name: 'apollo-vendor',
          priority: 15,
          reuseExistingChunk: true,
        },
        recharts: {
          test: /[\\/]node_modules[\\/]recharts[\\/]/,
          name: 'recharts-vendor',
          priority: 15,
          reuseExistingChunk: true,
        },
        datePickers: {
          test: /[\\/]node_modules[\\/]@mui[\\/]x-date-pickers[\\/]/,
          name: 'date-pickers-vendor',
          priority: 15,
          reuseExistingChunk: true,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    usedExports: true, // Enable tree-shaking
    sideEffects: false, // Mark as side-effect free for better tree-shaking
    minimize: process.env.NODE_ENV === 'production',
  },
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'public'),
      },
      {
        directory: path.join(__dirname, 'dist'),
        publicPath: '/',
      },
    ],
    compress: true,
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },
};

export default config;
