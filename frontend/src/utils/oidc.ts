/**
 * OIDC Authentication Utilities
 * Handles OIDC authorization code flow with PKCE for user authentication
 */

/**
 * OIDC configuration from discovery document
 */
interface OIDCConfig {
  authorization_endpoint: string;
  token_endpoint: string;
}

/**
 * Get OIDC configuration from discovery document
 * @returns OIDC configuration with authorization and token endpoints
 * @throws Error if discovery URL is not configured or discovery fails
 */
async function getOIDCConfig(): Promise<OIDCConfig> {
  const discoveryUrl = process.env.REACT_APP_OPENID_DISCOVERY_URL;
  if (!discoveryUrl) {
    throw new Error('REACT_APP_OPENID_DISCOVERY_URL is not configured');
  }

  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch OIDC discovery document: ${response.status}`);
  }

  const discovery = (await response.json()) as {
    authorization_endpoint?: string;
    token_endpoint?: string;
  };

  if (!discovery.authorization_endpoint || !discovery.token_endpoint) {
    throw new Error('Invalid OIDC discovery document: missing endpoints');
  }

  return {
    authorization_endpoint: discovery.authorization_endpoint,
    token_endpoint: discovery.token_endpoint,
  };
}

/**
 * Generate a random state value for CSRF protection
 * @returns Random state string
 */
function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random code verifier for PKCE
 * @returns Base64URL-encoded code verifier
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate code challenge from verifier using SHA256
 * @param verifier - Code verifier string
 * @returns Base64URL-encoded code challenge
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const array = new Uint8Array(digest);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate PKCE verifier and challenge pair
 * @returns Object with verifier and challenge
 */
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  return { verifier, challenge };
}

/**
 * Initiate OIDC login flow
 * Redirects user to OIDC provider for authentication
 * @throws Error if OIDC configuration is missing or login initiation fails
 */
export async function initiateLogin(): Promise<void> {
  const clientId = process.env.REACT_APP_OPENID_CLIENT_ID;
  if (!clientId) {
    throw new Error('REACT_APP_OPENID_CLIENT_ID is not configured');
  }

  const config = await getOIDCConfig();
  const state = generateState();
  const { verifier, challenge } = await generatePKCE();

  // Store state in sessionStorage for callback verification
  sessionStorage.setItem('oidc_state', state);
  // Store verifier in a temporary cookie for backend callback
  // Cookie expires in 10 minutes (enough time for OIDC flow)
  document.cookie = `oidc_verifier=${verifier}; path=/; max-age=600; SameSite=Lax`;

  // Build authorization URL
  // Redirect URI points to backend callback endpoint which handles token exchange
  const backendUrl =
    process.env.REACT_APP_GRAPHQL_URL?.replace('/graphql', '') ?? 'http://localhost:4000';
  const redirectUri = `${backendUrl}/auth/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile offline_access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  // Redirect to OIDC provider
  window.location.href = `${config.authorization_endpoint}?${params.toString()}`;
}

/**
 * Handle OIDC callback
 * Redirects to backend callback endpoint which handles token exchange and sets httpOnly cookies
 * @param code - Authorization code from OIDC provider
 * @param state - State parameter for CSRF protection
 * @returns True if redirect was initiated, false otherwise
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleCallback(code: string, state: string): Promise<boolean> {
  // Verify state - check before doing anything else
  const storedState = sessionStorage.getItem('oidc_state');
  if (!storedState) {
    console.error('State not found in sessionStorage - possible session issue or page reload');
    return false;
  }

  if (storedState !== state) {
    console.error('Invalid state parameter - possible CSRF attack', {
      stored: storedState,
      received: state,
      match: storedState === state,
    });
    return false;
  }

  // Clean up session storage
  sessionStorage.removeItem('oidc_state');
  sessionStorage.removeItem('oidc_verifier');

  // Redirect to backend callback endpoint
  // Backend will exchange code for tokens and set httpOnly cookies
  const backendUrl =
    process.env.REACT_APP_GRAPHQL_URL?.replace('/graphql', '') ?? 'http://localhost:4000';
  const redirectUrl = `${backendUrl}/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  window.location.href = redirectUrl;

  return true;
}

/**
 * Check if user is authenticated
 * With cookie-based auth, we can't directly check token presence
 * This function makes a lightweight request to the backend to verify authentication
 * The backend will return 401 if not authenticated
 * @returns True if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    // Check authentication by making a request to verify token presence
    // We check the access token cookie by making a lightweight request
    // The backend GraphQL endpoint requires authentication, so we can use a simple query
    // However, to avoid unnecessary GraphQL overhead, we check if refresh token exists
    // If refresh token exists, user is authenticated (or was recently authenticated)
    const backendUrl =
      process.env.REACT_APP_GRAPHQL_URL?.replace('/graphql', '') ?? 'http://localhost:4000';
    const checkUrl = `${backendUrl}/auth/refresh`;

    // Make a POST request to check authentication
    // The endpoint will return 401 if no refresh token (not authenticated)
    // It will return 200 if refresh token exists (authenticated)
    // Note: This may refresh the token, but that's acceptable for auth checking
    const response = await fetch(checkUrl, {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // If status is 401 or 404, user is not authenticated
    // 401 = no auth token, 404 = endpoint not found (shouldn't happen but treat as not authenticated)
    // If status is 200, user is authenticated (refresh token exists)
    return response.status === 200;
  } catch {
    // On network errors, assume not authenticated to be safe
    return false;
  }
}

/**
 * Logout user by calling backend logout endpoint
 * Backend will clear httpOnly cookies
 */
export async function logout(): Promise<void> {
  try {
    // Call backend logout endpoint to clear cookies
    const backendUrl =
      process.env.REACT_APP_GRAPHQL_URL?.replace('/graphql', '') ?? 'http://localhost:4000';
    await fetch(`${backendUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with logout even if backend call fails
  }

  // Clear any remaining localStorage data (for cleanup)
  localStorage.clear();
  sessionStorage.clear();

  // Redirect to login page
  window.location.href = '/login';
}
