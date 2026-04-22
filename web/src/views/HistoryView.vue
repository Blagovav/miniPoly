<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import Icon from "../components/Icon.vue";

const { locale } = useI18n();
const router = useRouter();

const isRu = () => locale.value === "ru";
</script>

<template>
  <div class="app">
    <div class="topbar">
      <button class="icon-btn" @click="router.back()" aria-label="back">
        <Icon name="back" :size="18" />
      </button>
      <div class="title">
        <h1>{{ isRu() ? "История" : "History" }}</h1>
        <div class="sub">{{ isRu() ? "Скоро" : "Coming soon" }}</div>
      </div>
    </div>
    <div class="content">
      <div class="card" style="text-align: center; padding: 32px 18px;">
        <div style="font-size: 40px; margin-bottom: 8px;">📜</div>
        <div style="font-family: var(--font-display); font-size: 18px; margin-bottom: 4px;">
          {{ isRu() ? "История партий скоро появится" : "Match history coming soon" }}
        </div>
        <div style="font-size: 13px; color: var(--ink-3);">
          {{ isRu() ? "Мы собираем статистику — загляни позже." : "We're collecting stats — check back later." }}
        </div>
      </div>
    </div>
  </div>
</template>
