/**
 * Page Wrapper Components
 * Wraps page components with navigation functionality and layout
 */

import React, {useState, useCallback} from 'react';
import {useNavigate, useParams} from 'react-router';
import {useMutation} from '@apollo/client/react';
import {Add} from '@mui/icons-material';
import {Layout} from '../common/Layout';
import {DeleteConfirmDialog} from '../common/DeleteConfirmDialog';
import {DELETE_ACCOUNT, DELETE_CATEGORY, DELETE_PAYEE, DELETE_BUDGET} from '../../graphql/mutations';
import {useAccount} from '../../hooks/useAccount';
import {useCategory} from '../../hooks/useCategory';
import {usePayee} from '../../hooks/usePayee';

// Lazy loaded page components
const SchedulePage = React.lazy(() => import('../../pages/SchedulePage').then((m) => ({default: m.SchedulePage})));
const BudgetsPage = React.lazy(() => import('../../pages/BudgetsPage').then((m) => ({default: m.BudgetsPage})));
const AccountDetailsPage = React.lazy(() => import('../../pages/AccountDetailsPage').then((m) => ({default: m.AccountDetailsPage})));
const CategoryDetailsPage = React.lazy(() => import('../../pages/CategoryDetailsPage').then((m) => ({default: m.CategoryDetailsPage})));
const AccountsPage = React.lazy(() => import('../../pages/AccountsPage').then((m) => ({default: m.AccountsPage})));
const PayeesPage = React.lazy(() => import('../../pages/PayeesPage').then((m) => ({default: m.PayeesPage})));
const CategoriesPage = React.lazy(() => import('../../pages/CategoriesPage').then((m) => ({default: m.CategoriesPage})));
const PayeeDetailsPage = React.lazy(() => import('../../pages/PayeeDetailsPage').then((m) => ({default: m.PayeeDetailsPage})));
const BudgetDetailsPage = React.lazy(() => import('../../pages/BudgetDetailsPage').then((m) => ({default: m.BudgetDetailsPage})));

/**
 * Schedule Page Wrapper
 * Wraps SchedulePage with navigation functionality
 */
export function SchedulePageWrapper(): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <Layout
      title="Schedule"
      hideSearch
      actionButton={{
        icon: <Add />,
        onClick: () => {
          void navigate('/transactions/add?returnTo=/schedule');
        },
        ariaLabel: 'Add Recurring Transaction',
      }}
    >
      <SchedulePage />
    </Layout>
  );
}

/**
 * Budgets Page Wrapper
 * Wraps BudgetsPage with navigation functionality
 */
export function BudgetsPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <Layout
      title="Budgets"
      hideSearch
      actionButton={{
        icon: <Add />,
        onClick: () => {
          void navigate('/budgets/add?returnTo=/budgets');
        },
        ariaLabel: 'Create Budget',
      }}
    >
      <BudgetsPage />
    </Layout>
  );
}

/**
 * Account Details Page Wrapper
 * Wraps AccountDetailsPage with context menu for edit/delete
 */
export function AccountDetailsPageWrapper(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const {account} = useAccount(id);
  const [deleteAccount, {loading: deleting}] = useMutation(DELETE_ACCOUNT, {
    refetchQueries: ['GetAccounts'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void navigate('/accounts');
    },
  });

  const handleEdit = useCallback(() => {
    if (id) {
      void navigate(`/accounts/${id}/edit?returnTo=/accounts/${id}`);
    }
  }, [id, navigate]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (id) {
      void deleteAccount({variables: {id}});
    }
  }, [id, deleteAccount]);

  return (
    <>
      <Layout
        contextMenu={{
          onEdit: handleEdit,
          onDelete: handleDelete,
          disableDelete: account?.isDefault ?? false,
        }}
      >
        <AccountDetailsPage />
      </Layout>
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Account"
        message="Are you sure you want to delete this account? This action cannot be undone."
        deleting={deleting}
      />
    </>
  );
}

/**
 * Category Details Page Wrapper
 * Wraps CategoryDetailsPage with context menu for edit/delete
 */
