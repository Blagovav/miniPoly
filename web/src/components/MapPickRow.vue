<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "./Icon.vue";
import BoardPreview from "./BoardPreview.vue";
import { findBoard, RARITY_META } from "../utils/boards";

const props = defineProps<{
  boardId: string;
  editable?: boolean;
  onOpen?: () => void;
}>();

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");
const board = computed(() => findBoard(props.boardId));
const meta = computed(() => RARITY_META[board.value.rarity]);
const metaLabel = computed(() => isRu.value ? meta.value.ru : meta.value.en);
const boardName = computed(() => isRu.value ? board.value.ru : board.value.name);
const boardDesc = computed(() => isRu.value ? board.value.desc.ru : board.value.desc.en);
const lockedLabel = computed(() => isRu.value ? "Выбор хозяина" : "Host's choice");
const changeLabel = computed(() => isRu.value ? "Сменить" : "Change");
</script>

<template>
  <div
    class="map-pick-row"
    :style="{ borderColor: editable ? 'var(--line)' : 'var(--divider)' }"
  >
    <div class="map-pick-row__preview" :style="{ borderColor: board.palette.gold }">
      <BoardPreview :board="board" :size="64"/>
    </div>
    <div class="map-pick-row__body">
      <div class="map-pick-row__rarity" :style="{ color: meta.color }">{{ metaLabel }}</div>
      <div class="map-pick-row__name">{{ boardName }}</div>
      <div class="map-pick-row__desc">{{ editable ? boardDesc : lockedLabel }}</div>
    </div>
    <button v-if="editable" class="map-pick-row__btn" @click="onOpen">{{ changeLabel }}</button>
    <Icon v-else name="lock" :size="14" color="var(--ink-4)"/>
  </div>
</template>

<style scoped>
.map-pick-row {
  padding: 10px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.map-pick-row__preview {
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--gold);
  flex-shrink: 0;
  line-height: 0;
}
.map-pick-row__body {
  flex: 1;
  min-width: 0;
}
.map-pick-row__rarity {
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
}
.map-pick-row__name {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--ink);
  line-height: 1.1;
  margin-top: 2px;
}
.map-pick-row__desc {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-pick-row__btn {
  padding: 7px 12px;
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
</style>
