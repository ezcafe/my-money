/**
 * Service Worker for PWA
 * Handles offline caching and background sync
 */

// Service worker types are available in the DOM lib
// Using type assertions for service worker specific APIs

const STATIC_CACHE = 'my-money-static-v1';
const API_CACHE = 'my-money-api-v1';
const MAX_CACHE_SIZE_MB = 50; // Maximum cache size in MB
const BYTES_PER_MB = 1024 * 1024;

// Cache TTLs in milliseconds
const STATIC_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for static assets
// API cache TTL removed - using GraphQL-specific TTLs instead
const GRAPHQL_QUERY_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for GraphQL queries
const GRAPHQL_MUTATION_CACHE_TTL_MS = 0; // Don't cache mutations

/**
 * Check if we're in development mode
 * @returns True if in development mode
 */
function isDevelopmentMode(): boolean {
  // Check if origin is localhost or 127.0.0.1 (development server)
  if (typeof self !== 'undefined' && 'location' in self) {
    const origin = (self as {location?: {origin?: string}}).location?.origin ?? '';
    return origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes(':3000');
  }
  // Fallback: check if NODE_ENV is development (if available via build-time replacement)
  // Note: process.env is not available in service workers, but esbuild can replace it
  return false;
}

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event: Event): void => {
  if ('waitUntil' in event && typeof (event as {waitUntil: (promise: Promise<unknown>) => void}).waitUntil === 'function') {
    (event as {waitUntil: (promise: Promise<unknown>) => void}).waitUntil(
      caches.open(STATIC_CACHE).then((cache: Cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),
    );
  }
  if ('skipWaiting' in self && typeof (self as {skipWaiting?: () => Promise<void>}).skipWaiting === 'function') {
    void (self as {skipWaiting: () => Promise<void>}).skipWaiting();
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: Event): void => {
  if ('waitUntil' in event && typeof (event as {waitUntil: (promise: Promise<unknown>) => void}).waitUntil === 'function') {
    (event as {waitUntil: (promise: Promise<unknown>) => void}).waitUntil(
      caches.keys().then((cacheNames: string[]) => {
        return Promise.all(
          cacheNames
            .filter((name: string) => name !== STATIC_CACHE && name !== API_CACHE)
            .map((name: string) => caches.delete(name)),
        );
      }),
    );
  }
  if ('clients' in self && self.clients && typeof (self.clients as {claim?: () => Promise<void>}).claim === 'function') {
    void (self.clients as {claim: () => Promise<void>}).claim();
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: Event): void => {
  if (!('request' in event) || !('respondWith' in event)) {
    return;
  }
  const fetchEvent = event as {request: Request; respondWith: (response: Promise<Response>) => void};
  const request = fetchEvent.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // In development mode, bypass caching entirely to support hot reload
  if (isDevelopmentMode()) {
    fetchEvent.respondWith(fetch(request));
    return;
  }

  // Handle GraphQL requests
  if (url.pathname === '/graphql') {
    fetchEvent.respondWith(
      caches.open(API_CACHE).then(async (cache: Cache) => {
        // Check cache size and evict if needed
        await evictCacheIfNeeded(cache, API_CACHE);

        // Try to get cached response first
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          // Check if cached response is still valid (TTL)
          const cacheDate = cachedResponse.headers.get('sw-cache-date');
          if (cacheDate) {
            const cacheTime = new Date(cacheDate).getTime();
            const now = Date.now();

            // Determine TTL based on request type (query vs mutation)
            const requestBody = await request.clone().text().catch(() => '');
            const isMutation = requestBody.includes('mutation');
            const ttl = isMutation ? GRAPHQL_MUTATION_CACHE_TTL_MS : GRAPHQL_QUERY_CACHE_TTL_MS;

            // If cache is still valid and not a mutation, return cached response
            if (!isMutation && (now - cacheTime) < ttl) {
              return cachedResponse;
            }
          }
        }

        // Fetch from network
        return fetch(request)
          .then(async (response: Response) => {
            // Only cache successful responses
            if (response.status === 200) {
              // Check if it's a mutation - don't cache mutations
              const requestBody = await request.clone().text().catch(() => '');
              const isMutation = requestBody.includes('mutation');

              if (!isMutation) {
                // Clone response and add cache metadata
                const responseToCache = response.clone();
                const headers = new Headers(responseToCache.headers);
                headers.set('sw-cache-date', new Date().toISOString());

                // Create new response with cache metadata
                const cachedResponse = new Response(responseToCache.body, {
                  status: responseToCache.status,
                  statusText: responseToCache.statusText,
                  headers,
                });

                void cache.put(request, cachedResponse);
              } else {
                // Invalidate related query caches on mutation
                await invalidateRelatedCaches(cache, requestBody);
              }
            }
            return response;
          })
          .catch(() => {
            // Return cached response if network fails (even if expired)
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(JSON.stringify({
              errors: [{
                message: 'Network error and no cached response available',
                extensions: {code: 'NETWORK_ERROR'},
              }],
            }), {
              status: 503,
              headers: {'Content-Type': 'application/json'},
            });
          });
      }),
    );
    return;
  }

  // Handle static assets
  fetchEvent.respondWith(
    caches.match(request).then(async (response: Response | undefined) => {
      if (response) {
        // Check if cached response is still valid (TTL)
        const cacheDate = response.headers.get('sw-cache-date');
        if (cacheDate) {
          const cacheTime = new Date(cacheDate).getTime();
          const now = Date.now();

          // If cache is still valid, return cached response
          if ((now - cacheTime) < STATIC_CACHE_TTL_MS) {
            return response;
          }
        } else {
          // No cache date, assume valid (legacy cache entry)
          return response;
        }
      }

      // Fetch from network
      return fetch(request).then(async (fetchResponse: Response) => {
        // Cache new responses
        if (fetchResponse.status === 200) {
          const responseToCache = fetchResponse.clone();
          const cache = await caches.open(STATIC_CACHE);
          await evictCacheIfNeeded(cache, STATIC_CACHE);

          // Add cache metadata
          const headers = new Headers(responseToCache.headers);
          headers.set('sw-cache-date', new Date().toISOString());

          const cachedResponse = new Response(responseToCache.body, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers,
          });

          void cache.put(request, cachedResponse);
        }
        return fetchResponse;
      });
    }),
  );
});

