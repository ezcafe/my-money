/**
 * Main App Component
 * Sets up routing and application providers
 */

import React from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router';
import {ApolloProvider} from '@apollo/client/react';
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
import {ReportPage} from './pages/ReportPage';
import {ImportPage} from './pages/ImportPage';
import {SchedulePage} from './pages/SchedulePage';
import {PreferencesPage} from './pages/PreferencesPage';
import {LoginPage} from './pages/LoginPage';
import {AuthCallbackPage} from './pages/AuthCallbackPage';

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
                    <Layout>
                      <Calculator />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ProtectedRoute>
                    <Layout title="Accounts">
                      <AccountsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/:id"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AccountDetailsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/report"
                element={
                  <ProtectedRoute>
                    <Layout>
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
                    <Layout>
                      <SchedulePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/preferences"
                element={
                  <ProtectedRoute>
                    <Layout>
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


