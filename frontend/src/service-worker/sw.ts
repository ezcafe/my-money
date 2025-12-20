/**
 * Service Worker for PWA
 * Handles offline caching and background sync
 */

// Service worker types are available in the DOM lib
// Using type assertions for service worker specific APIs

const STATIC_CACHE = 'my-money-static-v1';
const API_CACHE = 'my-money-api-v1';

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
      caches.open(API_CACHE).then((cache: Cache) => {
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
        fetch(request).then((fetchResponse: Response) => {
          // Cache new responses
          if (fetchResponse.status === 200) {
            const responseToCache = fetchResponse.clone();
            void caches.open(STATIC_CACHE).then((cache: Cache) => {
              void cache.put(request, responseToCache);
            });
          }
          return fetchResponse;
        })
      );
    }),
  );
});


