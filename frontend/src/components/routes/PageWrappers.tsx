/**
 * Page Wrapper Components
 * Unified wrapper components for pages with consistent patterns
 * Uses usePageWrapper hook to reduce code duplication
 */

import React, { Suspense } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router';
import { Add } from '@mui/icons-material';
import { validateReturnUrl } from '../../utils/validation';
import { LoadingSpinner } from '../common/LoadingSpinner';
import {
  DELETE_ACCOUNT,
  DELETE_CATEGORY,
  DELETE_PAYEE,
  DELETE_BUDGET,
  DELETE_TRANSACTION,
} from '../../graphql/mutations';
import { usePageWrapper } from '../../hooks/usePageWrapper';
import { useAccount } from '../../hooks/useAccount';
import { useCategory } from '../../hooks/useCategory';
import { usePayee } from '../../hooks/usePayee';

// Lazy loaded page components
const SchedulePage = React.lazy(() =>
  import('../../pages/SchedulePage').then((m) => ({ default: m.SchedulePage }))
);
const BudgetsPage = React.lazy(() =>
  import('../../pages/BudgetsPage').then((m) => ({ default: m.BudgetsPage }))
);
const AccountDetailsPage = React.lazy(() =>
  import('../../pages/AccountDetailsPage').then((m) => ({ default: m.AccountDetailsPage }))
);
const CategoryDetailsPage = React.lazy(() =>
  import('../../pages/CategoryDetailsPage').then((m) => ({ default: m.CategoryDetailsPage }))
);
const AccountsPage = React.lazy(() =>
  import('../../pages/AccountsPage').then((m) => ({ default: m.AccountsPage }))
);
const PayeesPage = React.lazy(() =>
  import('../../pages/PayeesPage').then((m) => ({ default: m.PayeesPage }))
);
const CategoriesPage = React.lazy(() =>
  import('../../pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage }))
);
const PayeeDetailsPage = React.lazy(() =>
  import('../../pages/PayeeDetailsPage').then((m) => ({ default: m.PayeeDetailsPage }))
);
const BudgetDetailsPage = React.lazy(() =>
  import('../../pages/BudgetDetailsPage').then((m) => ({ default: m.BudgetDetailsPage }))
);
const TransactionEditPage = React.lazy(() =>
  import('../../pages/TransactionEditPage').then((m) => ({ default: m.TransactionEditPage }))
);
const TransactionAddPage = React.lazy(() =>
  import('../../pages/TransactionAddPage').then((m) => ({ default: m.TransactionAddPage }))
);

/**
 * Location state type for prefilled transaction add (from home keypad)
 */
interface TransactionAddLocationState {
  amount?: number;
  accountId?: string;
  categoryId?: string;
  payeeId?: string;
  returnTo?: string;
}

/**
 * Transaction Add Page Wrapper
 * Reads location state and search params to pass prefilled props to TransactionAddPage.
 * Prefilled values (amount, accountId, categoryId, payeeId) come from state only; returnTo from state or search params.
 */
export function TransactionAddPageWrapper(): React.JSX.Element {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as TransactionAddLocationState | undefined;
  const returnTo =
    state?.returnTo ?? validateReturnUrl(searchParams.get('returnTo'), '/');

  return (
    <Suspense fallback={<LoadingSpinner message="Loading..." />}>
      <TransactionAddPage
        prefilledAmount={state?.amount}
        prefilledAccountId={state?.accountId}
        prefilledCategoryId={state?.categoryId}
        prefilledPayeeId={state?.payeeId}
        returnTo={returnTo}
      />
    </Suspense>
  );
}

/**
 * Schedule Page Wrapper
 */
export function SchedulePageWrapper(): React.JSX.Element {
  const navigate = useNavigate();
  const { PageLayout } = usePageWrapper({
    title: 'Schedule',
    defaultReturnUrl: '/schedule',
    hideSearch: true,
    actionButton: {
      icon: <Add />,
      onClick: () => {
        void navigate('/transactions/add?returnTo=/schedule');
      },
      ariaLabel: 'Add Recurring Transaction',
    },
  });

  return (
    <PageLayout>
      <SchedulePage />
    </PageLayout>
  );
}

/**
 * Budgets Page Wrapper
 */
export function BudgetsPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();
  const { PageLayout } = usePageWrapper({
    title: 'Budgets',
    defaultReturnUrl: '/budgets',
    hideSearch: true,
    actionButton: {
      icon: <Add />,
      onClick: () => {
        void navigate('/budgets/add?returnTo=/budgets');
      },
      ariaLabel: 'Create Budget',
    },
  });

  return (
    <PageLayout>
      <BudgetsPage />
    </PageLayout>
  );
}

/**
 * Accounts Page Wrapper
 */
export function AccountsPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();
  const { PageLayout } = usePageWrapper({
    title: 'Accounts',
    defaultReturnUrl: '/accounts',
    actionButton: {
      icon: <Add />,
      onClick: () => {
        void navigate('/accounts/add?returnTo=/accounts', { replace: true });
      },
      ariaLabel: 'Add Account',
    },
  });

  return (
    <PageLayout>
      <AccountsPage />
    </PageLayout>
  );
}

