const CACHE = "viveiro-cache-v1";

const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE)
        .then(cache =>
          cache.addAll(ASSETS)
        )

    );

  }
);


self.addEventListener(
  "fetch",
  event => {

    event.respondWith(

      caches
        .match(event.request)
        .then(resposta =>

          resposta ||
          fetch(event.request)

        )

    );

  }
);
