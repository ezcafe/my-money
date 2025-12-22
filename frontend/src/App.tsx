/**
 * Main App Component
 * Sets up routing and application providers
 */

import React from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router';
import {ApolloProvider} from '@apollo/client/react';
import {Add} from '@mui/icons-material';
import {ThemeProvider} from './theme/ThemeProvider';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import {Layout} from './components/common/Layout';
import {ProtectedRoute} from './components/common/ProtectedRoute';
import {SearchProvider} from './contexts/SearchContext';
import {TitleProvider} from './contexts/TitleContext';
import {client} from './graphql/client';
import {Calculator} from './components/Calculator';
import {AccountsPage} from './pages/AccountsPage';
import {AccountDetailsPage} from './pages/AccountDetailsPage';
import {AccountEditPage} from './pages/AccountEditPage';
import {CategoriesPage} from './pages/CategoriesPage';
import {CategoryDetailsPage} from './pages/CategoryDetailsPage';
import {CategoryEditPage} from './pages/CategoryEditPage';
import {PayeesPage} from './pages/PayeesPage';
import {PayeeDetailsPage} from './pages/PayeeDetailsPage';
import {PayeeEditPage} from './pages/PayeeEditPage';
import {TransactionEditPage} from './pages/TransactionEditPage';
import {TransactionAddPage} from './pages/TransactionAddPage';
import {ReportPage} from './pages/ReportPage';
import {ImportPage} from './pages/ImportPage';
import {SchedulePage} from './pages/SchedulePage';
import {PreferencesPage} from './pages/PreferencesPage';
import {LoginPage} from './pages/LoginPage';
import {AuthCallbackPage} from './pages/AuthCallbackPage';
import {useNavigate, useParams} from 'react-router';
import {useState, useCallback} from 'react';
import {useMutation} from '@apollo/client/react';
import {DELETE_ACCOUNT, DELETE_CATEGORY, DELETE_PAYEE} from './graphql/mutations';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
} from '@mui/material';
import {useAccount} from './hooks/useAccount';
import {useCategory} from './hooks/useCategory';
import {usePayee} from './hooks/usePayee';

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
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this account? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
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
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this category? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
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
    void navigate('/accounts/add?returnTo=/accounts');
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
    void navigate('/payees/add?returnTo=/payees');
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
    void navigate('/categories/add?returnTo=/categories');
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
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Payee</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this payee? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
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
          <SearchProvider>
            <TitleProvider>
              <BrowserRouter>
              <Routes>
              {/* Public routes - no authentication required */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Protected routes - require authentication */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <Calculator />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ProtectedRoute>
                    <AccountsPageWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/add"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <AccountEditPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <AccountEditPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/:id"
                element={
                  <ProtectedRoute>
                    <AccountDetailsPageWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/categories"
                element={
                  <ProtectedRoute>
                    <CategoriesPageWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/categories/add"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <CategoryEditPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/categories/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <CategoryEditPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/categories/:id"
                element={
                  <ProtectedRoute>
                    <CategoryDetailsPageWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payees"
                element={
                  <ProtectedRoute>
                    <PayeesPageWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payees/add"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <PayeeEditPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payees/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <PayeeEditPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payees/:id"
                element={
                  <ProtectedRoute>
                    <PayeeDetailsPageWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <TransactionEditPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/add"
                element={
                  <ProtectedRoute>
                    <Layout hideSearch>
                      <TransactionAddPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/report"
                element={
                  <ProtectedRoute>
                    <Layout title="Report" hideSearch>
                      <ReportPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/import"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ImportPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schedule"
                element={
                  <ProtectedRoute>
                    <SchedulePageWrapper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/preferences"
                element={
                  <ProtectedRoute>
                    <Layout title="Preferences" hideSearch>
                      <PreferencesPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            </TitleProvider>
          </SearchProvider>
        </ThemeProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default App;


