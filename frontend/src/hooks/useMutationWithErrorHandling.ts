/**
 * Mutation with Error Handling Hook
 * Provides standardized error handling for mutations
 */

import {useMutation, type MutationHookOptions, type MutationTuple} from '@apollo/client/react';
import type {OperationVariables} from '@apollo/client';
import {useNotifications} from '../contexts/NotificationContext';
import {getUserFriendlyErrorMessage} from '../utils/errorNotification';
import type {DocumentNode} from 'graphql';

/**
 * Options for mutation with error handling
 */
interface UseMutationWithErrorHandlingOptions<TData, TVariables extends OperationVariables> extends Omit<MutationHookOptions<TData, TVariables>, 'onError'> {
  /** Success message to show on completion */
  successMessage?: string;
  /** Custom error handler (optional) */
  onError?: (error: unknown) => void;
  /** Whether to show success notification (default: true) */
  showSuccess?: boolean;
  /** Whether to show error notification (default: true) */
  showError?: boolean;
}

/**
 * Hook for mutations with standardized error handling
 * @param mutation - GraphQL mutation
 * @param options - Mutation options with error handling
 * @returns Mutation tuple with error handling
 */
export function useMutationWithErrorHandling<TData = unknown, TVariables extends OperationVariables = OperationVariables>(
  mutation: DocumentNode,
  options: UseMutationWithErrorHandlingOptions<TData, TVariables> = {},
): MutationTuple<TData, TVariables> {
  const {showSuccessNotification, showErrorNotification} = useNotifications();
  const {
    successMessage,
    onError: customOnError,
    showSuccess = true,
    showError = true,
    onCompleted,
    ...mutationOptions
  } = options;

  const [mutate, result] = useMutation<TData, TVariables>(mutation, {
    ...mutationOptions,
    onError: (error) => {
      // Call custom error handler if provided
      if (customOnError) {
        customOnError(error);
      }

      // Show error notification
      if (showError) {
        const errorMessage = getUserFriendlyErrorMessage(error);
        showErrorNotification(errorMessage);
      }
    },
    onCompleted: (data) => {
      // Show success notification
      if (showSuccess && successMessage) {
        showSuccessNotification(successMessage);
      }

      // Call original onCompleted if provided
      if (onCompleted) {
        onCompleted(data);
      }
    },
  });

  return [mutate, result] as MutationTuple<TData, TVariables>;
}

