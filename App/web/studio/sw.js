/* Static GitHub Pages-compatible caching, confined to this project's scope. */
self.window = self;
importScripts('./offline/catalog.js');
importScripts('./assets/runtime-manifest.js');
const CATALOG = self.CODELAB_OFFLINE_CATALOG;
const PREFIX = 'codelab-library-v2-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE = PREFIX + CATALOG.revision;
const SHELL = ['./', ...self.CODELAB_RUNTIME.shell];
const ENTRY = 'index.html';
const ENTRY_URLS = ['./',ENTRY].map(path=>new URL(path,self.registration.scope).href);
const ALLOWED = new Set([...SHELL, ENTRY, ...CATALOG.files,...self.CODELAB_RUNTIME.files.map(f=>f.path)].map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...new Set([...SHELL, ENTRY])])));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CODELAB_APPLY_UPDATE') return;
  event.waitUntil((async () => {
    const tabs = (await self.clients.matchAll({type:'window',includeUncontrolled:true}))
      .filter(client => client.url.startsWith(self.registration.scope));
    // Another tab may be running an exam, including one on an older app version.
    if (tabs.length > 1) {
      event.ports[0]?.postMessage({ok:false,message:'Close other StudyLab tabs and installed windows before applying the update.'});
      return;
    }
    event.ports[0]?.postMessage({ok:true});
    await self.skipWaiting();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  if (!ALLOWED.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // This entry includes the complete current UI, so online navigation can
    // refresh it without mixing a new document with older cached app modules.
    if(request.mode==='navigate' && ENTRY_URLS.includes(url.href)){
      try{const fresh=await fetch(request);if(fresh.ok){for(const entry of ENTRY_URLS)await cache.put(entry,fresh.clone());return fresh;}}catch{}
    }
    const saved = await cache.match(url.href);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok) await cache.put(url.href, response.clone());
    return response;
  })());
});
