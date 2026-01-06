/**
 * Page Wrapper Components
 * Wraps page components with navigation functionality and layout
 * Uses usePageWrapper hook to reduce code duplication and improve maintainability
 */

import React from 'react';
import {useNavigate, useParams} from 'react-router';
import {Add} from '@mui/icons-material';
import {Layout} from '../common/Layout';
import {DELETE_ACCOUNT, DELETE_CATEGORY, DELETE_PAYEE, DELETE_BUDGET} from '../../graphql/mutations';
import {usePageWrapper} from '../../hooks/usePageWrapper';
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
  const {account} = useAccount(id);
  const {PageLayout, DeleteDialog} = usePageWrapper({
    title: '',
    defaultReturnUrl: '/accounts',
    editPath: '/accounts/{id}/edit?returnTo=/accounts/{id}',
    deleteMutation: DELETE_ACCOUNT,
    getDeleteVariables: (entityId: string) => ({id: entityId}),
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
 * Wraps CategoryDetailsPage with context menu for edit/delete
 */
export function CategoryDetailsPageWrapper(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const {category} = useCategory(id);
  const {PageLayout, DeleteDialog} = usePageWrapper({
    title: '',
    defaultReturnUrl: '/categories',
    editPath: '/categories/{id}/edit?returnTo=/categories/{id}',
    deleteMutation: DELETE_CATEGORY,
    getDeleteVariables: (entityId: string) => ({id: entityId}),
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
 * Accounts Page Wrapper
 * Wraps AccountsPage with add button
 */
export function AccountsPageWrapper(): React.JSX.Element {
  const navigate = useNavigate();

  const handleAdd = React.useCallback(() => {
    // Use replace to avoid adding the add page to history
    // This way, when we navigate back after creation, we can replace it
    void navigate('/accounts/add?returnTo=/accounts', {replace: true});
  }, [navigate]);

  return (
    <Layout
      title="Accounts"
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

  const handleAdd = React.useCallback(() => {
    // Use replace to avoid adding the add page to history
    // This way, when we navigate back after creation, we can replace it
    void navigate('/payees/add?returnTo=/payees', {replace: true});
  }, [navigate]);

  return (
    <Layout
      title="Payees"
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

  const handleAdd = React.useCallback(() => {
    // Use replace to avoid adding the add page to history
    // This way, when we navigate back after creation, we can replace it
    void navigate('/categories/add?returnTo=/categories', {replace: true});
  }, [navigate]);

  return (
    <Layout
      title="Categories"
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
  const {payee} = usePayee(id);
  const {PageLayout, DeleteDialog} = usePageWrapper({
    title: '',
    defaultReturnUrl: '/payees',
    editPath: '/payees/{id}/edit?returnTo=/payees/{id}',
    deleteMutation: DELETE_PAYEE,
    getDeleteVariables: (entityId: string) => ({id: entityId}),
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
 * Wraps BudgetDetailsPage with context menu for edit/delete
 */
export function BudgetDetailsPageWrapper(): React.JSX.Element {
  const {PageLayout, DeleteDialog} = usePageWrapper({
    title: '',
    defaultReturnUrl: '/budgets',
    editPath: '/budgets/{id}/edit?returnTo=/budgets/{id}',
    deleteMutation: DELETE_BUDGET,
    getDeleteVariables: (entityId: string) => ({id: entityId}),
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

