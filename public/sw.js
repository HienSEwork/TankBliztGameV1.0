const CACHE = "tank-blitz-v2";
const ASSETS = [
  "index.html",
  "game.html",
  "styles.css",
  "assets/js/assets.js",
  "assets/js/game.js",
  "assets/player_tank.png",
  "assets/enemy_tank.png",
  "assets/boss_tank.png",
  "assets/shark_boss.png",
  "assets/bullet.png",
  "assets/bossBullet.png",
  "assets/shark_bullet.png",
  "assets/brick.png",
  "assets/steel.png",
  "assets/bush.png",
  "assets/water.png",
  "assets/base.png",
  "assets/sound/shot.mp3",
  "assets/sound/killenemy.mp3",
  "assets/sound/killed.mp3",
  "assets/sound/buffdame.mp3",
  "assets/sound/plusheart.mp3",
  "assets/sound/timestop.mp3",
  "assets/sound/startgame.mp3",
  "assets/sound/gameover.mp3",
  "assets/sound/win.mp3",
  "assets/sound/result.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
