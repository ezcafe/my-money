/**
 * Main App Component
 * Sets up routing and application providers
 */

import React from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router';
import {ApolloProvider} from '@apollo/client';
import {ThemeProvider} from './theme/ThemeProvider';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import {Layout} from './components/common/Layout';
import {client} from './graphql/client';
import {Calculator} from './components/Calculator';
import {AccountsPage} from './pages/AccountsPage';
import {AccountDetailsPage} from './pages/AccountDetailsPage';
import {ReportPage} from './pages/ReportPage';
import {ImportPage} from './pages/ImportPage';
import {SchedulePage} from './pages/SchedulePage';
import {PreferencesPage} from './pages/PreferencesPage';

/**
 * Main App Component
 * Provides routing, theme, and error handling
 */
function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <ApolloProvider client={client}>
        <ThemeProvider>
          <BrowserRouter
            future={{
              v7_relativeSplatPath: true,
              v7_startTransition: true,
            }}
          >
            <Layout>
              <Routes>
                <Route path="/" element={<Calculator />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/accounts/:id" element={<AccountDetailsPage />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/schedule" element={<SchedulePage />} />
                <Route path="/preferences" element={<PreferencesPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </ThemeProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default App;


