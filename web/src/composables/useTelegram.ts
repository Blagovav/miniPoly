import { ref, shallowRef, markRaw } from "vue";
import { useSettings } from "./useSettings";

interface TgWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string; language_code?: string };
  };
  version?: string;
  isFullscreen?: boolean;
  isVerticalSwipesEnabled?: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast?: (v: string) => boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  isClosingConfirmationEnabled?: boolean;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  onEvent?: (event: string, handler: (...args: unknown[]) => void) => void;
  offEvent?: (event: string, handler: (...args: unknown[]) => void) => void;
  requestWriteAccess?: (cb?: (granted: boolean) => void) => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setText: (t: string) => void;
  };
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
  themeParams?: Record<string, string>;
  colorScheme?: "light" | "dark";
}

// shallowRef + markRaw: Vue will not deeply proxy the Telegram object
// (its properties like HapticFeedback are non-configurable and reject Proxy wrapping).
const tg = shallowRef<TgWebApp | null>(null);
const initData = ref<string>("");
const userId = ref<number | null>(null);
const userName = ref<string>("");

export function useTelegram() {
  function init() {
    const w = (window as any).Telegram?.WebApp as TgWebApp | undefined;
    if (!w) {
      // Dev-режим: генерим/читаем стабильный devId и кодируем его в initData.
      const storedId = localStorage.getItem("devId");
      const devId = storedId ? Number(storedId) : Math.floor(Math.random() * 1_000_000);
      localStorage.setItem("devId", String(devId));
      const devName = localStorage.getItem("devName") ?? `Player${devId % 1000}`;
      const userPayload = JSON.stringify({ id: devId, first_name: devName });
      initData.value = `user=${encodeURIComponent(userPayload)}&auth_date=${Math.floor(Date.now() / 1000)}`;
      userId.value = devId;
      userName.value = devName;
      return;
    }
    try { w.ready(); } catch {}
    try { w.expand(); } catch {}
    // Match Telegram's own header/background/bottom bars to our Figma
    // brand blue. Telegram automatically picks white-tinted icons when
    // the bar is dark, so the title pill ("Mini Poly") and the close
    // chevron stay readable. The colour gets re-set by App.vue when
    // the user navigates to Create (#faf3e2 cream) or into an active
    // game (#9fe101 board green) — see setBgColor below.
    try { w.setHeaderColor?.("#0d68db"); } catch {}
    try { w.setBackgroundColor?.("#0d68db"); } catch {}
    try { w.setBottomBarColor?.("#0d68db"); } catch {}
    // Fullscreen (Bot API 8.0+) — прячет шапку Telegram, когда Mini App открыт из диалога.
    // Без этого приложение показывается как bottom sheet с видимым хедером Telegram.
    try {
      const supportsFs = w.isVersionAtLeast?.("8.0") && !!w.requestFullscreen;
      if (supportsFs && !w.isFullscreen) {
        w.requestFullscreen!();
      }
    } catch { /* старая версия Telegram — остаёмся в expanded */ }
    // Глобально глушим вертикальный свайп-минимайз (Bot API 7.7+). Без этого
    // любой свайп вниз по доске/карточкам случайно сворачивает Mini App —
    // пользователь жаловался, что свайпает товары и игра закрывается.
    try { w.disableVerticalSwipes?.(); } catch {}
    // Просим разрешение писать в личку — нужно для push-уведомлений о ходе.
    try {
      if (w.requestWriteAccess && !localStorage.getItem("writeAccessAsked")) {
        w.requestWriteAccess(() => localStorage.setItem("writeAccessAsked", "1"));
      }
    } catch {}
    tg.value = markRaw(w);
    initData.value = w.initData ?? "";
    const tgUser = w.initDataUnsafe?.user;
    if (tgUser?.id) {
      userId.value = tgUser.id;
      userName.value = tgUser.first_name ?? "Player";
    } else {
      // Telegram WebApp есть, но пользователя нет (dev-preview, broken launch) —
      // падаем на стабильный devId, чтобы профиль/друзья/инвайты работали.
      const storedId = localStorage.getItem("devId");
      const devId = storedId ? Number(storedId) : Math.floor(Math.random() * 1_000_000);
      localStorage.setItem("devId", String(devId));
      const devName = localStorage.getItem("devName") ?? `Player${devId % 1000}`;
      userId.value = devId;
      userName.value = devName;
      if (!initData.value) {
        const userPayload = JSON.stringify({ id: devId, first_name: devName });
        initData.value = `user=${encodeURIComponent(userPayload)}&auth_date=${Math.floor(Date.now() / 1000)}`;
      }
    }
  }

  function haptic(style: "light" | "medium" | "heavy" = "light") {
    if (!useSettings().value.vibration) return;
    try {
      tg.value?.HapticFeedback?.impactOccurred(style);
    } catch { /* Telegram WebApp not available — ignore */ }
  }

  function notify(type: "error" | "success" | "warning") {
    if (!useSettings().value.vibration) return;
    try {
      tg.value?.HapticFeedback?.notificationOccurred(type);
    } catch { /* ignore */ }
  }

  function close() {
    try { tg.value?.close(); } catch {}
  }

  /**
   * Repaint Telegram's header / safe-area / bottom-bar to a single hex
   * colour. Idempotent — same hex is just no-op'd by Telegram. Skipped
   * cleanly when running outside the WebView (dev). Used by App.vue to
   * keep the chrome in sync with the active screen's body background
   * so the "Mini Poly" title pill and close chevron never sit on a
   * mismatched colour.
   */
  function setBgColor(hex: string) {
    const w = tg.value;
    if (!w) return;
    try { w.setHeaderColor?.(hex); } catch {}
    try { w.setBackgroundColor?.(hex); } catch {}
    try { w.setBottomBarColor?.(hex); } catch {}
  }

  // Во время активной партии включаем диалог "Точно закрыть?" на свайп/крестик
  // Telegram — чтобы случайный жест не терял прогресс.
  function setClosingConfirmation(enabled: boolean) {
    try {
      if (enabled) tg.value?.enableClosingConfirmation?.();
      else tg.value?.disableClosingConfirmation?.();
    } catch { /* старая версия Telegram — ignore */ }
  }

  function setUserName(name: string) {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    userName.value = trimmed;
    localStorage.setItem("devName", trimmed);
    // Пересобираем initData с новым именем чтобы сервер его увидел на следующем join.
    if (!tg.value) {
      const devId = userId.value ?? Math.floor(Math.random() * 1_000_000);
      const userPayload = JSON.stringify({ id: devId, first_name: trimmed });
      initData.value = `user=${encodeURIComponent(userPayload)}&auth_date=${Math.floor(Date.now() / 1000)}`;
    }
  }

  async function fetchProfile(id?: number | null): Promise<{
    gamesPlayed: number; gamesWon: number; totalEarned: number; winRate: number;
  } | null> {
    const target = id ?? userId.value;
    if (!target) return null;
    try {
      const base = (import.meta.env.VITE_API_URL as string) || "";
      const res = await fetch(`${base}/api/users/${target}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.profile;
    } catch { return null; }
  }

  return { tg, initData, userId, userName, init, haptic, notify, close, setClosingConfirmation, setUserName, fetchProfile, setBgColor };
}
