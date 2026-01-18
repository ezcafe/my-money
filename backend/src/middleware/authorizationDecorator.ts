/**
 * Authorization Decorators
 * Provides decorator-based authorization for GraphQL resolvers
 * Simplifies authorization checks by applying decorators to methods
 */

import type {GraphQLContext} from './context';
import {requireWorkspaceAccess, requireWorkspacePermission} from './authorization';
import type {WorkspaceRole} from '@prisma/client';
import {getUserDefaultWorkspace} from '../services/WorkspaceService';

/**
 * Metadata key for storing authorization requirements
 */
const AUTHORIZATION_METADATA_KEY = Symbol('authorization');

/**
 * Authorization metadata interface
 */
interface AuthorizationMetadata {
  requireWorkspaceAccess?: boolean;
  requiredRole?: WorkspaceRole;
  workspaceIdResolver?: (args: unknown, context: GraphQLContext) => Promise<string> | string;
}

/**
 * Set authorization metadata on target
 */
function setAuthorizationMetadata(
  target: object,
  propertyKey: string,
  metadata: AuthorizationMetadata,
): void {
  Reflect.defineMetadata(AUTHORIZATION_METADATA_KEY, metadata, target, propertyKey);
}

/**
 * Require workspace access decorator
 * Ensures the user has access to the workspace before executing the resolver
 * @param workspaceIdResolver - Optional function to extract workspaceId from args/context
 * @returns Method decorator
 */
export function RequireWorkspaceAccess(
  workspaceIdResolver?: (args: unknown, context: GraphQLContext) => Promise<string> | string,
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): void {
    const originalMethod = descriptor.value as (
      parent: unknown,
      args: unknown,
      context: GraphQLContext,
    ) => Promise<unknown>;

    setAuthorizationMetadata(target, propertyKey, {
      requireWorkspaceAccess: true,
      workspaceIdResolver,
    });

    descriptor.value = async function (
      this: unknown,
      parent: unknown,
      args: unknown,
      context: GraphQLContext,
    ): Promise<unknown> {
      // Resolve workspace ID
      let workspaceId: string;
      if (workspaceIdResolver) {
        const resolved = workspaceIdResolver(args, context);
        workspaceId = typeof resolved === 'string' ? resolved : await Promise.resolve(resolved);
      } else {
        // Default: get from context or user's default workspace
        workspaceId = context.currentWorkspaceId ?? await getUserDefaultWorkspace(context.userId);
      }

      // Check workspace access
      await requireWorkspaceAccess(workspaceId, context.userId, context);

      // Execute original method
      return originalMethod.call(this, parent, args, context);
    } as typeof originalMethod;
  };
}

/**
 * Require workspace role decorator
 * Ensures the user has the required role in the workspace
 * @param requiredRole - Minimum required role (Owner, Admin, or Member)
 * @param workspaceIdResolver - Optional function to extract workspaceId from args/context
 * @returns Method decorator
 */
export function RequireRole(
  requiredRole: WorkspaceRole,
  workspaceIdResolver?: (args: unknown, context: GraphQLContext) => Promise<string> | string,
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): void {
    const originalMethod = descriptor.value as (
      parent: unknown,
      args: unknown,
      context: GraphQLContext,
    ) => Promise<unknown>;

    setAuthorizationMetadata(target, propertyKey, {
      requireWorkspaceAccess: true,
      requiredRole,
      workspaceIdResolver,
    });

    descriptor.value = async function (
      this: unknown,
      parent: unknown,
      args: unknown,
      context: GraphQLContext,
    ): Promise<unknown> {
      // Resolve workspace ID
      let workspaceId: string;
      if (workspaceIdResolver) {
        const resolved = workspaceIdResolver(args, context);
        workspaceId = typeof resolved === 'string' ? resolved : await Promise.resolve(resolved);
      } else {
        // Default: get from context or user's default workspace
        workspaceId = context.currentWorkspaceId ?? await getUserDefaultWorkspace(context.userId);
      }

      // Check workspace permission
      await requireWorkspacePermission(workspaceId, context.userId, requiredRole, context);

      // Execute original method
      return originalMethod.call(this, parent, args, context);
    } as typeof originalMethod;
  };
}

/**
 * Helper to extract workspaceId from input args
 * Common pattern: input.workspaceId or args.workspaceId
 */
export function getWorkspaceIdFromInput(args: unknown): string | undefined {
  if (args && typeof args === 'object' && 'input' in args) {
    const input = (args as {input?: {workspaceId?: string}}).input;
    return input?.workspaceId;
  }
  if (args && typeof args === 'object' && 'workspaceId' in args) {
    return (args as {workspaceId?: string}).workspaceId;
  }
  return undefined;
}
