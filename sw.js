const CACHE = 'edutest-v23';
const FILES = ['./', './index.html'];

self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(FILES).catch(function(){});
    })
  );
  // skipWaiting() endi bu yerda emas - foydalanuvchi "Yangilash"
  // tugmasini bosganda SKIP_WAITING xabari orqali chaqiriladi.
  // Bu - yangilash xabarsiz, foydalanuvchi bilmagan holda bo'lib
  // qolmasligini ta'minlaydi (test ishlayotganda ham xavfsiz).
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  // MUHIM: faqat OZ saytimiz (GitHub Pages) fayllarini keshlaymiz.
  // Avval bu tekshiruv yoq edi, shuning uchun Render serverimizga ketayotgan
  // /parse_batch_status kabi DINAMIK API sorovlari ham shu yerda ushlanib,
  // ikkilanib xato berardi va bekorga keshlashga urinardi.
  if (new URL(e.request.url).origin !== self.location.origin) return;
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
