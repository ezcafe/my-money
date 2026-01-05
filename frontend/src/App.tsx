/**
 * Main App Component
 * Sets up routing and application providers
 */

import React, {lazy, Suspense} from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router';
import {ApolloProvider} from '@apollo/client/react';
import {Add} from '@mui/icons-material';
import {ThemeProvider} from './theme/ThemeProvider';
import {NotificationProvider} from './contexts/NotificationContext';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import {Layout} from './components/common/Layout';
import {ProtectedRouteWithErrorBoundary} from './components/common/ProtectedRouteWithErrorBoundary';
import {SearchProvider} from './contexts/SearchContext';
import {TitleProvider} from './contexts/TitleContext';
import {client} from './graphql/client';
import {LoadingSpinner} from './components/common/LoadingSpinner';
import {OfflineIndicator} from './components/common/OfflineIndicator';

// Lazy load page components for code splitting
const Calculator = lazy(() => import('./components/Calculator').then((m) => ({default: m.Calculator})));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then((m) => ({default: m.AccountsPage})));
const AccountDetailsPage = lazy(() => import('./pages/AccountDetailsPage').then((m) => ({default: m.AccountDetailsPage})));
const AccountEditPage = lazy(() => import('./pages/AccountEditPage').then((m) => ({default: m.AccountEditPage})));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({default: m.CategoriesPage})));
const CategoryDetailsPage = lazy(() => import('./pages/CategoryDetailsPage').then((m) => ({default: m.CategoryDetailsPage})));
const CategoryEditPage = lazy(() => import('./pages/CategoryEditPage').then((m) => ({default: m.CategoryEditPage})));
const PayeesPage = lazy(() => import('./pages/PayeesPage').then((m) => ({default: m.PayeesPage})));
const PayeeDetailsPage = lazy(() => import('./pages/PayeeDetailsPage').then((m) => ({default: m.PayeeDetailsPage})));
const PayeeEditPage = lazy(() => import('./pages/PayeeEditPage').then((m) => ({default: m.PayeeEditPage})));
const TransactionEditPage = lazy(() => import('./pages/TransactionEditPage').then((m) => ({default: m.TransactionEditPage})));
const TransactionAddPage = lazy(() => import('./pages/TransactionAddPage').then((m) => ({default: m.TransactionAddPage})));
const ReportPage = lazy(() => import('./pages/ReportPage').then((m) => ({default: m.ReportPage})));
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({default: m.ImportPage})));
const SchedulePage = lazy(() => import('./pages/SchedulePage').then((m) => ({default: m.SchedulePage})));
const PreferencesPage = lazy(() => import('./pages/PreferencesPage').then((m) => ({default: m.PreferencesPage})));
const BudgetsPage = lazy(() => import('./pages/BudgetsPage').then((m) => ({default: m.BudgetsPage})));
const BudgetAddPage = lazy(() => import('./pages/BudgetAddPage').then((m) => ({default: m.BudgetAddPage})));
const BudgetDetailsPage = lazy(() => import('./pages/BudgetDetailsPage').then((m) => ({default: m.BudgetDetailsPage})));
const BudgetEditPage = lazy(() => import('./pages/BudgetEditPage').then((m) => ({default: m.BudgetEditPage})));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({default: m.LoginPage})));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((m) => ({default: m.AuthCallbackPage})));
import {useNavigate, useParams} from 'react-router';
import {useState, useCallback} from 'react';
import {useMutation} from '@apollo/client/react';
import {DELETE_ACCOUNT, DELETE_CATEGORY, DELETE_PAYEE, DELETE_BUDGET} from './graphql/mutations';
import {useAccount} from './hooks/useAccount';
import {useCategory} from './hooks/useCategory';
import {usePayee} from './hooks/usePayee';
import {DeleteConfirmDialog} from './components/common/DeleteConfirmDialog';

/**
 * Schedule Page Wrapper
 * Wraps SchedulePage with navigation functionality
 */
function SchedulePageWrapper(): React.JSX.Element {
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
function BudgetsPageWrapper(): React.JSX.Element {
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
function AccountDetailsPageWrapper(): React.JSX.Element {
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
function CategoryDetailsPageWrapper(): React.JSX.Element {
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
function AccountsPageWrapper(): React.JSX.Element {
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
function PayeesPageWrapper(): React.JSX.Element {
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
function CategoriesPageWrapper(): React.JSX.Element {
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
function PayeeDetailsPageWrapper(): React.JSX.Element {
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
function BudgetDetailsPageWrapper(): React.JSX.Element {
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

/**
 * Main App Component
 * Provides routing, theme, and error handling
 */
function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <ApolloProvider client={client}>
        <ThemeProvider>
          <NotificationProvider>
            <SearchProvider>
              <TitleProvider>
                <BrowserRouter>
              <Suspense fallback={<LoadingSpinner message="Loading..." />}>
                <Routes>
                {/* Public routes - no authentication required */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Protected routes - require authentication */}
              <Route
                path="/"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <Calculator />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <AccountsPageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/accounts/add"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <AccountEditPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/accounts/:id/edit"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <AccountEditPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/accounts/:id"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <AccountDetailsPageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/categories"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <CategoriesPageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/categories/add"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <CategoryEditPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/categories/:id/edit"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <CategoryEditPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/categories/:id"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <CategoryDetailsPageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/payees"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <PayeesPageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/payees/add"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <PayeeEditPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/payees/:id/edit"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <PayeeEditPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/payees/:id"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <PayeeDetailsPageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/budgets"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <BudgetsPageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/budgets/add"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <BudgetAddPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/budgets/:id"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <BudgetDetailsPageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/budgets/:id/edit"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <BudgetEditPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/transactions/:id/edit"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <TransactionEditPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/transactions/add"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout hideSearch>
                      <TransactionAddPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/report"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout title="Report" hideSearch>
                      <ReportPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/import"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout title="Import Transactions" hideSearch>
                      <ImportPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/schedule"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <SchedulePageWrapper />
                  </ProtectedRouteWithErrorBoundary>
                }
              />
              <Route
                path="/preferences"
                element={
                  <ProtectedRouteWithErrorBoundary>
                    <Layout title="Preferences" hideSearch>
                      <PreferencesPage />
                    </Layout>
                  </ProtectedRouteWithErrorBoundary>
                }
              />
                <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
              <OfflineIndicator />
            </BrowserRouter>
            </TitleProvider>
          </SearchProvider>
          </NotificationProvider>
        </ThemeProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default App;


