const CACHE_NAME = "cbn-timeshift-v1";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./app.js",
    "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {

    console.log("[SW] Instalando...");

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then((cache) => {

                return cache.addAll(FILES_TO_CACHE);

            })

    );

    self.skipWaiting();

});

self.addEventListener("activate", (event) => {

    console.log("[SW] Ativando...");

    event.waitUntil(

        self.clients.claim()

    );

});

self.addEventListener("fetch", (event) => {

    const url = new URL(event.request.url);

    // Cache apenas dos arquivos locais

    if (url.origin === location.origin) {

        event.respondWith(

            caches.match(event.request)
                .then((cached) => {

                    if (cached) {
                        return cached;
                    }

                    return fetch(event.request)
                        .then((response) => {

                            const copy = response.clone();

                            caches.open(CACHE_NAME)
                                .then((cache) => {

                                    cache.put(
                                        event.request,
                                        copy
                                    );

                                });

                            return response;

                        });

                })

        );

    }

});