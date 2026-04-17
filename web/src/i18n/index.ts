import { createI18n } from "vue-i18n";
import en from "./en";
import ru from "./ru";

const stored = typeof localStorage !== "undefined" ? localStorage.getItem("locale") : null;
const tgLang = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
const initial = stored || (tgLang?.startsWith("ru") ? "ru" : "en");

export const i18n = createI18n({
  legacy: false,
  locale: initial,
  fallbackLocale: "en",
  messages: { en, ru },
});

export function setLocale(l: "en" | "ru") {
  i18n.global.locale.value = l;
  if (typeof localStorage !== "undefined") localStorage.setItem("locale", l);
}
