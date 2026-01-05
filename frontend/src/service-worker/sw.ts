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

        return fetch(request)
          .then((response: Response) => {
            // Cache successful responses
            if (response.status === 200) {
              void cache.put(request, response.clone());
            }
            return response;
          })
          .catch(async () => {
            // Return cached response if network fails
            const cachedResponse = await cache.match(request);
            return cachedResponse ?? new Response('Not found', {status: 404});
          });
      }),
    );
    return;
  }

  // Handle static assets
  fetchEvent.respondWith(
    caches.match(request).then((response: Response | undefined) => {
      return (
        response ??
        fetch(request).then(async (fetchResponse: Response) => {
          // Cache new responses
          if (fetchResponse.status === 200) {
            const responseToCache = fetchResponse.clone();
            const cache = await caches.open(STATIC_CACHE);
            await evictCacheIfNeeded(cache, STATIC_CACHE);
            void cache.put(request, responseToCache);
          }
          return fetchResponse;
        })
      );
    }),
  );
});

/**
 * Evict cache entries if cache size exceeds limit (simple LRU implementation)
 * @param cache - Cache to check and evict from
 * @param cacheName - Name of the cache for logging
 */
async function evictCacheIfNeeded(cache: Cache, cacheName: string): Promise<void> {
  try {
    const keys = await cache.keys();
    let totalSize = 0;
    const entries: Array<{key: Request; size: number; timestamp: number}> = [];

    // Calculate total size and collect entries with timestamps
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const blob = await response.blob();
        const size = blob.size;
        totalSize += size;
        // Use response date or current time as timestamp
        const timestamp = response.headers.get('date')
          ? new Date(response.headers.get('date') ?? '').getTime()
          : Date.now();
        entries.push({key, size, timestamp});
      }
    }

    // If cache exceeds size limit, evict oldest entries (LRU)
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


