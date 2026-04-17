<script lang="ts">
export type TokenArtId =
  | "knight" | "shield" | "tower" | "crown"
  | "dragon" | "phoenix" | "griffin" | "wyrm";

export interface TokenCatalogEntry {
  id: TokenArtId;
  name: string;
  ru: string;
  tier: "common" | "rare" | "epic" | "legendary";
  price: number;
  unit: "◈" | "★";
  premium?: boolean;
  owned?: boolean;
}

export const TOKEN_CATALOG: TokenCatalogEntry[] = [
  { id: "knight",  name: "Knight",  ru: "Рыцарь",  tier: "common",    price: 0,   unit: "◈", owned: true },
  { id: "shield",  name: "Shield",  ru: "Щит",     tier: "common",    price: 120, unit: "◈" },
  { id: "tower",   name: "Tower",   ru: "Башня",   tier: "rare",      price: 300, unit: "◈" },
  { id: "crown",   name: "Crown",   ru: "Корона",  tier: "rare",      price: 450, unit: "◈" },
  { id: "griffin", name: "Griffin", ru: "Грифон",  tier: "epic",      price: 80,  unit: "★", premium: true },
  { id: "wyrm",    name: "Wyrm",    ru: "Змей",    tier: "epic",      price: 90,  unit: "★", premium: true },
  { id: "dragon",  name: "Dragon",  ru: "Дракон",  tier: "legendary", price: 150, unit: "★", premium: true },
  { id: "phoenix", name: "Phoenix", ru: "Феникс",  tier: "legendary", price: 180, unit: "★", premium: true },
];
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    id: TokenArtId;
    size?: number;
    color?: string;
    shadow?: string;
  }>(),
  { size: 32, color: "#fff", shadow: "#000" }
);
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" style="display: block;">
    <!-- knight -->
    <g v-if="id === 'knight'">
      <path d="M32 78 L28 64 Q26 50 34 40 Q38 32 34 24 L40 20 Q48 22 52 30 L62 28 Q72 32 74 44 L78 54 Q78 66 72 72 L68 78 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M42 22 Q48 14 56 18 L58 28 Q52 30 48 28 Z" :fill="shadow" opacity="0.7"/>
      <path d="M46 24 L50 16 L54 22" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="54" cy="38" r="1.8" :fill="shadow"/>
      <path d="M70 52 Q74 54 74 58" :stroke="shadow" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M38 58 Q58 60 74 54" :stroke="shadow" stroke-width="1.4" fill="none"/>
    </g>
    <!-- shield -->
    <g v-else-if="id === 'shield'">
      <path d="M28 22 L72 22 L72 52 Q72 72 50 84 Q28 72 28 52 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M34 30 L50 42 L66 30" :stroke="shadow" stroke-width="3" fill="none" stroke-linejoin="round" opacity="0.55"/>
      <path d="M34 46 L50 58 L66 46" :stroke="shadow" stroke-width="3" fill="none" stroke-linejoin="round" opacity="0.55"/>
      <circle cx="50" cy="66" r="4" :fill="shadow" opacity="0.7"/>
      <circle cx="32" cy="26" r="1.5" :fill="shadow"/>
      <circle cx="68" cy="26" r="1.5" :fill="shadow"/>
    </g>
    <!-- tower -->
    <g v-else-if="id === 'tower'">
      <rect x="30" y="46" width="40" height="36" :fill="color" :stroke="shadow" stroke-width="2"/>
      <path d="M26 46 L26 38 L32 38 L32 42 L38 42 L38 38 L44 38 L44 42 L50 42 L50 38 L56 42 L56 38 L62 42 L62 38 L68 42 L68 38 L74 38 L74 46 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M44 82 L44 66 Q44 58 50 58 Q56 58 56 66 L56 82" :fill="shadow" opacity="0.8"/>
      <rect x="36" y="54" width="4" height="6" :fill="shadow"/>
      <rect x="60" y="54" width="4" height="6" :fill="shadow"/>
      <line x1="50" y1="38" x2="50" y2="22" :stroke="shadow" stroke-width="1.4"/>
      <path d="M50 22 L60 25 L50 30 Z" :fill="shadow"/>
      <line x1="30" y1="58" x2="70" y2="58" :stroke="shadow" stroke-width="0.8" opacity="0.4"/>
      <line x1="30" y1="70" x2="70" y2="70" :stroke="shadow" stroke-width="0.8" opacity="0.4"/>
    </g>
    <!-- crown -->
    <g v-else-if="id === 'crown'">
      <path d="M22 62 L78 62 L76 74 L24 74 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M22 62 L26 32 L34 50 L42 28 L50 48 L58 28 L66 50 L74 32 L78 62" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="26" cy="32" r="3" :fill="shadow"/>
      <circle cx="42" cy="28" r="3.5" :fill="shadow"/>
      <circle cx="58" cy="28" r="3.5" :fill="shadow"/>
      <circle cx="74" cy="32" r="3" :fill="shadow"/>
      <path d="M50 66 L54 70 L50 74 L46 70 Z" :fill="shadow"/>
      <circle cx="32" cy="68" r="1.5" :fill="shadow" opacity="0.6"/>
      <circle cx="40" cy="68" r="1.5" :fill="shadow" opacity="0.6"/>
      <circle cx="60" cy="68" r="1.5" :fill="shadow" opacity="0.6"/>
      <circle cx="68" cy="68" r="1.5" :fill="shadow" opacity="0.6"/>
    </g>
    <!-- dragon -->
    <g v-else-if="id === 'dragon'">
      <path d="M20 74 Q22 54 36 46 Q48 42 62 46 Q74 48 78 56 Q82 66 76 72 Q72 80 60 80 Q40 80 32 78 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M48 40 L52 24 L56 30 L54 42 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M58 40 L64 22 L68 30 L64 44 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M78 56 L88 58 L86 66 L76 62 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="62" cy="58" r="2.5" :fill="shadow"/>
      <circle cx="62.5" cy="57.5" r="1" :fill="color"/>
      <ellipse cx="84" cy="61" rx="1" ry="1.8" :fill="shadow"/>
      <path d="M78 66 L80 70 L82 66 L84 70 L86 66" :stroke="shadow" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
      <path d="M30 60 Q38 56 46 60" :stroke="shadow" stroke-width="1" fill="none" opacity="0.5"/>
      <path d="M32 70 Q42 66 50 70" :stroke="shadow" stroke-width="1" fill="none" opacity="0.5"/>
      <path d="M38 46 L40 42 L44 46 L46 42 L50 46 L52 42 L56 46" :stroke="shadow" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
    </g>
    <!-- phoenix -->
    <g v-else-if="id === 'phoenix'">
      <path d="M50 50 Q30 30 12 38 Q22 42 28 48 Q14 50 10 60 Q24 58 34 56 Q24 62 22 72 Q36 66 44 60" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M50 50 Q70 30 88 38 Q78 42 72 48 Q86 50 90 60 Q76 58 66 56 Q76 62 78 72 Q64 66 56 60" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M42 48 Q50 40 58 48 L58 70 Q50 76 42 70 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M44 48 Q48 34 50 28 Q52 22 54 28 Q56 34 56 48 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M50 28 L48 18 L52 22" :stroke="shadow" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M50 28 L54 18 L50 22" :stroke="shadow" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M46 70 L40 88 L44 82 L42 92 L48 84 L48 90 L52 82 L52 90 L56 84 L58 92 L56 82 L60 88 L54 70" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="50" cy="40" r="1.8" :fill="shadow"/>
      <path d="M50 44 L47 47 L50 47 L53 47 Z" :fill="shadow"/>
    </g>
    <!-- griffin -->
    <g v-else-if="id === 'griffin'">
      <path d="M28 72 Q30 56 42 50 L48 44 Q52 40 58 42 L66 46 Q74 50 76 62 L78 74 L66 78 L58 78 L50 76 L40 78 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M42 40 Q44 28 50 26 Q58 26 60 36 L62 44 L56 48 L46 48 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M42 38 L34 42 L40 44 L44 42 Z" :fill="shadow"/>
      <circle cx="52" cy="36" r="1.8" :fill="shadow"/>
      <path d="M50 46 Q36 34 22 40 Q28 46 34 48 Q24 50 22 58 Q36 56 42 54" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M26 46 L32 50 M30 52 L36 54" :stroke="shadow" stroke-width="1" opacity="0.5"/>
      <path d="M50 74 L48 88 L56 88 L56 74 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M66 74 L64 88 L72 88 L72 72" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <path d="M48 86 L46 90 L50 90 L52 90 L56 90 L58 90 L56 86" :stroke="shadow" stroke-width="1.2" fill="none"/>
      <path d="M76 74 Q84 70 84 82 Q80 76 76 80" :fill="color" :stroke="shadow" stroke-width="2"/>
    </g>
    <!-- wyrm -->
    <g v-else-if="id === 'wyrm'">
      <path d="M50 18 Q78 18 84 42 Q90 68 64 82 Q36 86 22 68 Q12 44 34 30 Q54 22 62 40 Q68 58 52 66 Q38 68 36 54 Q38 44 50 44 Q58 46 58 54" fill="none" :stroke="color" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50 18 Q78 18 84 42 Q90 68 64 82 Q36 86 22 68 Q12 44 34 30 Q54 22 62 40 Q68 58 52 66 Q38 68 36 54 Q38 44 50 44 Q58 46 58 54" fill="none" :stroke="shadow" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 4" opacity="0.45"/>
      <path d="M56 56 Q62 52 66 56 L62 62 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="62" cy="57" r="1.3" :fill="shadow"/>
      <path d="M52 14 L48 8 L50 14 L52 8" :stroke="shadow" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    </g>
    <!-- default fallback (knight) -->
    <g v-else>
      <path d="M32 78 L28 64 Q26 50 34 40 Q38 32 34 24 L40 20 Q48 22 52 30 L62 28 Q72 32 74 44 L78 54 Q78 66 72 72 L68 78 Z" :fill="color" :stroke="shadow" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="54" cy="38" r="1.8" :fill="shadow"/>
    </g>
  </svg>
</template>
