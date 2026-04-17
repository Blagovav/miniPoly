// Modals: Deed, Trade, Decree, Chest, Profile, Chat, Coronation
// Vue 3 / Composition API port.

(() => {
  const { computed } = Vue;

  const DeedModal = {
    name: 'DeedModal',
    props: { onClose: Function, lang: String, data: Object },
    setup(props) {
      const tile = computed(() => props.data?.tile || { name: 'Weaver Lane', price: 200, g: 'teal', ru: 'Переулок' });
      const group = computed(() => GROUP_COLORS[tile.value.g || 'teal']);
      const stop = (e) => e.stopPropagation();
      const rows = computed(() => [
        [props.lang === 'RU' ? 'Базовая' : 'Base', 16],
        ['+ 1 ⌂', 80],
        ['+ 2 ⌂', 220],
        ['+ 3 ⌂', 600],
        ['+ 4 ⌂', 800],
        [props.lang === 'RU' ? 'Замок ♖' : 'Castle ♖', 1100],
      ]);
      const quarterLabel = computed(() => (tile.value.g || 'teal').toUpperCase() + ' QUARTER');
      const engravingStyle = computed(() => ({
        height: '100px',
        background: `repeating-linear-gradient(135deg, rgba(42,29,16,0.1) 0 6px, transparent 6px 12px), linear-gradient(180deg, ${group.value}20, var(--bg-deep))`,
        border: '1px solid var(--line)',
        borderRadius: '6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: '14px',
      }));
      const mortgage = computed(() => Math.floor((tile.value.price || 200) / 2));
      return { tile, group, stop, rows, quarterLabel, engravingStyle, mortgage };
    },
    template: `
      <div class="modal-scrim" @click="onClose">
        <div class="modal-card" @click="stop" :style="{ borderTopColor: group }">
          <div :style="{ width: '40px', height: '4px', background: 'var(--line-strong)', borderRadius: '2px', margin: '-4px auto 14px' }"/>
          <div :style="{ textAlign: 'center', marginBottom: '14px' }">
            <div :style="{ fontSize: '10px', letterSpacing: '0.15em', color: 'var(--ink-3)', textTransform: 'uppercase' }">
              {{ lang==='RU'?'Грамота на владение':'Deed of Title' }}
            </div>
            <div :style="{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--ink)', marginTop: '2px' }">
              {{ tile.name }}
            </div>
            <div :style="{
              display: 'inline-block', marginTop: '6px',
              padding: '3px 14px', background: group, color: '#fff',
              fontSize: '10px', letterSpacing: '0.2em', fontFamily: 'var(--font-title)',
              borderRadius: '3px',
            }">
              {{ quarterLabel }}
            </div>
          </div>

          <div :style="engravingStyle">※ engraving ※</div>

          <div :style="{ marginBottom: '14px' }">
            <div :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }">
              {{ lang==='RU'?'Аренда':'Rent schedule' }}
            </div>
            <div class="card" :style="{ padding: 0 }">
              <div v-for="(r, i) in rows" :key="i" :style="{
                display: 'flex', justifyContent: 'space-between',
                padding: '9px 12px',
                borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--divider)',
                fontSize: '13px',
              }">
                <span :style="{ color: 'var(--ink-2)' }">{{ r[0] }}</span>
                <span :style="{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 600 }">◈ {{ r[1] }}</span>
              </div>
            </div>
          </div>

          <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }">
            <div :style="{ textAlign: 'center', padding: '8px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '8px' }">
              <div :style="{ fontSize: '10px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }">{{ lang==='RU'?'Цена':'Price' }}</div>
              <div :style="{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--ink)', marginTop: '2px' }">◈ {{ tile.price || 200 }}</div>
            </div>
            <div :style="{ textAlign: 'center', padding: '8px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '8px' }">
              <div :style="{ fontSize: '10px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }">{{ lang==='RU'?'Залог':'Mortgage' }}</div>
              <div :style="{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--ink)', marginTop: '2px' }">◈ {{ mortgage }}</div>
            </div>
            <div :style="{ textAlign: 'center', padding: '8px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '8px' }">
              <div :style="{ fontSize: '10px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }">{{ lang==='RU'?'Дом':'House' }}</div>
              <div :style="{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--ink)', marginTop: '2px' }">◈ 100</div>
            </div>
          </div>

          <div :style="{ display: 'flex', gap: '8px' }">
            <button class="btn btn-emerald" :style="{ flex: 2 }">{{ lang==='RU'?'Купить':'Buy' }}</button>
            <button class="btn btn-ghost" :style="{ flex: 1 }">{{ lang==='RU'?'Аукцион':'Auction' }}</button>
          </div>
        </div>
      </div>
    `,
  };

  const TradeModal = {
    name: 'TradeModal',
    props: { onClose: Function, lang: String },
    setup() {
      const stop = (e) => e.stopPropagation();
      return { stop, PLAYER_COLORS };
    },
    template: `
      <div class="modal-scrim" @click="onClose" :style="{ alignItems: 'flex-start' }">
        <div class="modal-sheet-top" @click="stop">
          <div :style="{ width: '40px', height: '4px', background: 'var(--line-strong)', borderRadius: '2px', margin: '0 auto 14px' }"/>
          <div :style="{ textAlign: 'center', marginBottom: '12px' }">
            <div :style="{ fontSize: '10px', letterSpacing: '0.15em', color: 'var(--ink-3)', textTransform: 'uppercase' }">
              {{ lang==='RU'?'Гонец':'Messenger' }}
            </div>
            <div :style="{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--ink)', marginTop: '2px' }">
              {{ lang==='RU'?'Предложение сделки':'A proposal arrives' }}
            </div>
          </div>

          <div class="card" :style="{ padding: '14px', marginBottom: '12px' }">
            <div class="row gap-10" :style="{ marginBottom: '10px' }">
              <Sigil name="Magnus" :color="PLAYER_COLORS.magnus" :size="36"/>
              <div>
                <div :style="{ fontFamily: 'var(--font-display)', fontSize: '15px' }">Lord Magnus</div>
                <div :style="{ fontSize: '11px', color: 'var(--ink-3)' }">{{ lang==='RU'?'шлёт предложение':'sends an offer' }}</div>
              </div>
            </div>
            <div :style="{
              fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5,
              padding: '10px 12px',
              background: 'var(--bg)',
              border: '1px dashed var(--line-strong)',
              borderRadius: '6px',
            }">
              <div class="row between" :style="{ marginBottom: '8px' }">
                <span>{{ lang==='RU'?'Он отдаёт':'He gives' }}</span>
                <span :style="{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 600 }">◈ 500</span>
              </div>
              <div class="row between">
                <span>{{ lang==='RU'?'Взамен просит':'He wants' }}</span>
                <span :style="{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }">Weaver Lane</span>
              </div>
            </div>
          </div>

          <div :style="{ display: 'flex', gap: '8px' }">
            <button class="btn btn-wax" :style="{ flex: 1 }" @click="onClose">
              <Icon name="x" :size="14" color="#fff"/>
              {{ lang==='RU'?'Отказать':'Decline' }}
            </button>
            <button class="btn btn-emerald" :style="{ flex: 1 }" @click="onClose">
              <Icon name="check" :size="14" color="#fff"/>
              {{ lang==='RU'?'Принять':'Accept' }}
            </button>
          </div>
        </div>
      </div>
    `,
  };

  const DecreeModal = {
    name: 'DecreeModal',
    props: { onClose: Function, lang: String, kind: { type: String, default: 'chance' } },
    setup(props) {
      const stop = (e) => e.stopPropagation();
      const isChance = computed(() => props.kind === 'chance');
      const accentColor = computed(() => isChance.value ? 'var(--accent)' : 'var(--primary)');
      const cardStyle = computed(() => ({
        width: 'min(320px, 85%)',
        background: 'var(--card-alt)',
        border: '2px solid ' + accentColor.value,
        borderRadius: '10px',
        padding: '22px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'scrollUnfurl 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        textAlign: 'center',
        position: 'relative',
      }));
      const corners = [
        { k: 'tl', top: true,  left: true  },
        { k: 'tr', top: true,  left: false },
        { k: 'bl', top: false, left: true  },
        { k: 'br', top: false, left: false },
      ];
      const cornerStyle = (c) => ({
        position: 'absolute',
        [c.top ? 'top' : 'bottom']: '-1px',
        [c.left ? 'left' : 'right']: '-1px',
        width: '14px', height: '14px',
        borderTop: c.top ? `2px solid ${accentColor.value}` : 'none',
        borderBottom: !c.top ? `2px solid ${accentColor.value}` : 'none',
        borderLeft: c.left ? `2px solid ${accentColor.value}` : 'none',
        borderRight: !c.left ? `2px solid ${accentColor.value}` : 'none',
      });
      const sealStyle = computed(() => ({
        width: '60px', height: '60px', borderRadius: '50%',
        margin: '0 auto 14px',
        background: `radial-gradient(circle at 35% 30%, ${isChance.value ? '#c04040' : '#8a68d0'}, ${isChance.value ? '#8b1a1a' : '#3e2272'})`,
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px',
        fontFamily: 'var(--font-display)',
        boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.3), inset 0 -2px 3px rgba(0,0,0,0.3)',
      }));
      return { stop, isChance, cardStyle, corners, cornerStyle, sealStyle };
    },
    template: `
      <div class="modal-scrim" @click="onClose" :style="{ alignItems: 'center' }">
        <div @click="stop" :style="cardStyle">
          <div v-for="c in corners" :key="c.k" :style="cornerStyle(c)"/>
          <div :style="{ fontSize: '10px', letterSpacing: '0.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: '6px' }">
            {{ isChance ? (lang==='RU'?'Указ':'Royal Decree') : (lang==='RU'?'Сундук':'Town Chest') }}
          </div>
          <div :style="sealStyle">{{ isChance ? '?' : '⎔' }}</div>
          <div :style="{ fontFamily: 'var(--font-display)', fontSize: '17px', color: 'var(--ink)', lineHeight: 1.4 }">
            {{ lang==='RU'?
              '«Вы избраны хранителем казны. Получите ◈ 200 от каждого лорда».':
              '"You are named keeper of the coin. Collect ◈ 200 from every lord."' }}
          </div>
          <button class="btn btn-primary" :style="{ width: '100%', marginTop: '16px' }" @click="onClose">
            {{ lang==='RU'?'Принять волю короля':"As the crown wills" }}
          </button>
        </div>
      </div>
    `,
  };

  const ProfileModal = {
    name: 'ProfileModal',
    props: { onClose: Function, lang: String },
    setup() {
      const stop = (e) => e.stopPropagation();
      const holdings = [
        { n: 'Weaver Lane', g: 'teal', h: 2 },
        { n: 'Fortune Tower', g: 'teal', h: 1 },
        { n: "Baker's Row", g: 'pink', h: 0 },
      ];
      const roofRepeat = (n) => '⌂'.repeat(n);
      return { stop, holdings, roofRepeat, PLAYER_COLORS, GROUP_COLORS };
    },
    template: `
      <div class="modal-scrim" @click="onClose">
        <div class="modal-card" @click="stop">
          <div :style="{ width: '40px', height: '4px', background: 'var(--line-strong)', borderRadius: '2px', margin: '-4px auto 14px' }"/>

          <div class="row gap-12" :style="{ marginBottom: '14px' }">
            <Sigil name="E" :color="PLAYER_COLORS.elara" :size="56"/>
            <div>
              <div :style="{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--ink)' }">Elara the Fox</div>
              <div :style="{ fontSize: '11px', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }">
                Countess · Rank 88
              </div>
            </div>
          </div>

          <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }">
            <ShieldStat label="Games" value="142"/>
            <ShieldStat label="Wins" value="88" accent="var(--emerald)"/>
            <ShieldStat label="Winrate" value="62%" accent="var(--gold)"/>
          </div>

          <Fleuron :text="lang==='RU'?'Владения':'Holdings'"/>

          <div :style="{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }">
            <div v-for="h in holdings" :key="h.n" class="row" :style="{
              padding: '8px 10px', background: 'var(--card)',
              border: '1px solid var(--line)', borderRadius: '6px', gap: '8px',
            }">
              <div :style="{ width: '3px', height: '20px', background: GROUP_COLORS[h.g], borderRadius: '2px' }"/>
              <span :style="{ flex: 1, fontFamily: 'var(--font-display)', fontSize: '13px' }">{{ h.n }}</span>
              <div :style="{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)' }">{{ roofRepeat(h.h) }}</div>
            </div>
          </div>

          <button class="btn btn-primary" :style="{ width: '100%' }">
            <Icon name="send" :size="14" color="#fff"/>
            {{ lang==='RU'?'Отправить гонца':'Send messenger' }}
          </button>
        </div>
      </div>
    `,
  };

  const ChatModal = {
    name: 'ChatModal',
    props: { onClose: Function, lang: String },
    setup(props) {
      const stop = (e) => e.stopPropagation();
      const msgs = computed(() => [
        { who: 'Magnus', c: PLAYER_COLORS.magnus, t: props.lang === 'RU' ? 'Предлагаю сделку' : 'Fancy a trade?' },
        { who: 'You', c: PLAYER_COLORS.you, t: 'gg', me: true },
        { who: 'Elara', c: PLAYER_COLORS.elara, t: props.lang === 'RU' ? 'Ха! Я на коне' : 'Ha! Fortune favors me today.' },
        { who: 'Lady', c: PLAYER_COLORS.lady, t: '⚔ ⚔ ⚔' },
      ]);
      const emojis = ['⚔', '⚜', '♕', '🜲', '✦', '⎔', '♞', '✵'];
      return { stop, msgs, emojis };
    },
    template: `
      <div class="modal-scrim" @click="onClose">
        <div class="modal-card" @click="stop" :style="{ maxHeight: '80%' }">
          <div :style="{ width: '40px', height: '4px', background: 'var(--line-strong)', borderRadius: '2px', margin: '-4px auto 14px' }"/>
          <div :style="{ textAlign: 'center', marginBottom: '12px' }">
            <div :style="{ fontSize: '10px', letterSpacing: '0.15em', color: 'var(--ink-3)', textTransform: 'uppercase' }">
              {{ lang==='RU'?'Голубятня':'Pigeon roost' }}
            </div>
          </div>

          <div :style="{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }">
            <div v-for="(m, i) in msgs" :key="i" class="row" :style="{
              gap: '8px',
              justifyContent: m.me ? 'flex-end' : 'flex-start',
              flexDirection: m.me ? 'row-reverse' : 'row',
            }">
              <Sigil :name="m.who" :color="m.c" :size="26"/>
              <div :style="{
                maxWidth: '70%',
                padding: '7px 11px',
                background: m.me ? 'var(--primary)' : 'var(--card)',
                color: m.me ? '#fff' : 'var(--ink)',
                border: m.me ? 'none' : '1px solid var(--line)',
                borderRadius: m.me ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                fontSize: '13px',
              }">
                <div v-if="!m.me" :style="{ fontSize: '10px', color: 'var(--ink-3)', fontWeight: 600, marginBottom: '1px' }">{{ m.who }}</div>
                {{ m.t }}
              </div>
            </div>
          </div>

          <div class="rail" :style="{ marginBottom: '8px' }">
            <button v-for="e in emojis" :key="e" :style="{
              width: '34px', height: '34px', flexShrink: 0,
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              fontSize: '16px',
              fontFamily: 'var(--font-display)',
              color: 'var(--ink)',
              cursor: 'pointer',
            }">{{ e }}</button>
          </div>

          <div class="row gap-6">
            <input :placeholder="lang==='RU'?'Написать…':'Message…'" :style="{
              flex: 1, padding: '10px 12px',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              fontSize: '13px', color: 'var(--ink)',
              fontFamily: 'var(--font-body)', outline: 'none',
            }"/>
            <button class="btn btn-primary" :style="{ padding: '10px 14px' }">
              <Icon name="send" :size="15" color="#fff"/>
            </button>
          </div>
        </div>
      </div>
    `,
  };

  const CoronationModal = {
    name: 'CoronationModal',
    props: { onClose: Function, lang: String },
    setup() {
      const coins = [];
      for (let i = 0; i < 24; i++) {
        coins.push({
          i,
          left: (i * 4.3) % 100,
          shape: i % 3 === 0 ? '50%' : '50% 0',
          color: i % 3 === 0 ? 'var(--gold)' : i % 3 === 1 ? '#c04040' : '#b8892e',
          duration: 3 + (i % 5) * 0.5,
          delay: i * 0.2,
        });
      }
      return { coins, PLAYER_COLORS };
    },
    template: `
      <div :style="{
        position: 'absolute', inset: 0, zIndex: 1000,
        background: 'radial-gradient(ellipse at 50% 40%, rgba(90, 58, 154, 0.9), rgba(26, 15, 5, 0.95))',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }">
        <div v-for="c in coins" :key="c.i" :style="{
          position: 'absolute',
          top: '-20px',
          left: c.left + '%',
          width: '10px', height: '10px',
          borderRadius: c.shape,
          background: c.color,
          animation: 'coinFall ' + c.duration + 's linear ' + c.delay + 's infinite',
          opacity: 0.8,
        }"/>

        <div :style="{ fontSize: '11px', letterSpacing: '0.3em', color: 'var(--gold)', textTransform: 'uppercase' }">
          {{ lang==='RU'?'Возведение на престол':'Coronation' }}
        </div>
        <div :style="{
          fontFamily: 'var(--font-title)',
          fontSize: '30px',
          color: '#f7eeda',
          letterSpacing: '0.05em',
          marginTop: '6px',
          textAlign: 'center',
        }">
          LORD RODERICK
        </div>

        <svg viewBox="0 0 200 200" :style="{ width: '180px', margin: '14px 0' }">
          <rect x="60" y="90" width="80" height="60" fill="#4a2e1a" stroke="#d4a84a" stroke-width="2" rx="3"/>
          <rect x="50" y="40" width="100" height="60" fill="#5a3820" stroke="#d4a84a" stroke-width="2" rx="4"/>
          <path d="M70 40 L80 20 L100 10 L120 20 L130 40" fill="none" stroke="#d4a84a" stroke-width="2"/>
          <circle cx="100" cy="12" r="4" fill="#d4a84a"/>
          <rect x="55" y="140" width="10" height="40" fill="#3a2818" stroke="#d4a84a" stroke-width="1"/>
          <rect x="135" y="140" width="10" height="40" fill="#3a2818" stroke="#d4a84a" stroke-width="1"/>
          <circle cx="100" cy="80" r="20" :fill="PLAYER_COLORS.you" stroke="#d4a84a" stroke-width="2"/>
          <text x="100" y="87" text-anchor="middle" fill="#fff" font-size="20" font-family="serif">R</text>
          <path d="M80 50 L84 40 L92 46 L100 34 L108 46 L116 40 L120 50 Z" fill="#d4a84a" stroke="#8b6914" stroke-width="1"/>
        </svg>

        <div :style="{ fontFamily: 'var(--font-display)', fontSize: '15px', color: '#c9b88e', textAlign: 'center', maxWidth: '280px', lineHeight: 1.4 }">
          {{ lang==='RU'?
            'Королевство пало к вашим ногам. Слава и золото ваши.':
            'The realm bows at your feet. Glory and gold are yours.' }}
        </div>

        <div class="row gap-8" :style="{ marginTop: '20px' }">
          <div :style="{ textAlign: 'center' }">
            <div :style="{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--gold)' }">◈ 4 820</div>
            <div :style="{ fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }">{{ lang==='RU'?'Сокровища':'Treasury' }}</div>
          </div>
          <div :style="{ width: '1px', height: '30px', background: 'var(--line-strong)' }"/>
          <div :style="{ textAlign: 'center' }">
            <div :style="{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--gold)' }">+ 120</div>
            <div :style="{ fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }">{{ lang==='RU'?'Ранг':'Rank' }}</div>
          </div>
        </div>

        <button class="btn btn-primary" :style="{ marginTop: '22px', padding: '12px 28px' }" @click="onClose">
          {{ lang==='RU'?'Вернуться':'Return' }}
        </button>
      </div>
    `,
  };

  window.MPV = window.MPV || { components: {} };
  Object.assign(window.MPV.components, { DeedModal, TradeModal, DecreeModal, ProfileModal, ChatModal, CoronationModal });
})();
