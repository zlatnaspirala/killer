/* Killer Engine PWA Service Worker */
'use strict';

const CACHE_PREFIX = 'killer-engine-pwa-v';
const CACHE_VERSION = 206;
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const MAX_RUNTIME_ENTRIES = 300;
const SHELL_URLS = ['/', '/index.html', '/style.css'];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/socket.io/');
}

function isStaticAsset(url) {
  return /\\.(?:js|mjs|css|wasm|glb|gltf|bin|data|png|jpe?g|webp|gif|svg|ico|ktx2?|basis|hdr|mp3|wav|ogg|mp4|woff2?|ttf|otf)$/i.test(url.pathname);
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_RUNTIME_ENTRIES) {
    await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES).map(key => cache.delete(key)));
  }
}

async function cacheResponse(cache, request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque' ||
      response.headers.get('Cache-Control')?.includes('no-store')) return response;
  await cache.put(request, response.clone());
  await trimCache(cache);
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_URLS.map(async url => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
      } catch (error) {
        console.warn('[Killer PWA] Precache skipped:', url, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(name => {
      if ((name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) ||
          name.startsWith('moba-assets-cache-v')) return caches.delete(name);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (!isSameOrigin(url) || isApiRequest(url) || request.headers.has('authorization')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put('/index.html', response.clone());
        return response;
      } catch (error) {
        return (await cache.match(request)) || (await cache.match('/index.html')) ||
          new Response('Killer is offline. Reconnect and reload to continue.', {
            status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      return await cacheResponse(cache, request, response);
    } catch (error) {
      return new Response('', { status: 504, statusText: 'Asset unavailable offline' });
    }
  })());
});
