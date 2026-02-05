/**
 * Authentication Context
 * Manages global authentication state to prevent unauthorized queries
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { isAuthenticated } from '../utils/oidc';

/**
 * Authentication context interface
 */
interface AuthContextType {
  isAuthenticated: boolean | null; // null = checking, true = authenticated, false = not authenticated
  checkAuth: () => Promise<void>;
}

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication context provider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication context provider component
 * Manages authentication state and provides it globally
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [authState, setAuthState] = useState<boolean | null>(null);

  /**
   * Check authentication status
   */
  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      const authenticated = await isAuthenticated();
      setAuthState(authenticated);
    } catch {
      setAuthState(false);
    }
  }, []);

  // Check authentication on mount
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Monitor visibility changes to re-check auth when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (!document.hidden && authState === true) {
        void checkAuth();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authState, checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: authState,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 * @returns Authentication context value
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
