<script lang="ts">
export type IconName =
  | "back" | "menu" | "bell" | "dice" | "trade" | "check" | "x" | "plus"
  | "coin" | "castle" | "shield" | "trophy" | "users" | "bag" | "user"
  | "home" | "scroll" | "globe" | "search" | "send" | "crown" | "key"
  | "lock" | "unlock" | "star" | "chat" | "horse" | "tavern" | "swords"
  | "banner" | "chalice" | "helm" | "mic" | "micOff";
</script>

<script setup lang="ts">
defineProps<{
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}>();
</script>

<template>
  <svg
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    style="display: block; flex-shrink: 0;"
  >
    <!-- back -->
    <path v-if="name === 'back'" d="M15 18l-6-6 6-6" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- menu -->
    <template v-else-if="name === 'menu'">
      <line x1="4" y1="7" x2="20" y2="7" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" stroke-linecap="round"/>
      <line x1="4" y1="12" x2="20" y2="12" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" stroke-linecap="round"/>
      <line x1="4" y1="17" x2="20" y2="17" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" stroke-linecap="round"/>
    </template>
    <!-- bell -->
    <template v-else-if="name === 'bell'">
      <path d="M6 9a6 6 0 1112 0c0 4 2 5 2 5H4s2-1 2-5z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 19a2 2 0 004 0" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- dice -->
    <template v-else-if="name === 'dice'">
      <rect x="4" y="4" width="16" height="16" rx="2" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <circle cx="9" cy="9" r="1" :fill="color ?? 'currentColor'"/>
      <circle cx="15" cy="9" r="1" :fill="color ?? 'currentColor'"/>
      <circle cx="9" cy="15" r="1" :fill="color ?? 'currentColor'"/>
      <circle cx="15" cy="15" r="1" :fill="color ?? 'currentColor'"/>
    </template>
    <!-- trade -->
    <path v-else-if="name === 'trade'" d="M7 7h13l-3-3M17 17H4l3 3" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- check -->
    <path v-else-if="name === 'check'" d="M5 12l4 4L19 6" :stroke="color ?? 'currentColor'" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- x -->
    <template v-else-if="name === 'x'">
      <line x1="6" y1="6" x2="18" y2="18" :stroke="color ?? 'currentColor'" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="18" y1="6" x2="6" y2="18" :stroke="color ?? 'currentColor'" stroke-width="2.2" stroke-linecap="round"/>
    </template>
    <!-- plus -->
    <template v-else-if="name === 'plus'">
      <line x1="12" y1="5" x2="12" y2="19" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" stroke-linecap="round"/>
      <line x1="5" y1="12" x2="19" y2="12" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" stroke-linecap="round"/>
    </template>
    <!-- coin -->
    <template v-else-if="name === 'coin'">
      <circle cx="12" cy="12" r="8" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M9 10c0-1 1-2 3-2s3 1 3 2-1 1.5-3 2-3 1-3 2 1 2 3 2 3-1 3-2M12 6v2M12 16v2" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- castle -->
    <template v-else-if="name === 'castle'">
      <path d="M4 20V10l2 2V8l2 2V8l2 2V8l2 2V8l2 2V8l2 2V8l2 2v10z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
      <path d="M9 20v-4h6v4" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
    </template>
    <!-- shield -->
    <path v-else-if="name === 'shield'" d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
    <!-- trophy -->
    <template v-else-if="name === 'trophy'">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
    </template>
    <!-- users -->
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="9" r="3" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M3 19c0-3 3-5 6-5s6 2 6 5" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
      <circle cx="17" cy="8" r="2.5" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M15 13c3 0 6 2 6 5" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- bag -->
    <template v-else-if="name === 'bag'">
      <path d="M6 8h12l-1 12H7z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
      <path d="M9 8a3 3 0 016 0" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
    </template>
    <!-- user -->
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="9" r="3.5" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- home -->
    <path v-else-if="name === 'home'" d="M4 11l8-7 8 7v9h-6v-6h-4v6H4z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
    <!-- scroll -->
    <template v-else-if="name === 'scroll'">
      <path d="M6 4h12v14a2 2 0 01-2 2H8a2 2 0 01-2-2V4z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M9 8h6M9 11h6M9 14h4" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- globe -->
    <template v-else-if="name === 'globe'">
      <circle cx="12" cy="12" r="8" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M4 12h16M12 4c2 3 2 13 0 16M12 4c-2 3-2 13 0 16" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
    </template>
    <!-- search -->
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="6" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <line x1="16" y1="16" x2="20" y2="20" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" stroke-linecap="round"/>
    </template>
    <!-- send -->
    <path v-else-if="name === 'send'" d="M4 12L20 4l-4 16-3-7z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
    <!-- crown -->
    <path v-else-if="name === 'crown'" d="M3 8l3 6h12l3-6-4 3-3-5-2 5-2-5-3 5z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
    <!-- key -->
    <template v-else-if="name === 'key'">
      <circle cx="8" cy="12" r="4" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M12 12h9l-2 2M17 12v3" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- lock -->
    <template v-else-if="name === 'lock'">
      <rect x="5" y="11" width="14" height="9" rx="1.5" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M8 11V7a4 4 0 018 0v4" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
    </template>
    <!-- unlock -->
    <template v-else-if="name === 'unlock'">
      <rect x="5" y="11" width="14" height="9" rx="1.5" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M8 11V7a4 4 0 018 0" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
    </template>
    <!-- star -->
    <path v-else-if="name === 'star'" d="M12 3l2.5 6 6.5.5-5 4.5 1.5 6.5L12 17l-5.5 3.5L8 14l-5-4.5L9.5 9z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
    <!-- chat -->
    <path v-else-if="name === 'chat'" d="M4 5h16v10H9l-5 5V5z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
    <!-- horse -->
    <path v-else-if="name === 'horse'" d="M5 20h14M7 20V9l5-5 4 3-2 2 3 3v8M9 14h2" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
    <!-- tavern -->
    <template v-else-if="name === 'tavern'">
      <path d="M4 9l3-5h10l3 5M5 9h14v11H5z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
      <path d="M12 9v11M8 13h8" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- swords -->
    <path v-else-if="name === 'swords'" d="M5 4l7 7M19 4l-7 7M12 11l3 3-4 4-3-3zM12 11l-3 3 4 4 3-3z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
    <!-- banner -->
    <template v-else-if="name === 'banner'">
      <path d="M7 3h10v12l-5-3-5 3z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
      <path d="M7 3v18M17 3v18" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- chalice -->
    <path v-else-if="name === 'chalice'" d="M6 4h12v3c0 4-3 6-6 6s-6-2-6-6V4zM12 13v6M8 20h8" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- helm -->
    <template v-else-if="name === 'helm'">
      <path d="M5 12a7 7 0 0114 0v6H5z" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linejoin="round"/>
      <path d="M5 15h14M9 11v3M15 11v3" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- mic -->
    <template v-else-if="name === 'mic'">
      <rect x="9" y="3" width="6" height="11" rx="3" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
    </template>
    <!-- micOff -->
    <template v-else-if="name === 'micOff'">
      <rect x="9" y="3" width="6" height="11" rx="3" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none"/>
      <path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8" :stroke="color ?? 'currentColor'" :stroke-width="strokeWidth ?? 1.8" fill="none" stroke-linecap="round"/>
      <line x1="3" y1="3" x2="21" y2="21" :stroke="color ?? 'currentColor'" stroke-width="2.2" stroke-linecap="round"/>
    </template>
  </svg>
</template>
