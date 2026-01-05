/**
 * Navigation with Return URL Hook
 * Provides standardized navigation with return URL handling
 */

import {useNavigate, useSearchParams} from 'react-router';
import {useCallback} from 'react';
import {validateReturnUrl} from '../utils/validation';

/**
 * Options for navigation with return
 */
interface UseNavigationWithReturnOptions {
  /** Default return URL if no returnTo param is present */
  defaultReturnUrl?: string;
}

/**
 * Return type for useNavigationWithReturn hook
 */
interface UseNavigationWithReturnReturn {
  /** Navigate to a path, preserving return URL */
  navigate: (path: string, options?: {replace?: boolean}) => void;
  /** Navigate back to return URL or default */
  navigateBack: (options?: {replace?: boolean}) => void;
  /** Get validated return URL */
  getReturnUrl: () => string;
}

/**
 * Hook for navigation with return URL handling
 * @param options - Navigation options
 * @returns Navigation functions with return URL support
 */
export function useNavigationWithReturn(options: UseNavigationWithReturnOptions = {}): UseNavigationWithReturnReturn {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {defaultReturnUrl = '/'} = options;

  const getReturnUrl = useCallback((): string => {
    const returnTo = searchParams.get('returnTo');
    return validateReturnUrl(returnTo, defaultReturnUrl);
  }, [searchParams, defaultReturnUrl]);

  const navigateWithReturn = useCallback(
    (path: string, navOptions?: {replace?: boolean}): void => {
      const returnTo = getReturnUrl();
      const separator = path.includes('?') ? '&' : '?';
      const urlWithReturn = `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
      void navigate(urlWithReturn, navOptions);
    },
    [navigate, getReturnUrl],
  );

  const navigateBack = useCallback(
    (navOptions?: {replace?: boolean}): void => {
      const returnUrl = getReturnUrl();
      void navigate(returnUrl, navOptions);
    },
    [navigate, getReturnUrl],
  );

  return {
    navigate: navigateWithReturn,
    navigateBack,
    getReturnUrl,
  };
}

