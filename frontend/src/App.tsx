/**
 * Main App Component
 * Sets up routing and application providers
 */

import React, {lazy, Suspense} from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router';
import {ApolloProvider} from '@apollo/client/react';
import {ThemeProvider} from './theme/ThemeProvider';
import {NotificationProvider} from './contexts/NotificationContext';
import {DateFormatProvider} from './contexts/DateFormatContext';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import {Layout} from './components/common/Layout';
import {ProtectedRouteWithErrorBoundary} from './components/common/ProtectedRouteWithErrorBoundary';
import {SearchProvider} from './contexts/SearchContext';
import {TitleProvider} from './contexts/TitleContext';
import {client} from './graphql/client';
import {LoadingSpinner} from './components/common/LoadingSpinner';
import {OfflineIndicator} from './components/common/OfflineIndicator';
import {
  SchedulePageWrapper,
  BudgetsPageWrapper,
  AccountDetailsPageWrapper,
  CategoryDetailsPageWrapper,
  AccountsPageWrapper,
  PayeesPageWrapper,
  CategoriesPageWrapper,
  PayeeDetailsPageWrapper,
  BudgetDetailsPageWrapper,
} from './components/routes/PageWrappers';

// Lazy load page components for code splitting
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({default: m.HomePage})));
const AccountEditPage = lazy(() => import('./pages/AccountEditPage').then((m) => ({default: m.AccountEditPage})));
const CategoryEditPage = lazy(() => import('./pages/CategoryEditPage').then((m) => ({default: m.CategoryEditPage})));
const PayeeEditPage = lazy(() => import('./pages/PayeeEditPage').then((m) => ({default: m.PayeeEditPage})));
const TransactionEditPage = lazy(() => import('./pages/TransactionEditPage').then((m) => ({default: m.TransactionEditPage})));
const TransactionAddPage = lazy(() => import('./pages/TransactionAddPage').then((m) => ({default: m.TransactionAddPage})));
const ReportPage = lazy(() => import('./pages/ReportPage').then((m) => ({default: m.ReportPage})));
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({default: m.ImportPage})));
const PreferencesPage = lazy(() => import('./pages/PreferencesPage').then((m) => ({default: m.PreferencesPage})));
const BudgetAddPage = lazy(() => import('./pages/BudgetAddPage').then((m) => ({default: m.BudgetAddPage})));
const BudgetEditPage = lazy(() => import('./pages/BudgetEditPage').then((m) => ({default: m.BudgetEditPage})));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({default: m.LoginPage})));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((m) => ({default: m.AuthCallbackPage})));

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
            <DateFormatProvider>
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
                      <HomePage />
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
            </DateFormatProvider>
          </NotificationProvider>
        </ThemeProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default App;


