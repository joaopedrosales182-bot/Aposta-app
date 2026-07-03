// ═══════════════════════════════════════════════
// SERVICE WORKER — Controle de Apostas Pro
// Versão: 1.0.0
// ═══════════════════════════════════════════════
const CACHE_NAME = 'apostas-pro-v1';

// Recursos que ficam em cache para funcionar offline
const CACHE_STATIC = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/fonts/tabler-icons.woff2',
  'https://cdn.jsdelivr.net/npm/apexcharts'
];

// ── INSTALL: faz cache dos recursos estáticos ──
self.addEventListener('install', event=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>{
      console.log('[SW] Fazendo cache dos recursos...');
      return cache.addAll(CACHE_STATIC).catch(e=>{
        console.log('[SW] Erro no cache inicial:', e);
      });
    }).then(()=>self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches antigos ──
self.addEventListener('activate', event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(
        keys.filter(k=>k!==CACHE_NAME).map(k=>{
          console.log('[SW] Removendo cache antigo:', k);
          return caches.delete(k);
        })
      )
    ).then(()=>self.clients.claim())
  );
});

// ── FETCH: estratégia Network First, fallback para cache ──
self.addEventListener('fetch', event=>{
  const { request } = event;
  const url = new URL(request.url);

  // Firebase — nunca cachear, sempre rede (dados em tempo real)
  if(url.hostname.includes('firebase') || url.hostname.includes('firestore')){
    event.respondWith(fetch(request).catch(()=>new Response('',{status:503})));
    return;
  }

  // Para o app principal e recursos estáticos:
  // Network First — tenta rede, cai para cache se offline
  event.respondWith(
    fetch(request)
      .then(response=>{
        // Se a resposta for válida, atualiza o cache
        if(response && response.status===200 && response.type==='basic'){
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache=>{
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(()=>{
        // Offline — serve do cache
        return caches.match(request).then(cached=>{
          if(cached) return cached;
          // Para navegação, serve o index.html
          if(request.mode==='navigate'){
            return caches.match('/index.html') || caches.match('/');
          }
          return new Response('Conteúdo não disponível offline', {status:503});
        });
      })
  );
});

// ── BACKGROUND SYNC — sincroniza quando voltar online ──
self.addEventListener('sync', event=>{
  if(event.tag==='sync-apostas'){
    event.waitUntil(
      self.clients.matchAll().then(clients=>{
        clients.forEach(client=>{
          client.postMessage({type:'SYNC_READY'});
        });
      })
    );
  }
});

// ── MENSAGENS do app principal ──
self.addEventListener('message', event=>{
  if(event.data && event.data.type==='SKIP_WAITING'){
    self.skipWaiting();
  }
});
