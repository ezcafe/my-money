/**
 * Type declaration for graphql-depth-limit
 */
declare module 'graphql-depth-limit' {
  import type {ValidationRule} from 'graphql';

  /**
   * Create a depth limit validation rule
   * @param maxDepth - Maximum allowed depth
   * @param options - Options for depth limiting
   * @returns Validation rule
   */
  function depthLimit(
    maxDepth: number,
    options?: {ignore?: string[]},
  ): ValidationRule;

  export default depthLimit;
}
