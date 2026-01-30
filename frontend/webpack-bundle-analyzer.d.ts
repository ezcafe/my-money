/**
 * Type declaration for webpack-bundle-analyzer (no @types package)
 */
declare module 'webpack-bundle-analyzer' {
  import type { Compiler } from 'webpack';

  export interface BundleAnalyzerPluginOptions {
    analyzerMode?: 'server' | 'static' | 'disabled';
    openAnalyzer?: boolean;
    reportFilename?: string;
  }

  export class BundleAnalyzerPlugin {
    constructor(options?: BundleAnalyzerPluginOptions);
    apply(compiler: Compiler): void;
  }
}
