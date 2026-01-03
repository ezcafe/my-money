/**
 * Dev Login Utility
 * Handles development login with username and password
 */

import {client} from '../graphql/client';
import {DEV_LOGIN} from '../graphql/mutations';

/**
 * Login with username and password (development only)
 * @param username - Username for login
 * @param password - Password for login
 * @returns Promise that resolves when login is complete
 * @throws Error if login fails
 */
interface DevLoginResult {
  devLogin: string;
}

export async function devLogin(username: string, password: string): Promise<void> {
  try {
    const result = await client.mutate<DevLoginResult>({
      mutation: DEV_LOGIN,
      variables: {
        username,
        password,
      },
    });

    const token = result.data?.devLogin;

    if (!token) {
      throw new Error('Login failed: No token received');
    }

    // Store token in localStorage (same as OIDC tokens)
    localStorage.setItem('oidc_token', token);

    // Set expiration (24 hours from now)
    const expirationTime = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('oidc_token_expiration', expirationTime.toString());

    // Clear refresh token (not used for dev login)
    localStorage.removeItem('oidc_refresh_token');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Login failed';
    throw new Error(errorMessage);
  }
}

