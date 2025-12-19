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
async function generatePKCE(): Promise<{verifier: string; challenge: string}> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  return {verifier, challenge};
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
  const {verifier, challenge} = await generatePKCE();

  // Store state and verifier for callback verification
  sessionStorage.setItem('oidc_state', state);
  sessionStorage.setItem('oidc_verifier', verifier);

  // Build authorization URL
  const redirectUri = `${window.location.origin}/auth/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  // Redirect to OIDC provider
  window.location.href = `${config.authorization_endpoint}?${params.toString()}`;
}

/**
 * Handle OIDC callback and exchange authorization code for tokens
 * @param code - Authorization code from OIDC provider
 * @param state - State parameter for CSRF protection
 * @returns True if successful, false otherwise
 */
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

  const verifier = sessionStorage.getItem('oidc_verifier');
  if (!verifier) {
    console.error('Code verifier not found in sessionStorage');
    return false;
  }

  const clientId = process.env.REACT_APP_OPENID_CLIENT_ID;
  if (!clientId) {
    console.error('REACT_APP_OPENID_CLIENT_ID is not configured');
    return false;
  }

  // Get client secret if configured (required by some OIDC providers like Pocket ID)
  const clientSecret = process.env.REACT_APP_OPENID_CLIENT_SECRET;

  const config = await getOIDCConfig();
  const redirectUri = `${window.location.origin}/auth/callback`;

  // Clean up session storage only after successful validation
  // Keep it until after token exchange in case we need to retry
  try {
    // Prepare token exchange request with PKCE
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    });

    // Add client_secret if provided (required by Pocket ID and some other providers)
    // Note: This is less secure for frontend apps, but required by some OIDC providers
    if (clientSecret) {
      tokenParams.append('client_secret', clientSecret);
    }

    // Exchange authorization code for tokens
    const response = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorDetails: unknown;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      
      console.error('Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
      });
      return false;
    }

    const tokenData = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // Store tokens
    if (tokenData.access_token) {
      localStorage.setItem('oidc_token', tokenData.access_token);
      
      // Store expiration if provided
      if (tokenData.expires_in) {
        const expiration = Date.now() + tokenData.expires_in * 1000;
        localStorage.setItem('oidc_token_expiration', expiration.toString());
      }
    }

    if (tokenData.refresh_token) {
      localStorage.setItem('oidc_refresh_token', tokenData.refresh_token);
    }

    // Clean up session storage only after successful token exchange
    sessionStorage.removeItem('oidc_state');
    sessionStorage.removeItem('oidc_verifier');

    return true;
  } catch (error) {
    console.error('Error exchanging authorization code:', error);
    // Don't clean up session storage on error - allow retry
    return false;
  }
}

/**
 * Check if user is authenticated
 * @returns True if user has a valid token, false otherwise
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('oidc_token');
}

/**
 * Logout user by clearing tokens
 */
export function logout(): void {
  localStorage.removeItem('oidc_token');
  localStorage.removeItem('oidc_refresh_token');
  localStorage.removeItem('oidc_token_expiration');
}

