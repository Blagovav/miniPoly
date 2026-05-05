<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  request: { requestId: number; fromUserId: number; fromName: string };
  onRespond: (requestId: number, accept: boolean) => void;
}>();

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");
// Copy comes straight from Figma 166:4614 — the receiver popup. The
// designer wanted a longer body explaining the perk so newcomers
// understand why the prompt is even worth answering.
const L = computed(() => isRu.value
  ? {
      title: "Вас приглашают в друзья",
      body: (name: string) =>
        `Игрок ${name} приглашает вас стать другом. Примите приглашение и вы сможете быстрее добавить друг друга в партию и отображаться друг у друга в списке друзей в профиле`,
      accept: "ПРИНЯТЬ",
      decline: "ОТКАЗАТЬСЯ",
    }
  : {
      title: "You have a friend request",
      body: (name: string) =>
        `${name} wants to add you as a friend. Accept and you'll be able to invite each other to matches faster and show up in each other's friend list.`,
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
      <div class="friend-req-card__text">
        <h3 class="friend-req-card__title">{{ L.title }}</h3>
        <p class="friend-req-card__body">{{ L.body(request.fromName) }}</p>
      </div>
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
/* Bottom-anchored sheet (Figma 166:4614). The dark scrim covers the
   end-of-game results so the receiver focuses on the prompt. */
.friend-req-backdrop {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px calc(24px + var(--sa-l, 0px)) calc(16px + var(--csab, 0px)) calc(24px + var(--sa-r, 0px));
}
.friend-req-card {
  width: 100%;
  max-width: 345px;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  font-family: 'Unbounded', 'Golos Text', sans-serif;
}
.friend-req-card__text {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}
.friend-req-card__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 24px;
  color: #000;
}
.friend-req-card__body {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  color: #000;
}
.friend-req-card__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.friend-req-btn {
  width: 100%;
  height: 56px;
  border-radius: 18px;
  border: 2px solid #000;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  color: #fff;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.2);
  transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
}
.friend-req-btn:active {
  transform: translateY(2px);
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
}
.friend-req-btn--accept  { background: #43c22d; }
.friend-req-btn--decline { background: #f34822; }
</style>
