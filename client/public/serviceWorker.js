// client/public/serviceWorker.js

// Increment this version to force cache refresh
const CACHE_NAME = 'traveler-v3';

// Core app shell files to pre-cache for offline support
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/logo.svg'
];

// File extensions that should use stale-while-revalidate (cache + background update)
const STATIC_EXTENSIONS = ['.js', '.css', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'];

// Check if a URL is for static assets
function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some(ext => url.pathname.endsWith(ext));
}

// Check if request is for navigation (HTML pages)
function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Install: Pre-cache essential files only (fault-tolerant)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('[SW] Pre-caching app shell');
        // Cache each file individually so one failure doesn't break everything
        const cachePromises = PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn(`[SW] Failed to cache ${url}:`, error.message);
          }
        });
        return Promise.all(cachePromises);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate: Clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch: Use appropriate strategy based on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests
  if (!url.origin.startsWith(self.location.origin)) {
    return;
  }

  // Skip API calls - always go to network
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Skip uploaded files - always fetch fresh
  if (url.pathname.startsWith('/uploads/')) {
    return;
  }

  // Strategy 1: Navigation requests (HTML) - Network first, cache fallback
  if (isNavigationRequest(event.request)) {
    event.respondWith(networkFirstWithCacheFallback(event.request));
    return;
  }

  // Strategy 2: Static assets - Stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Default: Network only (don't cache unknown content)
  event.respondWith(fetch(event.request));
});

// Network-first strategy: Try network, fallback to cache, then offline page
async function networkFirstWithCacheFallback(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses for offline use
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // No cache, return offline page
    return caches.match('/offline.html');
  }
}

// Stale-while-revalidate: Return cache immediately, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Always fetch in background to update cache
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed, but we might have cache
      return null;
    });

  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // No cache, wait for network
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // Both failed
  return new Response('Resource unavailable offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}