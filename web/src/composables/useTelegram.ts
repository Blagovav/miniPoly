import { ref, shallowRef, markRaw } from "vue";

interface TgWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string; language_code?: string };
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setText: (t: string) => void;
  };
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
    tg.value = markRaw(w);
    initData.value = w.initData ?? "";
    userId.value = w.initDataUnsafe?.user?.id ?? null;
    userName.value = w.initDataUnsafe?.user?.first_name ?? "Player";
  }

  function haptic(style: "light" | "medium" | "heavy" = "light") {
    try {
      tg.value?.HapticFeedback?.impactOccurred(style);
    } catch { /* Telegram WebApp not available — ignore */ }
  }

  function notify(type: "error" | "success" | "warning") {
    try {
      tg.value?.HapticFeedback?.notificationOccurred(type);
    } catch { /* ignore */ }
  }

  function close() {
    try { tg.value?.close(); } catch {}
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

  return { tg, initData, userId, userName, init, haptic, notify, close, setUserName };
}
