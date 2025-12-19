/**
 * Service Worker for PWA
 * Handles offline caching and background sync
 */

// Type declaration for service worker global scope
declare const self: ServiceWorkerGlobalScope;

const STATIC_CACHE = 'my-money-static-v1';
const API_CACHE = 'my-money-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event: Event): void => {
  if (!(event instanceof ExtendableEvent)) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache: Cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  void self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: Event): void => {
  if (!(event instanceof ExtendableEvent)) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  event.waitUntil(
    caches.keys().then((cacheNames: string[]) => {
      return Promise.all(
        cacheNames
          .filter((name: string) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name: string) => caches.delete(name)),
      );
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  void self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: Event): void => {
  if (!(event instanceof FetchEvent)) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const request = event.request;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  const url = new URL(request.url);

  // Skip non-GET requests
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (request.method !== 'GET') {
    return;
  }

  // Handle GraphQL requests
  if (url.pathname === '/graphql') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    event.respondWith(
      caches.open(API_CACHE).then((cache: Cache) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return fetch(request)
          .then((response: Response) => {
            // Cache successful responses
            if (response.status === 200) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              void cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Return cached response if network fails
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return cache.match(request);
          });
      }),
    );
    return;
  }

  // Handle static assets
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  event.respondWith(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    caches.match(request).then((response: Response | undefined) => {
      return (
        response ??
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        fetch(request).then((fetchResponse: Response) => {
          // Cache new responses
          if (fetchResponse.status === 200) {
            const responseToCache = fetchResponse.clone();
            void caches.open(STATIC_CACHE).then((cache: Cache) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              void cache.put(request, responseToCache);
            });
          }
          return fetchResponse;
        })
      );
    }),
  );
});


