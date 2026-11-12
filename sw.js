'use strict';

/**
 * @description cacheVersion
 * Increment this version number when assets or code are updated to automatically
 * flush the client browser's stale cache and fetch fresh copies.
 */
var cacheVersion = 205;
var prefix = 'moba-assets-cache-v';
var cacheName = prefix + cacheVersion;

// Cleanup old caches automatically on service worker registration
try {
  for (var j = 0; j < cacheVersion; j++) {
    var oldCacheName = prefix + j;
    caches.delete(oldCacheName);
  }
  for (var j = 220; j > cacheVersion; j--) {
    var oldCacheName = prefix + j;
    caches.delete(oldCacheName);
  }
} catch (e) {
  console.error("Cache cleanup error:", e);
}

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  // Never cache POST requests or non-HTTP endpoints (like chrome-extension:// or ws://)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  const url = event.request.url.toLowerCase();
  
  // High-performance selective caching rules for heavy static web assets:
  // .glb models, .mp3 music files, and .wasm binaries.
  const isCacheableAsset = url.endsWith('.glb') || 
                           url.endsWith('.gltf') ||
                           url.endsWith('.mp3') || 
                           url.endsWith('.wasm') || 
                           url.includes('/assets/audio/') ||
                           url.includes('/assets/models/');

  if (!isCacheableAsset) {
    return; // Pass-through directly to network (no cache pollution)
  }

  event.respondWith(
    caches.open(cacheName).then(function(cache) {
      return cache.match(event.request).then(function(cachedResponse) {
        if (cachedResponse) {
          // Cache hit: Serve immediately for instant loading
          return cachedResponse;
        }
        
        // Cache miss: Fetch from network and put a cloned copy into the cache
        return fetch(event.request).then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            // Put cloned response in cache
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(function(err) {
          console.error("Fetch failed for cacheable asset:", url, err);
        });
      });
    })
  );
});
