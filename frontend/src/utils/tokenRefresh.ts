/**
 * Token Refresh Utility
 * Handles OIDC token refresh and expiration checking
 */

/**
 * Decode JWT token to extract claims
 * @param token - JWT token string
 * @returns Decoded token payload or null if invalid
 */
export function decodeToken(token: string): {exp?: number; iat?: number; sub?: string} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) {
      return null;
    }
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
      iat?: number;
      sub?: string;
    };
    return decoded;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 * @param token - JWT token string
 * @param bufferSeconds - Buffer time in seconds before expiration (default: 60)
 * @returns true if token is expired or will expire soon
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
  const decoded = decodeToken(token);
  if (!decoded?.exp) {
    return true; // Consider invalid tokens as expired
  }

  const expirationTime = decoded.exp * 1000; // Convert to milliseconds
  const bufferTime = bufferSeconds * 1000;
  const now = Date.now();

  return now >= expirationTime - bufferTime;
}

/**
 * Get token expiration time
 * @param token - JWT token string
 * @returns Expiration timestamp in milliseconds, or null if invalid
 */
export function getTokenExpiration(token: string): number | null {
  const decoded = decodeToken(token);
  if (!decoded?.exp) {
    return null;
  }

  return decoded.exp * 1000; // Convert to milliseconds
}

/**
 * Attempt to refresh the token using OIDC client
 * This function should be called when the token is expired or about to expire
 * @returns New token string or null if refresh failed
 */
export async function refreshToken(): Promise<string | null> {
  try {
    // Get refresh token from storage
    const refreshTokenValue = localStorage.getItem('oidc_refresh_token');
    if (!refreshTokenValue) {
      console.warn('No refresh token available for refresh. Possible reasons:', {
        reason: 'Refresh token not found in localStorage',
        possibleCauses: [
          'Refresh token was never stored during initial login (OIDC provider may not have returned one)',
          'Refresh token was cleared due to a previous error',
          'Refresh token expired and was cleared',
          'Missing "offline_access" scope in OIDC authorization request',
        ],
        action: 'User will need to re-authenticate',
      });
      // Clear all tokens and redirect to login page
      localStorage.removeItem('oidc_token');
      localStorage.removeItem('oidc_refresh_token');
      localStorage.removeItem('oidc_token_expiration');
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
        window.location.href = '/login';
      }
      return null;
    }

    // Get OIDC configuration from environment
    const discoveryUrl: string | undefined = process.env.REACT_APP_OPENID_DISCOVERY_URL;
    const clientId: string | undefined = process.env.REACT_APP_OPENID_CLIENT_ID;

    if (!discoveryUrl || !clientId) {
      console.warn('OIDC configuration missing - token refresh not available');
      return null;
    }

    // Fetch token endpoint from discovery
    let discovery: {token_endpoint?: string};
    try {
      const discoveryResponse = await fetch(discoveryUrl ?? '');
      if (!discoveryResponse.ok) {
        console.error('Failed to fetch OIDC discovery document:', discoveryResponse.status);
        return null;
      }
      discovery = (await discoveryResponse.json()) as {token_endpoint?: string};
    } catch (error: unknown) {
      console.error('Error fetching OIDC discovery document:', error);
      return null;
    }

    if (!discovery.token_endpoint) {
      console.error('Token endpoint not found in discovery document');
      return null;
    }

    // Refresh the token
    const tokenEndpoint = discovery.token_endpoint;
    if (!tokenEndpoint) {
      console.error('Token endpoint not found in discovery document');
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const response = await fetch(tokenEndpoint as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenValue,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorDetails: unknown;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      
      console.error('Token refresh failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        possibleReasons: [
          'Refresh token has expired',
          'Refresh token was revoked',
          'Invalid refresh token',
          'OIDC provider configuration issue',
        ],
      });
      
      // If refresh token is invalid, clear all tokens and redirect to login
      if (response.status === 400 || response.status === 401) {
        console.warn('Clearing invalid refresh token from storage');
        localStorage.removeItem('oidc_token');
        localStorage.removeItem('oidc_refresh_token');
        localStorage.removeItem('oidc_token_expiration');
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
          window.location.href = '/login';
        }
      }
      
      return null;
    }

    const tokenData = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
    } | null;

    // Store new tokens
    if (tokenData?.access_token) {
      localStorage.setItem('oidc_token', tokenData.access_token);
    }
    if (tokenData?.refresh_token) {
      localStorage.setItem('oidc_refresh_token', tokenData.refresh_token);
    }

    return tokenData?.access_token ?? null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

/**
 * Check token and refresh if needed
 * @param token - Current token string
 * @returns Valid token string (refreshed if needed) or null if refresh failed
 */
export async function ensureValidToken(token: string | null): Promise<string | null> {
  if (!token) {
    return null;
  }

  // Check if token is expired or about to expire
  if (isTokenExpired(token)) {
    console.warn('Token expired or about to expire, attempting refresh...');
    const newToken = await refreshToken();
    if (newToken) {
      console.warn('Token refreshed successfully');
      return newToken;
    }
    // If refresh failed, refreshToken() will have already handled redirect to login
    // Return null to indicate token is invalid
    console.warn('Token refresh failed, user will need to re-authenticate');
    return null;
  }

  return token;
}

