const CacheName = "kronterm-shell-v2";
const ShellFiles = ["/", "/index.html", "/manifest.webmanifest", "/app-icon.svg"];

const assetUrlsFrom = (source, baseUrl) =>
    [...source.matchAll(/(?:src|href)=["']([^"']+)["']|url\(["']?([^"')]+)["']?\)/g)]
        .map((match) => match[1] || match[2])
        .filter((url) => url && !url.startsWith("data:"))
        .map((url) => new URL(url, baseUrl).href)
        .filter((url) => new URL(url).origin === self.location.origin);

const cacheGeneratedAssets = async (cache) => {
    const indexResponse = await fetch("/index.html");
    const indexSource = await indexResponse.clone().text();
    await cache.put("/index.html", indexResponse);
    const entryAssets = assetUrlsFrom(indexSource, self.location.origin);
    await cache.addAll(entryAssets);
    for (const stylesheet of entryAssets.filter((url) => url.endsWith(".css"))) {
        const response = await fetch(stylesheet);
        const source = await response.text();
        await cache.addAll(assetUrlsFrom(source, stylesheet));
    }
};

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CacheName).then(async (cache) => {
            await cache.addAll(ShellFiles);
            await cacheGeneratedAssets(cache);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CacheName).map((key) => caches.delete(key))))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
        return;
    }
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    void caches.open(CacheName).then((cache) => cache.put("/index.html", copy));
                    return response;
                })
                .catch(() => caches.match("/index.html"))
        );
        return;
    }
    event.respondWith(
        caches.match(request).then(
            (cached) =>
                cached ??
                fetch(request).then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        void caches.open(CacheName).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
        )
    );
});
