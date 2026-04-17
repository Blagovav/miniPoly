// Board selection modal + inline map row.
// Vue 3 / Composition API port.

(() => {
  const { ref, computed } = Vue;

  const BoardSelectModal = {
    name: 'BoardSelectModal',
    props: {
      onClose: Function,
      lang: String,
      selectedId: String,
      onSelect: Function,
      isHost: Boolean,
    },
    setup(props) {
      const pick = ref(props.selectedId || 'eldmark');
      const picked = computed(() => BOARDS.find((b) => b.id === pick.value) || BOARDS[0]);
      const L = computed(() => props.lang === 'RU' ? {
        title: 'Выбор карты', sub: 'Королевство, где развернётся игра',
        apply: 'Применить', close: 'Закрыть', owned: 'В наличии', locked: 'Не куплено',
        hostOnly: 'Только хозяин может выбрать карту', price: 'Купить', active: 'Текущая',
        details: 'Детали', desc: 'Описание',
      } : {
        title: 'Choose a Map', sub: 'The realm where this contest unfolds',
        apply: 'Apply', close: 'Close', owned: 'Owned', locked: 'Locked',
        hostOnly: 'Only the host may choose the map', price: 'Buy', active: 'Active',
        details: 'Details', desc: 'Description',
      });
      const stop = (e) => e.stopPropagation();
      const setPick = (id) => { if (props.isHost) pick.value = id; };
      const applyPick = () => { props.onSelect?.(pick.value); props.onClose?.(); };
      const meta = (b) => RARITY_META[b.rarity];
      const metaLabel = (b) => meta(b)[props.lang === 'RU' ? 'ru' : 'en'];
      const label = (b) => props.lang === 'RU' ? b.ru : b.name;
      const descText = (b) => b.desc[props.lang === 'RU' ? 'ru' : 'en'];
      return { pick, picked, L, stop, setPick, applyPick, meta, metaLabel, label, descText, BOARDS, RARITY_META };
    },
    template: `
      <div class="modal-backdrop" @click="onClose">
        <div class="modal" @click="stop" :style="{
          background: 'var(--bg)',
          width: '100%', maxWidth: '440px',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: '16px 16px 0 0',
          border: '1px solid var(--line)',
          overflow: 'hidden',
        }">
          <div :style="{
            padding: '16px 20px 12px',
            borderBottom: '1px solid var(--divider)',
            background: 'var(--card)',
          }">
            <div class="row between">
              <div>
                <div :style="{ fontFamily: 'var(--font-display)', fontSize: '19px', color: 'var(--ink)' }">{{ L.title }}</div>
                <div :style="{ fontSize: '11px', color: 'var(--ink-3)' }">{{ L.sub }}</div>
              </div>
              <button class="icon-btn" @click="onClose" :style="{ width: '32px', height: '32px' }">
                <Icon name="x" :size="16"/>
              </button>
            </div>
            <div v-if="!isHost" :style="{
              marginTop: '10px', padding: '6px 10px',
              background: 'rgba(154, 28, 58, 0.08)',
              border: '1px solid rgba(154, 28, 58, 0.2)',
              borderRadius: '6px', fontSize: '11px', color: 'var(--crim)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }">
              <Icon name="lock" :size="12" color="var(--crim)"/>
              {{ L.hostOnly }}
            </div>
          </div>

          <div :style="{
            position: 'relative',
            padding: '14px 20px',
            background: picked.palette.bg,
            color: picked.palette.text || '#2a1d10',
            borderBottom: '1px solid var(--divider)',
          }">
            <div class="row" :style="{ gap: '14px', alignItems: 'flex-start' }">
              <div :style="{
                borderRadius: '8px', overflow: 'hidden',
                border: '2px solid ' + picked.palette.gold,
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                flexShrink: 0,
              }">
                <BoardPreview :board="picked" :size="96"/>
              </div>
              <div :style="{ flex: 1, minWidth: 0 }">
                <div :style="{
                  fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: RARITY_META[picked.rarity].color, marginBottom: '3px',
                  opacity: picked.dark ? 0.85 : 0.8, fontWeight: 600,
                }">
                  {{ metaLabel(picked) }}
                </div>
                <div :style="{ fontFamily: 'var(--font-display)', fontSize: '21px', lineHeight: 1.1 }">
                  {{ label(picked) }}
                </div>
                <div :style="{ fontSize: '12px', opacity: 0.75, marginTop: '6px', lineHeight: 1.35 }">
                  {{ descText(picked) }}
                </div>
              </div>
            </div>
          </div>

          <div :style="{ flex: 1, overflowY: 'auto', padding: '14px' }">
            <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }">
              <button v-for="b in BOARDS" :key="b.id" @click="setPick(b.id)" :disabled="!isHost" :style="{
                position: 'relative',
                padding: '8px',
                background: b.id === pick ? 'rgba(90, 58, 154, 0.08)' : 'var(--card)',
                border: '1.5px solid ' + (b.id === pick ? 'var(--primary)' : 'var(--line)'),
                borderRadius: '10px',
                cursor: isHost ? 'pointer' : 'default',
                textAlign: 'left',
                opacity: isHost ? 1 : 0.6,
              }">
                <div :style="{
                  borderRadius: '6px', overflow: 'hidden',
                  border: '1px solid ' + b.palette.line,
                  marginBottom: '7px',
                  filter: b.owned ? 'none' : 'saturate(0.5) brightness(0.95)',
                }">
                  <BoardPreview :board="b" :size="120"/>
                </div>
                <div :style="{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.15, marginBottom: '2px' }">
                  {{ label(b) }}
                </div>
                <div :style="{
                  fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: meta(b).color, fontWeight: 600,
                }">
                  {{ metaLabel(b) }}
                </div>

                <div v-if="b.id === pick" :style="{
                  position: 'absolute', top: '6px', right: '6px',
                  padding: '2px 7px', fontSize: '9px', letterSpacing: '0.1em',
                  background: 'var(--primary)', color: '#fff',
                  borderRadius: '999px', fontWeight: 700,
                }">{{ L.active }}</div>
                <div v-else-if="b.owned" :style="{
                  position: 'absolute', top: '6px', right: '6px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'var(--emerald)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }">
                  <Icon name="check" :size="11" color="#fff"/>
                </div>
                <div v-if="!b.owned" :style="{
                  position: 'absolute', top: '6px', right: '6px',
                  padding: '3px 7px', fontSize: '10px',
                  background: 'rgba(42, 29, 16, 0.85)', color: 'var(--gold)',
                  borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '3px',
                  fontFamily: 'var(--font-mono)', fontWeight: 600,
                }">
                  <Icon :name="b.unit === '★' ? 'star' : 'coin'" :size="10" color="var(--gold)"/>
                  {{ b.price }}
                </div>
              </button>
            </div>
          </div>

          <div :style="{
            padding: '14px',
            borderTop: '1px solid var(--divider)',
            background: 'var(--card)',
            display: 'flex', gap: '8px',
          }">
            <button class="btn btn-ghost" @click="onClose" :style="{ flex: 1, padding: '12px' }">
              {{ L.close }}
            </button>
            <button v-if="isHost && picked.owned" class="btn btn-primary" @click="applyPick" :style="{ flex: 2, padding: '12px' }">
              <Icon name="check" :size="16" color="#fff"/>
              {{ L.apply }}
            </button>
            <button v-if="isHost && !picked.owned" class="btn btn-primary" :style="{
              flex: 2, padding: '12px',
              background: 'linear-gradient(180deg, #d4a84a 0%, #b8892e 100%)',
              color: '#2a1d10',
            }">
              <Icon :name="picked.unit === '★' ? 'star' : 'coin'" :size="16" color="#2a1d10"/>
              {{ L.price }} · {{ picked.price }}{{ picked.unit === '★' ? ' ★' : ' ◈' }}
            </button>
          </div>
        </div>
      </div>
    `,
  };

  const MapPickRow = {
    name: 'MapPickRow',
    props: {
      boardId: String,
      onOpen: Function,
      lang: String,
      editable: Boolean,
    },
    setup(props) {
      const board = computed(() => BOARDS.find((b) => b.id === props.boardId) || BOARDS[0]);
      const L = computed(() => props.lang === 'RU' ? {
        title: 'Карта', change: 'Сменить', locked: 'Выбор хозяина',
      } : {
        title: 'Map', change: 'Change', locked: "Host's choice",
      });
      const meta = computed(() => RARITY_META[board.value.rarity]);
      const metaLabel = computed(() => meta.value[props.lang === 'RU' ? 'ru' : 'en']);
      const boardName = computed(() => props.lang === 'RU' ? board.value.ru : board.value.name);
      const boardDesc = computed(() => board.value.desc[props.lang === 'RU' ? 'ru' : 'en']);
      return { board, L, meta, metaLabel, boardName, boardDesc };
    },
    template: `
      <div :style="{
        padding: '10px',
        background: 'var(--card)',
        border: '1px solid ' + (editable ? 'var(--line)' : 'var(--divider)'),
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }">
        <div :style="{
          borderRadius: '8px', overflow: 'hidden',
          border: '2px solid ' + board.palette.gold,
          flexShrink: 0,
        }">
          <BoardPreview :board="board" :size="64"/>
        </div>
        <div :style="{ flex: 1, minWidth: 0 }">
          <div :style="{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: meta.color, fontWeight: 700 }">
            {{ metaLabel }}
          </div>
          <div :style="{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--ink)', lineHeight: 1.1, marginTop: '2px' }">
            {{ boardName }}
          </div>
          <div :style="{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">
            {{ editable ? boardDesc : L.locked }}
          </div>
        </div>
        <button v-if="editable" @click="onOpen" :style="{
          padding: '7px 12px',
          background: 'transparent',
          color: 'var(--primary)',
          border: '1px solid var(--primary)',
          borderRadius: '999px',
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }">{{ L.change }}</button>
        <Icon v-else name="lock" :size="14" color="var(--ink-4)"/>
      </div>
    `,
  };

  window.MPV = window.MPV || { components: {} };
  Object.assign(window.MPV.components, { BoardSelectModal, MapPickRow });
})();