/**
 * Payees Page Wrapper
 */
export function PayeesPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();
  const { PageLayout } = usePageWrapper({
    title: 'Payees',
    defaultReturnUrl: '/payees',
    actionButton: {
      icon: <Add />,
      onClick: () => {
        void navigate('/payees/add?returnTo=/payees', { replace: true });
      },
      ariaLabel: 'Add Payee',
    },
  });

  return (
    <PageLayout>
      <PayeesPage />
    </PageLayout>
  );
}

/**
 * Categories Page Wrapper
 */
export function CategoriesPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();
  const { PageLayout } = usePageWrapper({
    title: 'Categories',
    defaultReturnUrl: '/categories',
    actionButton: {
      icon: <Add />,
      onClick: () => {
        void navigate('/categories/add?returnTo=/categories', { replace: true });
      },
      ariaLabel: 'Add Category',
    },
  });

  return (
    <PageLayout>
      <CategoriesPage />
    </PageLayout>
  );
}

/**
 * Account Details Page Wrapper
 */
export function AccountDetailsPageWrapper(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { account } = useAccount(id);
  const { PageLayout, DeleteDialog } = usePageWrapper({
    title: '',
    defaultReturnUrl: '/accounts',
    editPath: '/accounts/{id}/edit?returnTo=/accounts/{id}',
    deleteMutation: DELETE_ACCOUNT,
    getDeleteVariables: (entityId: string) => ({ id: entityId }),
    refetchQueries: ['GetAccounts'],
    deleteTitle: 'Delete Account',
    deleteMessage: 'Are you sure you want to delete this account? This action cannot be undone.',
    disableDelete: account?.isDefault ?? false,
  });

  return (
    <>
      <PageLayout>
        <AccountDetailsPage />
      </PageLayout>
      {DeleteDialog}
    </>
  );
}

/**
 * Category Details Page Wrapper
 */
export function CategoryDetailsPageWrapper(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { category } = useCategory(id);
  const { PageLayout, DeleteDialog } = usePageWrapper({
    title: '',
    defaultReturnUrl: '/categories',
    editPath: '/categories/{id}/edit?returnTo=/categories/{id}',
    deleteMutation: DELETE_CATEGORY,
    getDeleteVariables: (entityId: string) => ({ id: entityId }),
    refetchQueries: ['GetCategories'],
    deleteTitle: 'Delete Category',
    deleteMessage: 'Are you sure you want to delete this category? This action cannot be undone.',
    disableDelete: category?.isDefault ?? false,
  });

  return (
    <>
      <PageLayout>
        <CategoryDetailsPage />
      </PageLayout>
      {DeleteDialog}
    </>
  );
}

/**
 * Payee Details Page Wrapper
 */
export function PayeeDetailsPageWrapper(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { payee } = usePayee(id);
  const { PageLayout, DeleteDialog } = usePageWrapper({
    title: '',
    defaultReturnUrl: '/payees',
    editPath: '/payees/{id}/edit?returnTo=/payees/{id}',
    deleteMutation: DELETE_PAYEE,
    getDeleteVariables: (entityId: string) => ({ id: entityId }),
    refetchQueries: ['GetPayees'],
    deleteTitle: 'Delete Payee',
    deleteMessage: 'Are you sure you want to delete this payee? This action cannot be undone.',
    disableDelete: payee?.isDefault ?? false,
  });

  return (
    <>
      <PageLayout>
        <PayeeDetailsPage />
      </PageLayout>
      {DeleteDialog}
    </>
  );
}

/**
 * Budget Details Page Wrapper
 */
export function BudgetDetailsPageWrapper(): React.JSX.Element {
  const { PageLayout, DeleteDialog } = usePageWrapper({
    title: '',
    defaultReturnUrl: '/budgets',
    editPath: '/budgets/{id}/edit?returnTo=/budgets/{id}',
    deleteMutation: DELETE_BUDGET,
    getDeleteVariables: (entityId: string) => ({ id: entityId }),
    refetchQueries: ['GetBudgets'],
    deleteTitle: 'Delete Budget',
    deleteMessage: 'Are you sure you want to delete this budget? This action cannot be undone.',
  });

  return (
    <>
      <PageLayout>
        <BudgetDetailsPage />
      </PageLayout>
      {DeleteDialog}
    </>
  );
}

/**
 * Transaction Edit Page Wrapper
 */
export function TransactionEditPageWrapper(): React.JSX.Element {
  const { PageLayout, DeleteDialog } = usePageWrapper({
    title: '',
    defaultReturnUrl: '/',
    deleteMutation: DELETE_TRANSACTION,
    getDeleteVariables: (entityId: string) => ({ id: entityId }),
    refetchQueries: ['GetTransactions', 'GetRecentTransactions'],
    deleteTitle: 'Delete Transaction',
    deleteMessage:
      'Are you sure you want to delete this transaction? This action cannot be undone.',
    hideSearch: true,
  });

  return (
    <>
      <PageLayout>
        <TransactionEditPage />
      </PageLayout>
      {DeleteDialog}
    </>
  );
}
