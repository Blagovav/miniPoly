/**
 * Lists of Figma image assets used by each screen, plus a preload helper.
 *
 * Why we preload: Telegram WebView ships images on demand, so when a user
 * lands on Rooms / Room / Create the first time, every <img> sits empty
 * for 100–500 ms while the browser fetches and decodes the .webp. That's
 * the "flicker" — visible white slot, then BAM, image appears.
 *
 * Strategy: during the boot splash (MIN_BOOT_MS ≈ 700 ms — see App.vue),
 * decode the home-screen art before hiding the splash so HomeView renders
 * with everything already in the cache. Then fire-and-forget the rest in
 * the background so subsequent screens are instant too.
 *
 * Anything in `public/figma/` referenced from a `<img src=>` or CSS
 * `url()` should appear here, otherwise the first visit to the screen
 * still flickers.
 */

/** First screen after splash — must be decoded before splash hides. */
export const HOME_ASSETS: readonly string[] = [
  "/figma/home/bg-pattern.webp",
  "/figma/home/mascot.webp",
  "/figma/home/dice.webp",
  "/figma/home/magnifier.webp",
  "/figma/home/history.webp",
  "/figma/home/shop.webp",
  "/figma/home/friends.webp",
  "/figma/home/settings.webp",
];

/** Rooms list / splash chars — second-priority, prefetch after boot. */
export const ROOMS_ASSETS: readonly string[] = [
  "/figma/rooms/char-empty.webp",
];

/** Splash logo (already shown before any preload runs, but kept for completeness). */
export const SPLASH_ASSETS: readonly string[] = [
  "/figma/splash/logo.webp",
];

/** In-game art — preloaded after boot so entering a room is instant. */
export const ROOM_ASSETS: readonly string[] = [
  "/figma/room/bg-pattern.webp",
  "/figma/room/icon-money.webp",
  "/figma/room/icon-chair.webp",
  "/figma/room/icon-stopwatch.webp",
  "/figma/room/nav-chat.webp",
  "/figma/room/nav-home.webp",
  "/figma/room/nav-menu.webp",
  "/figma/room/btn-dice-deco.webp",
  "/figma/room/dice-a.webp",
  "/figma/room/dice-b.webp",
  "/figma/room/turn-arrow.webp",
  "/figma/room/medal-gold.webp",
  "/figma/room/medal-silver.webp",
  "/figma/room/medal-bronze.webp",
  // Board tile art (BoardTile.vue picks one based on tile.kind/index).
  "/figma/room/tile-bag.webp",
  "/figma/room/tile-chest.webp",
  "/figma/room/tile-chest2.webp",
  "/figma/room/tile-coin.webp",
  "/figma/room/tile-money-stack.webp",
  "/figma/room/tile-question.webp",
  "/figma/room/tile-jail.webp",
  "/figma/room/tile-parking.webp",
  "/figma/room/tile-luxury.webp",
  "/figma/room/tile-corner-bl.webp",
  "/figma/room/tile-corner-br.webp",
  "/figma/room/tile-corner-tl.webp",
  "/figma/room/tile-corner-tr.webp",
  // Room avatars used by the leaderboard.
  "/figma/room/avatar-alex.webp",
  "/figma/room/avatar-dan.webp",
  "/figma/room/avatar-nikita.webp",
  "/figma/room/avatar-placeholder.webp",
];

/** Create-game screen art — small, prefetch with the rest. */
export const CREATE_ASSETS: readonly string[] = [
  "/figma/create/money.webp",
  "/figma/create/edit-pencil.svg",
];

/**
 * Per-route asset bundles. RouteLoader uses this to decide whether to
 * show the splash overlay during navigation — if every asset for the
 * destination is already in the in-memory cache, the loader stays
 * hidden and the view shows instantly.
 *
 * Keys MUST match the `name` field on the router routes in main.ts.
 * Routes without an entry skip the loader entirely (e.g. shop/friends/
 * history, which are mostly text + Icon SVGs).
 */
export const ROUTE_ASSETS: Readonly<Record<string, readonly string[]>> = {
  home: HOME_ASSETS,
  rooms: ROOMS_ASSETS,
  create: CREATE_ASSETS,
  room: ROOM_ASSETS,
};

/**
 * URLs whose `preloadImage()` call has already resolved. We use this to
 * answer "is this asset hot?" synchronously, so RouteLoader can skip the
 * overlay entirely on cache-warm navigations.
 */
const decodedUrls = new Set<string>();

/**
 * Fetch + decode a single image into the browser's memory cache.
 * Resolves on success; swallows network/decoder failures so a single
 * bad asset never blocks the rest of boot. Idempotent — repeat calls
 * for the same URL resolve immediately from the in-memory tracker.
 */
export function preloadImage(url: string): Promise<void> {
  if (decodedUrls.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      decodedUrls.add(url);
      resolve();
    };
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // Some browsers expose decode() — use it when available so the
      // pixel data is ready, not just the HTTP response.
      if (typeof img.decode === "function") {
        img.decode().then(finish, finish);
      } else {
        finish();
      }
    };
    img.onerror = finish;
    img.src = url;
  });
}

/** Preload many assets in parallel; resolves once all are settled. */
export function preloadAll(urls: readonly string[]): Promise<void> {
  return Promise.allSettled(urls.map(preloadImage)).then(() => undefined);
}

/** True iff every URL has finished decoding at least once this session. */
export function allAssetsCached(urls: readonly string[]): boolean {
  return urls.every((u) => decodedUrls.has(u));
}
