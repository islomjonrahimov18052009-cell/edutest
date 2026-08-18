const CACHE = 'edutest-v37';
const IMG_CACHE = 'edutest-img-v1';
const FILES = ['./', './index.html'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(FILES).catch(function(){});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

function isImageRequest(url) {
  // Supabase Storage'dagi savol/javob rasmlari (edutest-images bucket) -
  // boshqa origindan keladi, shuning uchun asosiy sayt keshidan alohida,
  // MAXSUS kesh bilan boshqariladi (offline test uchun MUHIM).
  return /\/storage\/v1\/object\/public\/edutest-images\//.test(url) ||
         /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
}

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;

  if (isImageRequest(url)) {
    // Kesh-birinchi (cache-first): agar oldin keshlangan bo'lsa, internet
    // bo'lmasa ham DARHOL o'sha rasm ko'rsatiladi - test davomida internet
    // o'chib qolsa ham savol/javob rasmlari yo'qolmaydi.
    e.respondWith(
      caches.open(IMG_CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var fetchPromise = fetch(e.request).then(function(res) {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          }).catch(function() { return cached; });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // MUHIM: faqat OZ saytimiz (GitHub Pages) fayllarini keshlaymiz.
  // Avval bu tekshiruv yoq edi, shuning uchun Render serverimizga ketayotgan
  // /parse_batch_status kabi DINAMIK API sorovlari ham shu yerda ushlanib,
  // ikkilanib xato berardi va bekorga keshlashga urinardi.
  if (new URL(url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function(res) {
      var clone = res.clone();
      caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});

// Test boshlanishidan oldin index.html shu buyruq bilan kerakli rasmlarni
// OLDINDAN yuklab, IMG_CACHE'ga solib qo'yadi - shunda test davomida
// internet o'chsa ham rasmlar allaqachon lokal keshda bo'ladi.
self.addEventListener('message', function(e) {
  var data = e.data || {};
  if (data.type === 'CACHE_IMAGES' && Array.isArray(data.urls)) {
    e.waitUntil(
      caches.open(IMG_CACHE).then(function(cache) {
        return Promise.all(data.urls.map(function(u) {
          return fetch(u).then(function(res) {
            if (res && res.status === 200) return cache.put(u, res);
          }).catch(function(){});
        }));
      })
    );
  }
});

// ─── PUSH BILDIRISHNOMA ────────────────────────────────────────────────────
// Ustozga: "yangi imtihon natijasi keldi" yoki "o'quvchi internetsiz
// topshirdi, internet tiklanganda tekshiring" kabi xabarlar shu orqali
// keladi (server /notify_teacher orqali yuboradi).
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  var title = data.title || 'EduTest Pro';
  var opts = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
