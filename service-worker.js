// Đổi số phiên bản mỗi lần deploy lớn để máy đang dùng xóa cache cũ.
const CACHE_NAME = 'sguet-photobooth-v5';
const urlsToCache = [
    '/',
    '/index.html',
    '/preview.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/Frames/Frame_1_final.png',
    '/Frames/Frame_2_final.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Install event - force immediate activation
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force new service worker to activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // Thêm từng file, file nào lỗi (vd thiếu frame) thì bỏ qua chứ không làm hỏng cả lần cài
            Promise.all(urlsToCache.map((url) =>
                cache.add(url).catch((err) => console.log('Không cache được:', url, err))
            ))
        )
    );
});

// File code/giao diện: luôn thử lấy bản mới từ mạng trước, mất mạng mới dùng bản cache.
// (Trước đây dùng cache-first nên sửa app.js xong web vẫn chạy bản cũ.)
function isCodeRequest(url) {
    return url.pathname === '/' || /\.(html|js|css|json)$/.test(url.pathname);
}

// Fetch event
self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Không đụng tới API và công cụ dev
    if (url.pathname.startsWith('/api/') ||
        url.pathname.includes('detector.html') ||
        url.pathname.includes('frame-positions-sample.js')) {
        return;
    }

    // preview.html?img=... mở trên điện thoại khách, không cache từng link
    const cacheable = !(url.pathname === '/preview.html' && url.search);

    if (url.origin === self.location.origin && isCodeRequest(url)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (cacheable && response && response.status === 200 && response.type === 'basic') {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Ảnh frame, font, thư viện CDN: ít thay đổi, lấy từ cache trước cho nhanh
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                return response;
            });
        })
    );
});

// Activate event - take control immediately
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});