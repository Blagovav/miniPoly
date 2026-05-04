<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  request: { requestId: number; fromUserId: number; fromName: string };
  onRespond: (requestId: number, accept: boolean) => void;
}>();

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "Запрос в друзья",
      body: (name: string) => `${name} хочет добавить тебя в друзья`,
      accept: "ПРИНЯТЬ",
      decline: "ОТКЛОНИТЬ",
    }
  : {
      title: "Friend request",
      body: (name: string) => `${name} wants to add you as a friend`,
      accept: "ACCEPT",
      decline: "DECLINE",
    });

function accept() {
  props.onRespond(props.request.requestId, true);
}
function decline() {
  props.onRespond(props.request.requestId, false);
}
</script>

<template>
  <div class="friend-req-backdrop" role="dialog" aria-modal="true">
    <div class="friend-req-card">
      <h3 class="friend-req-card__title">{{ L.title }}</h3>
      <p class="friend-req-card__body">{{ L.body(request.fromName) }}</p>
      <div class="friend-req-card__actions">
        <button
          type="button"
          class="friend-req-btn friend-req-btn--decline"
          @click="decline"
        >{{ L.decline }}</button>
        <button
          type="button"
          class="friend-req-btn friend-req-btn--accept"
          @click="accept"
        >{{ L.accept }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.friend-req-backdrop {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.friend-req-card {
  width: 100%;
  max-width: 360px;
  background: #faf3e2;
  border: 2px solid #000;
  border-radius: 22px;
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-family: 'Unbounded', 'Golos Text', sans-serif;
}
.friend-req-card__title {
  margin: 0;
  font-weight: 900;
  font-size: 18px;
  line-height: 22px;
  color: #000;
  text-align: center;
}
.friend-req-card__body {
  margin: 0;
  font-weight: 500;
  font-size: 14px;
  line-height: 18px;
  color: #1a0f05;
  text-align: center;
}
.friend-req-card__actions {
  display: flex;
  gap: 10px;
}
.friend-req-btn {
  flex: 1;
  height: 44px;
  border-radius: 14px;
  border: 2px solid #000;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 15px;
  line-height: 18px;
  color: #fff;
  cursor: pointer;
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.2);
  transition: transform 80ms ease, box-shadow 120ms ease;
}
.friend-req-btn:active {
  transform: translateY(1px);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.2);
}
.friend-req-btn--accept { background: #43c22d; }
.friend-req-btn--decline { background: #fff; color: #000; }
</style>
