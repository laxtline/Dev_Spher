/* Cache this project's public files as they are used. Personal progress stays in browser storage. */
const PREFIX='pratice-code-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+'__REVISION__';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./','index.html','unified.js','unified.css','browser-api.js','level-wise.js']))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='CODELAB_APPLY_UPDATE')event.waitUntil((async()=>{const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});if(tabs.filter(t=>t.url.startsWith(self.registration.scope)).length>1){event.ports[0]?.postMessage({ok:false,message:'Close other Pratice Code tabs before applying the update.'});return;}event.ports[0]?.postMessage({ok:true});await self.skipWaiting();})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{const response=await fetch(request);if(response.ok&&!response.headers.get('content-range'))await cache.put(request,response.clone());return response;}
   catch(error){const cached=await cache.match(request);if(cached)return cached;if(request.mode==='navigate')return cache.match('index.html');throw error;}
 })());
});
