/**
 * Page Wrapper Hook
 * Provides reusable page wrapper logic for common page patterns
 */

import {useCallback, type ReactNode} from 'react';
import {useParams} from 'react-router';
import {Layout} from '../components/common/Layout';
import {useNavigationWithReturn} from './useNavigationWithReturn';
import {useDeleteConfirmation} from './useDeleteConfirmation';
import {useMutationWithErrorHandling} from './useMutationWithErrorHandling';
import type {DocumentNode} from 'graphql';

/**
 * Options for page wrapper
 */
interface UsePageWrapperOptions {
  /** Page title */
  title: string;
  /** Default return URL */
  defaultReturnUrl: string;
  /** Edit path pattern (e.g., '/accounts/{id}/edit') */
  editPath?: string;
  /** Delete mutation */
  deleteMutation?: DocumentNode;
  /** Delete mutation variables getter */
  getDeleteVariables?: (id: string) => unknown;
  /** Refetch queries after delete */
  refetchQueries?: string[];
  /** Delete dialog title */
  deleteTitle?: string;
  /** Delete dialog message */
  deleteMessage?: string;
  /** Whether to hide search */
  hideSearch?: boolean;
  /** Action button */
  actionButton?: {
    icon: ReactNode;
    onClick: () => void;
    ariaLabel: string;
  };
  /** Whether delete is disabled */
  disableDelete?: boolean;
}

/**
 * Return type for usePageWrapper hook
 */
interface UsePageWrapperReturn {
  /** Layout component with context menu */
  PageLayout: (props: {children: ReactNode}) => React.JSX.Element;
  /** Delete confirmation dialog */
  DeleteDialog: React.JSX.Element;
  /** Navigate to edit page */
  handleEdit: () => void;
  /** Navigate back */
  navigateBack: () => void;
}

/**
 * Hook for page wrapper with common functionality
 * @param options - Page wrapper options
 * @returns Page wrapper components and handlers
 */
export function usePageWrapper(options: UsePageWrapperOptions): UsePageWrapperReturn {
  const {
    title,
    defaultReturnUrl,
    editPath,
    deleteMutation,
    getDeleteVariables,
    refetchQueries = [],
    deleteTitle = 'Delete',
    deleteMessage = 'Are you sure you want to delete this item? This action cannot be undone.',
    hideSearch = false,
    actionButton,
    disableDelete = false,
  } = options;

  const {id} = useParams<{id: string}>();
  const {navigate, navigateBack} = useNavigationWithReturn({defaultReturnUrl});

  // Delete mutation with error handling
  // Note: We always call the hook to satisfy React hooks rules, but only use it if deleteMutation is provided
  const deleteMutationToUse = deleteMutation ?? ({kind: 'Document', definitions: []} as DocumentNode);
  const [deleteEntity, deleteResult] = useMutationWithErrorHandling(deleteMutationToUse, {
    refetchQueries,
    awaitRefetchQueries: true,
    successMessage: 'Item deleted successfully',
    onCompleted: () => {
      navigateBack({replace: true});
    },
  });

  const deleting = (deleteMutation ? deleteResult.loading : false) ?? false;

  const handleEdit = useCallback(() => {
    if (id && editPath) {
      const editUrl = editPath.replace('{id}', id);
      navigate(editUrl);
    }
  }, [id, editPath, navigate]);

  const handleDelete = useCallback(() => {
    if (id && getDeleteVariables && deleteEntity && deleteMutation) {
      void deleteEntity({variables: getDeleteVariables(id) as Record<string, unknown>});
    }
  }, [id, getDeleteVariables, deleteEntity, deleteMutation]);

  // Delete confirmation
  const {openDialog: openDeleteDialog, DeleteDialog} = useDeleteConfirmation({
    title: deleteTitle,
    message: deleteMessage,
    deleting,
    onConfirm: handleDelete,
  });

  const PageLayout = useCallback(
    ({children}: {children: ReactNode}): React.JSX.Element => {
      return (
        <Layout
          title={title}
          hideSearch={hideSearch}
          actionButton={actionButton}
          contextMenu={
            editPath || deleteMutation
              ? {
                  onEdit: editPath ? handleEdit : (): void => {
                    // No-op if edit path not provided
                  },
                  onDelete: deleteMutation ? openDeleteDialog : (): void => {
                    // No-op if delete mutation not provided
                  },
                  disableDelete,
                }
              : undefined
          }
        >
          {children}
        </Layout>
      );
    },
    [title, hideSearch, actionButton, editPath, deleteMutation, handleEdit, openDeleteDialog, disableDelete],
  );

  return {
    PageLayout,
    DeleteDialog,
    handleEdit,
    navigateBack,
  };
}

