<script setup lang="ts">
import Icon from "./Icon.vue";

defineProps<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  avatarInitial?: string;
  rightInitial?: boolean;
}>();
</script>

<template>
  <div class="topbar">
    <button v-if="onBack" class="icon-btn" aria-label="Back" @click="onBack">
      <Icon name="back" :size="18"/>
    </button>
    <div v-if="avatarInitial" class="avatar-btn">{{ avatarInitial }}</div>
    <div class="title">
      <h1>{{ title }}</h1>
      <div v-if="subtitle" class="sub">{{ subtitle }}</div>
    </div>
    <slot name="right"/>
    <template v-if="rightInitial">
      <button class="icon-btn" aria-label="notifications">
        <Icon name="bell" :size="18"/>
      </button>
      <button class="icon-btn" aria-label="menu" @click="onMenu">
        <Icon name="menu" :size="18"/>
      </button>
    </template>
  </div>
</template>
