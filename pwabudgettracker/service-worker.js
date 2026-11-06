console.log("Hello from your service worker!");
const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./styles.css",
    "./icons/icon-192x192.png",
    "./icons/icon-512x512.png",
    "./manifest.webmanifest",
    "./indexdb.js",
    "./index.js",
    "https://cdn.jsdelivr.net/npm/chart.js@2.8.0"
  ];
  
  // relative paths so the app also works from a subfolder (e.g. GitHub Pages)
  const CACHE_NAME = "static-cache-v4";
  const DATA_CACHE_NAME = "data-cache-v1";
  
  // installation
  self.addEventListener("install", function (evt) {
    evt.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        console.log("Your files were pre-cached successfully!");
        return cache.addAll(FILES_TO_CACHE);
      })
    );
  
    self.skipWaiting();
  });
  //Remove old cache data
  self.addEventListener("activate", function (evt) {
    evt.waitUntil(
      caches.keys().then(keyList => {
        return Promise.all(
          keyList.map(key => {
            if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
              console.log("Removing old cache data", key);
              return caches.delete(key);
            }
          })
        );
      })
    );
  
    self.clients.claim();
  });

  self.addEventListener("fetch", function (evt) {
    // cache successful requests to the API
    // only GET requests can be cached; POSTs go straight to the network
    if (evt.request.method !== "GET") {
      return;
    }

    if (evt.request.url.includes("/api/")) {
      evt.respondWith(
        caches.open(DATA_CACHE_NAME).then(cache => {
          return fetch(evt.request)
            .then(response => {
              // If the response was good, clone it and store it in the cache.
              if (response.status === 200) {
                cache.put(evt.request.url, response.clone());
              }
  
              return response;
            })
            .catch(err => {
              return cache.match(evt.request);
            });
        }).catch(err => console.log(err))
      );
  
      return;
    }
  
    // if the request is not for the API, serve static assets using "offline-first" approach.
    evt.respondWith(
      caches.match(evt.request).then(function (response) {
        return response || fetch(evt.request);
      })
    );
  });