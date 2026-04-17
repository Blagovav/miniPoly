// Purchase result modals — success + failure
// Vue 3 / Composition API port.

(() => {
  const { computed } = Vue;

  const PurchaseSuccessModal = {
    name: 'PurchaseSuccessModal',
    props: { onClose: Function, lang: String, data: Object },
    setup(props) {
      const stop = (e) => e.stopPropagation();
      const item = computed(() => props.data || { name: 'Dragon', ru: 'Дракон', price: 150, unit: '★', kind: 'token' });
      const L = computed(() => props.lang === 'RU' ? {
        title: 'Сделка заключена!',
        sub: 'Ваше приобретение добавлено в казну.',
        ok: 'Отлично',
        equip: 'Экипировать',
        spent: 'Потрачено',
        balance: 'Остаток',
        kindLabels: { token: 'Фишка', map: 'Карта', banner: 'Знамя', dice: 'Кости', theme: 'Цвет' },
      } : {
        title: 'Purchase complete',
        sub: 'Your acquisition has joined the treasury.',
        ok: 'Splendid',
        equip: 'Equip',
        spent: 'Spent',
        balance: 'Balance',
        kindLabels: { token: 'Token', map: 'Map', banner: 'Banner', dice: 'Dice', theme: 'House' },
      });
      const confetti = [];
      for (let i = 0; i < 12; i++) {
        const x = (i * 31) % 100;
        const delay = (i * 80) % 900;
        const size = 3 + (i % 3);
        const colors = ['#d4a84a', '#f5d98a', '#f7eeda', '#b8892e'];
        confetti.push({ i, x, delay, size, color: colors[i % colors.length] });
      }
      const mapBoard = computed(() => {
        if (item.value.kind !== 'map') return null;
        return BOARDS.find((b) => b.id === (item.value.id || 'eldmark')) || BOARDS[0];
      });
      const kindLabel = computed(() => L.value.kindLabels[item.value.kind] || '');
      const priceText = computed(() => item.value.unit === '★' ? `${item.value.price} ★` : `${item.value.price} ◈`);
      const balanceText = computed(() => item.value.unit === '★' ? '28 ★' : '1 100 ◈');
      return { stop, item, L, confetti, mapBoard, kindLabel, priceText, balanceText };
    },
    template: `
      <div class="modal-backdrop" @click="onClose">
        <div @click="stop" :style="{
          position: 'relative',
          width: '100%', maxWidth: '360px', margin: '16px',
          background: 'var(--bg)',
          borderRadius: '16px',
          border: '1px solid var(--gold)',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35), 0 0 40px rgba(212, 168, 74, 0.25)',
          animation: 'successPop 420ms cubic-bezier(0.2, 1.4, 0.4, 1)',
        }">
          <div :style="{
            position: 'relative',
            background: 'radial-gradient(ellipse at 50% 130%, rgba(212, 168, 74, 0.45) 0%, transparent 60%), linear-gradient(180deg, #2d1a5a 0%, #1a0e3a 100%)',
            padding: '24px 20px 18px',
            color: '#f7eeda',
            textAlign: 'center',
            overflow: 'hidden',
          }">
            <div v-for="c in confetti" :key="c.i" :style="{
              position: 'absolute',
              left: c.x + '%',
              top: '-10px',
              width: c.size + 'px', height: c.size + 'px',
              borderRadius: '50%',
              background: c.color,
              animation: 'confettiFall 2.2s ' + c.delay + 'ms ease-out infinite',
              opacity: 0.8,
            }"/>

            <div :style="{
              width: '72px', height: '72px',
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #f5d98a 0%, #d4a84a 60%, #8b6914 100%)',
              boxShadow: '0 0 0 3px rgba(247, 238, 218, 0.15), 0 8px 20px rgba(0,0,0,0.4), inset 0 2px 3px rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }">
              <svg viewBox="0 0 40 40" width="42" height="42">
                <path d="M 20 4 L 23 16 L 36 20 L 23 24 L 20 36 L 17 24 L 4 20 L 17 16 Z" fill="#2a1d10" opacity="0.85"/>
                <path d="M 20 9 L 22 17 L 30 20 L 22 23 L 20 31 L 18 23 L 10 20 L 18 17 Z" fill="#fffef0" opacity="0.95"/>
              </svg>
            </div>

            <div :style="{
              fontFamily: 'var(--font-display)',
              fontSize: '22px', letterSpacing: '0.02em',
              color: '#f7eeda', marginBottom: '4px',
            }">{{ L.title }}</div>
            <div :style="{ fontSize: '12px', color: '#c9b88e', lineHeight: 1.4, maxWidth: '260px', margin: '0 auto' }">
              {{ L.sub }}
            </div>
          </div>

          <div :style="{ padding: '18px 20px 14px' }">
            <div class="row" :style="{ gap: '14px', marginBottom: '14px' }">
              <div :style="{
                width: '64px', height: '64px',
                borderRadius: '10px',
                background: 'radial-gradient(circle at 32% 28%, #f5d98a, #d4a84a 55%, #8b6914)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.4)',
                border: '2px solid #fff',
                flexShrink: 0,
              }">
                <TokenArt v-if="item.kind === 'token'" :id="item.id || 'dragon'" :size="40" color="#fff" shadow="rgba(0,0,0,0.55)"/>
                <div v-else-if="item.kind === 'map' && mapBoard" :style="{ borderRadius: '6px', overflow: 'hidden' }">
                  <BoardPreview :board="mapBoard" :size="48"/>
                </div>
                <svg v-else viewBox="0 0 32 32" width="32" height="32">
                  <circle cx="16" cy="16" r="10" fill="#fff" opacity="0.9"/>
                </svg>
              </div>
              <div :style="{ flex: 1, minWidth: 0 }">
                <div :style="{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }">
                  {{ kindLabel }}
                </div>
                <div :style="{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--ink)', lineHeight: 1.15, marginTop: '2px' }">
                  {{ lang === 'RU' ? item.ru : item.name }}
                </div>
                <div :style="{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  marginTop: '4px', padding: '2px 8px',
                  background: 'rgba(212, 168, 74, 0.12)',
                  border: '1px solid rgba(212, 168, 74, 0.4)',
                  borderRadius: '999px',
                  fontSize: '10px', fontFamily: 'var(--font-mono)',
                  color: 'var(--gold)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }">
                  <Icon :name="item.unit === '★' ? 'star' : 'coin'" :size="10" color="var(--gold)"/>
                  {{ priceText }}
                </div>
              </div>
            </div>

            <div :style="{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--card)',
              border: '1px solid var(--divider)',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '14px',
            }">
              <div>
                <div :style="{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }">{{ L.spent }}</div>
                <div :style="{ color: 'var(--crim)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '2px' }">
                  − {{ priceText }}
                </div>
              </div>
              <div :style="{ textAlign: 'right' }">
                <div :style="{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }">{{ L.balance }}</div>
                <div :style="{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '2px' }">
                  {{ balanceText }}
                </div>
              </div>
            </div>

            <div :style="{ display: 'flex', gap: '8px' }">
              <button class="btn btn-ghost" @click="onClose" :style="{ flex: 1 }">
                {{ L.ok }}
              </button>
              <button class="btn btn-primary" @click="onClose" :style="{
                flex: 2,
                background: 'linear-gradient(180deg, #d4a84a 0%, #b8892e 100%)',
                color: '#2a1d10',
              }">
                <Icon name="check" :size="16" color="#2a1d10"/>
                {{ L.equip }}
              </button>
            </div>
          </div>
        </div>
      </div>
    `,
  };

  const PurchaseFailModal = {
    name: 'PurchaseFailModal',
    props: { onClose: Function, lang: String, data: Object },
    setup(props) {
      const stop = (e) => e.stopPropagation();
      const item = computed(() => props.data || { name: 'Moonspire', ru: 'Лунный Шпиль', price: 40, unit: '★', kind: 'map', balance: 28 });
      const reason = computed(() => item.value.reason || 'funds');
      const L = computed(() => {
        const r = reason.value;
        return props.lang === 'RU' ? {
          title: r === 'funds' ? 'Казна пуста' : r === 'sold-out' ? 'Распродано' : 'Сделка отклонена',
          sub: r === 'funds'
            ? 'Недостаточно средств в вашей казне.'
            : r === 'sold-out'
              ? 'Этого товара больше нет у торговца.'
              : 'Казначей не смог провести сделку.',
          need: 'Требуется',
          have: 'В казне',
          short: 'Не хватает',
          cancel: 'Отмена',
          topup: 'Пополнить казну',
          browse: 'К другим товарам',
          retry: 'Повторить',
          hint: r === 'funds'
            ? 'Пополните казну монетами или звёздами ярмарки.'
            : 'Вернитесь позже — или попробуйте другой товар.',
        } : {
          title: r === 'funds' ? 'Empty coffers' : r === 'sold-out' ? 'Sold out' : 'Transaction declined',
          sub: r === 'funds'
            ? 'Your treasury lacks the necessary coin.'
            : r === 'sold-out'
              ? 'The merchant has none left to sell.'
              : 'The royal accountant could not complete this transaction.',
          need: 'Needed',
          have: 'You have',
          short: 'Short by',
          cancel: 'Cancel',
          topup: 'Top up coffers',
          browse: 'Browse other wares',
          retry: 'Try again',
          hint: r === 'funds'
            ? 'Top up with bazaar coin or royal stars.'
            : 'Come back later — or try another ware.',
        };
      });
      const shortBy = computed(() => reason.value === 'funds' ? item.value.price - (item.value.balance ?? 0) : 0);
      const unit = computed(() => item.value.unit || '◈');
      const cards = computed(() => [
        { k: L.value.need,  v: `${item.value.price} ${unit.value}`,          color: 'var(--ink)' },
        { k: L.value.have,  v: `${item.value.balance ?? 0} ${unit.value}`,    color: 'var(--ink-2)' },
        { k: L.value.short, v: `${shortBy.value} ${unit.value}`,              color: 'var(--crim)' },
      ]);
      return { stop, item, reason, L, cards };
    },
    template: `
      <div class="modal-backdrop" @click="onClose">
        <div @click="stop" :style="{
          position: 'relative',
          width: '100%', maxWidth: '360px', margin: '16px',
          background: 'var(--bg)',
          borderRadius: '16px',
          border: '1px solid var(--crim)',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          animation: 'failShake 420ms ease-out',
        }">
          <div :style="{
            position: 'relative',
            background: 'radial-gradient(ellipse at 50% 130%, rgba(154, 28, 58, 0.25) 0%, transparent 60%), linear-gradient(180deg, #3a1218 0%, #1a0810 100%)',
            padding: '24px 20px 18px',
            color: '#f7eeda',
            textAlign: 'center',
          }">
            <div :style="{
              width: '72px', height: '72px',
              margin: '0 auto 12px',
              position: 'relative',
            }">
              <svg viewBox="0 0 72 72" width="72" height="72">
                <defs>
                  <linearGradient id="brokenCoin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#8a7152"/>
                    <stop offset="1" stop-color="#4a3a28"/>
                  </linearGradient>
                </defs>
                <path d="M 36 10 A 26 26 0 0 0 24 58 L 32 34 Z"
                  fill="url(#brokenCoin)" stroke="#2a1d10" stroke-width="1.5"/>
                <g transform="translate(4, 1) rotate(6 36 36)">
                  <path d="M 36 10 A 26 26 0 0 1 48 58 L 40 34 Z"
                    fill="url(#brokenCoin)" stroke="#2a1d10" stroke-width="1.5"/>
                </g>
                <path d="M 36 10 L 34 22 L 38 30 L 32 40 L 36 58"
                  stroke="#1a110a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>

            <div :style="{
              fontFamily: 'var(--font-display)',
              fontSize: '22px', color: '#f7eeda', marginBottom: '4px',
            }">{{ L.title }}</div>
            <div :style="{ fontSize: '12px', color: '#c9b88e', lineHeight: 1.4, maxWidth: '260px', margin: '0 auto' }">
              {{ L.sub }}
            </div>
          </div>

          <div :style="{ padding: '16px 20px 14px' }">
            <div v-if="reason === 'funds'" :style="{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px', marginBottom: '14px',
            }">
              <div v-for="(c, i) in cards" :key="i" :style="{
                padding: '8px 6px',
                background: 'var(--card)',
                border: '1px solid var(--divider)',
                borderRadius: '8px',
                textAlign: 'center',
              }">
                <div :style="{ fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }">{{ c.k }}</div>
                <div :style="{
                  marginTop: '3px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px', fontWeight: 700,
                  color: c.color,
                }">{{ c.v }}</div>
              </div>
            </div>

            <div :style="{
              fontSize: '11px', color: 'var(--ink-3)',
              textAlign: 'center', lineHeight: 1.4,
              padding: '0 8px 12px',
            }">
              {{ L.hint }}
            </div>

            <div :style="{ display: 'flex', gap: '8px' }">
              <button class="btn btn-ghost" @click="onClose" :style="{ flex: 1 }">
                {{ L.cancel }}
              </button>
              <button class="btn btn-primary" @click="onClose" :style="{ flex: 2 }">
                <template v-if="reason === 'funds'">
                  <Icon :name="item.unit === '★' ? 'star' : 'coin'" :size="16" color="#fff"/>
                  {{ L.topup }}
                </template>
                <template v-else-if="reason === 'sold-out'">{{ L.browse }}</template>
                <template v-else>{{ L.retry }}</template>
              </button>
            </div>
          </div>
        </div>
      </div>
    `,
  };

  window.MPV = window.MPV || { components: {} };
  Object.assign(window.MPV.components, { PurchaseSuccessModal, PurchaseFailModal });
})();
