// AREPROG — Service Worker v3 (gestion repo standalone)
// Cache hors-ligne + notifications push en arrière-plan

var CACHE_NAME = 'areprog-gestion-v3';
var OFFLINE_URLS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/firebase-config.js',
  '/js/app.js',
  '/manifest.json',
  '/favicon-32x32.png',
  '/favicon-512.png',
  '/apple-touch-icon.png',
];

// Installation — pré-cacher les ressources essentielles
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // fetch individuel pour éviter qu'une 404 bloque toute l'installation
      return Promise.all(
        OFFLINE_URLS.map(function(url) {
          return fetch(url).then(function(r) {
            if (r.ok) return cache.put(url, r);
          }).catch(function() {
            console.warn('[SW] Impossible de cacher:', url);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activation — supprimer les anciens caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

// Fetch — stratégie Network First avec fallback cache
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // Ne pas intercepter les requêtes Firebase, EmailJS, OLSX
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('emailjs') ||
      url.hostname.includes('olsx') ||
      url.hostname.includes('netlify') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('cloudflare')) {
    return;
  }

  // Pour la page principale et les assets app : Network First, fallback cache
  if (url.pathname === '/' || url.pathname === '/index.html'
      || url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
    e.respondWith(
      fetch(e.request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(e.request) || caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Pour les assets statiques : Cache First
  if (url.pathname.match(/\.(png|jpg|webp|ico|svg|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(response) {
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, response.clone());
          });
          return response;
        });
      })
    );
  }
});

// Réception d'un push
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'AREPROG', {
      body: data.body || '',
      icon: '/favicon-512.png',
      badge: '/favicon-32x32.png',
      tag: 'areprog-rdv',
    })
  );
});

// Clic sur notification
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes('areprog.fr') && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// Messages depuis la page (rappels programmés)
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SCHEDULE_NOTIF') {
    var rdv = e.data.rdv;
    var delay = e.data.delay;
    setTimeout(function() {
      self.registration.showNotification('📅 Rappel AREPROG', {
        body: rdv.heure + ' — ' + rdv.title + (rdv.lieu ? '\n📍 ' + rdv.lieu : ''),
        icon: '/favicon-512.png',
        badge: '/favicon-32x32.png',
        tag: 'areprog-rdv-' + rdv.id,
      });
    }, delay);
  }
});