/**
 * Invalidate related caches when a mutation occurs
 * @param cache - Cache to invalidate from
 * @param mutationBody - Mutation request body
 */
async function invalidateRelatedCaches(cache: Cache, mutationBody: string): Promise<void> {
  try {
    // Extract mutation name from body to determine what to invalidate
    const mutationMatch = mutationBody.match(/mutation\s+(\w+)/);
    if (!mutationMatch) {
      return;
    }

    const mutationName = mutationMatch[1]?.toLowerCase();
    if (!mutationName) {
      return;
    }

    // Invalidate caches based on mutation type
    const keys = await cache.keys();
    const keysToDelete: Request[] = [];

    for (const key of keys) {
      const url = key.url;
      if (url.includes('/graphql')) {
        // Check if this is a query that should be invalidated
        const cachedResponse = await cache.match(key);
        if (cachedResponse) {
          // Invalidate transactions-related queries on transaction mutations
          if (mutationName.includes('transaction') || mutationName.includes('create') || mutationName.includes('update') || mutationName.includes('delete')) {
            keysToDelete.push(key);
          }
          // Invalidate account-related queries on account mutations
          else if (mutationName.includes('account')) {
            keysToDelete.push(key);
          }
          // Invalidate category-related queries on category mutations
          else if (mutationName.includes('category')) {
            keysToDelete.push(key);
          }
          // Invalidate payee-related queries on payee mutations
          else if (mutationName.includes('payee')) {
            keysToDelete.push(key);
          }
        }
      }
    }

    // Delete invalidated caches
    await Promise.all(keysToDelete.map((key) => cache.delete(key)));
  } catch (error) {
    // Silently handle cache invalidation errors
    console.warn('Cache invalidation failed:', error);
  }
}

/**
 * Evict cache entries if cache size exceeds limit (simple LRU implementation)
 * Also evicts expired entries based on TTL
 * @param cache - Cache to check and evict from
 * @param cacheName - Name of the cache for logging
 */
async function evictCacheIfNeeded(cache: Cache, cacheName: string): Promise<void> {
  try {
    const keys = await cache.keys();
    let totalSize = 0;
    const entries: Array<{key: Request; size: number; timestamp: number}> = [];
    const now = Date.now();
    const isApiCache = cacheName === API_CACHE;
    const ttl = isApiCache ? GRAPHQL_QUERY_CACHE_TTL_MS : STATIC_CACHE_TTL_MS;

    // Calculate total size and collect entries with timestamps
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const blob = await response.blob();
        const size = blob.size;
        totalSize += size;

        // Get timestamp from cache metadata or response date
        const cacheDate = response.headers.get('sw-cache-date');
        const timestamp = cacheDate
          ? new Date(cacheDate).getTime()
          : (response.headers.get('date')
            ? new Date(response.headers.get('date') ?? '').getTime()
            : now);

        entries.push({key, size, timestamp});

        // Evict expired entries immediately
        if ((now - timestamp) > ttl) {
          await cache.delete(key);
          totalSize -= size;
        }
      }
    }

    // If cache still exceeds size limit after TTL eviction, evict oldest entries (LRU)
    if (totalSize > MAX_CACHE_SIZE_MB * BYTES_PER_MB) {
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Evict entries until under limit
      let currentSize = totalSize;
      for (const entry of entries) {
        if (currentSize <= MAX_CACHE_SIZE_MB * BYTES_PER_MB) {
          break;
        }
        await cache.delete(entry.key);
        currentSize -= entry.size;
      }
    }
  } catch (error) {
    // Silently handle cache eviction errors
    console.warn(`Cache eviction failed for ${cacheName}:`, error);
  }
}