export function CategoryDetailsPageWrapper(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const {category} = useCategory(id);
  const [deleteCategory, {loading: deleting}] = useMutation(DELETE_CATEGORY, {
    refetchQueries: ['GetCategories'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void navigate('/categories');
    },
  });

  const handleEdit = useCallback(() => {
    if (id) {
      void navigate(`/categories/${id}/edit?returnTo=/categories/${id}`);
    }
  }, [id, navigate]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (id) {
      void deleteCategory({variables: {id}});
    }
  }, [id, deleteCategory]);

  return (
    <>
      <Layout
        contextMenu={{
          onEdit: handleEdit,
          onDelete: handleDelete,
          disableDelete: category?.isDefault ?? false,
        }}
      >
        <CategoryDetailsPage />
      </Layout>
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message="Are you sure you want to delete this category? This action cannot be undone."
        deleting={deleting}
      />
    </>
  );
}

/**
 * Accounts Page Wrapper
 * Wraps AccountsPage with add button
 */
export function AccountsPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();

  const handleAdd = useCallback(() => {
    // Use replace to avoid adding the add page to history
    // This way, when we navigate back after creation, we can replace it
    void navigate('/accounts/add?returnTo=/accounts', {replace: true});
  }, [navigate]);

  return (
    <Layout
      title="Accounts"
      hideSearch
      actionButton={{
        icon: <Add />,
        onClick: handleAdd,
        ariaLabel: 'Add Account',
      }}
    >
      <AccountsPage />
    </Layout>
  );
}

/**
 * Payees Page Wrapper
 * Wraps PayeesPage with add button
 */
export function PayeesPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();

  const handleAdd = useCallback(() => {
    // Use replace to avoid adding the add page to history
    // This way, when we navigate back after creation, we can replace it
    void navigate('/payees/add?returnTo=/payees', {replace: true});
  }, [navigate]);

  return (
    <Layout
      title="Payees"
      hideSearch
      actionButton={{
        icon: <Add />,
        onClick: handleAdd,
        ariaLabel: 'Add Payee',
      }}
    >
      <PayeesPage />
    </Layout>
  );
}

/**
 * Categories Page Wrapper
 * Wraps CategoriesPage with add button
 */
export function CategoriesPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();

  const handleAdd = useCallback(() => {
    // Use replace to avoid adding the add page to history
    // This way, when we navigate back after creation, we can replace it
    void navigate('/categories/add?returnTo=/categories', {replace: true});
  }, [navigate]);

  return (
    <Layout
      title="Categories"
      hideSearch
      actionButton={{
        icon: <Add />,
        onClick: handleAdd,
        ariaLabel: 'Add Category',
      }}
    >
      <CategoriesPage />
    </Layout>
  );
}

/**
 * Payee Details Page Wrapper
 * Wraps PayeeDetailsPage with context menu for edit/delete
 */
export function PayeeDetailsPageWrapper(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const {payee} = usePayee(id);
  const [deletePayee, {loading: deleting}] = useMutation(DELETE_PAYEE, {
    refetchQueries: ['GetPayees'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void navigate('/payees');
    },
  });

  const handleEdit = useCallback(() => {
    if (id) {
      void navigate(`/payees/${id}/edit?returnTo=/payees/${id}`);
    }
  }, [id, navigate]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (id) {
      void deletePayee({variables: {id}});
    }
  }, [id, deletePayee]);

  return (
    <>
      <Layout
        contextMenu={{
          onEdit: handleEdit,
          onDelete: handleDelete,
          disableDelete: payee?.isDefault ?? false,
        }}
      >
        <PayeeDetailsPage />
      </Layout>
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Payee"
        message="Are you sure you want to delete this payee? This action cannot be undone."
        deleting={deleting}
      />
    </>
  );
}

/**
 * Budget Details Page Wrapper
 * Wraps BudgetDetailsPage with context menu for edit/delete
 */
export function BudgetDetailsPageWrapper(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBudget, {loading: deleting}] = useMutation(DELETE_BUDGET, {
    refetchQueries: ['GetBudgets'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      void navigate('/budgets');
    },
  });

  const handleEdit = useCallback(() => {
    if (id) {
      void navigate(`/budgets/${id}/edit?returnTo=/budgets/${id}`);
    }
  }, [id, navigate]);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (id) {
      void deleteBudget({variables: {id}});
    }
  }, [id, deleteBudget]);

  return (
    <>
      <Layout
        contextMenu={{
          onEdit: handleEdit,
          onDelete: handleDelete,
        }}
      >
        <BudgetDetailsPage />
      </Layout>
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Budget"
        message="Are you sure you want to delete this budget? This action cannot be undone."
        deleting={deleting}
      />
    </>
  );
}

