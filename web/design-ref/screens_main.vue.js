// Home, Rooms, Create, Shop, Friends screens
// Vue 3 / Composition API port.

(() => {
  const { ref, computed } = Vue;
  const { lighten } = window.MPUtil;

  const HomeTile = {
    name: 'HomeTile',
    props: { icon: String, title: String, sub: String, onClick: Function },
    template: `
      <button @click="onClick" :style="{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '10px',
        padding: '14px 12px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        color: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '78px',
      }">
        <div :style="{
          width: '32px', height: '32px',
          borderRadius: '8px',
          background: 'rgba(90, 58, 154, 0.1)',
          color: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }">
          <Icon :name="icon" :size="17" color="var(--primary)"/>
        </div>
        <div>
          <div :style="{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--ink)' }">{{ title }}</div>
          <div :style="{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '1px' }">{{ sub }}</div>
        </div>
      </button>
    `,
  };

  const HomeScreen = {
    name: 'HomeScreen',
    components: { HomeTile },
    props: { go: Function, lang: String },
    setup(props) {
      const L = computed(() => props.lang === 'RU' ? {
        title: 'Mini Poly', sub: 'Королевство торговли',
        play: 'Играть', playSub: 'Вступить в распрю',
        create: 'Создать', createSub: 'Созвать совет',
        shop: 'Ярмарка', shopSub: 'Товары и гербы',
        friends: 'Друзья', friendsSub: 'Свиток союзников',
        hero: 'Добро пожаловать, лорд',
      } : {
        title: 'Mini Poly', sub: 'The Realm of Commerce',
        play: 'Play', playSub: 'Join the fray',
        create: 'Create', createSub: 'Call a counsel',
        shop: 'Bazaar', shopSub: 'Tokens & crests',
        friends: 'Friends', friendsSub: 'Scroll of allies',
        hero: 'Welcome, my lord',
      });
      const allies = [
        { n: 'Elara', c: PLAYER_COLORS.elara, s: 'Playing' },
        { n: 'Magnus', c: PLAYER_COLORS.magnus, s: 'Online' },
        { n: 'Finn', c: PLAYER_COLORS.finn, s: 'Lobby' },
        { n: 'Oren', c: PLAYER_COLORS.oren, s: 'Idle' },
        { n: 'Lady', c: PLAYER_COLORS.lady, s: 'Online' },
      ];
      return { L, allies, PLAYER_COLORS };
    },
    template: `
      <div class="topbar">
        <div class="avatar-btn">R</div>
        <div class="title">
          <h1 :style="{ fontFamily: 'var(--font-title)', fontSize: '22px', letterSpacing: '0.08em' }">MINI · POLY</h1>
          <div class="sub">{{ L.sub }}</div>
        </div>
        <button class="icon-btn"><Icon name="bell" :size="18"/></button>
        <button class="icon-btn"><Icon name="globe" :size="18"/></button>
      </div>
      <div class="content">
        <div :style="{
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--line)',
          background: 'radial-gradient(ellipse at 80% 20%, rgba(184, 137, 46, 0.25) 0%, transparent 50%), linear-gradient(140deg, #4a2e82 0%, #2d1a5a 100%)',
          padding: '14px 14px 12px',
          color: '#f0e4c8',
          marginBottom: '10px',
        }">
          <svg viewBox="0 0 80 40" :style="{ position: 'absolute', right: '10px', top: '8px', width: '56px', opacity: 0.35 }">
            <path d="M5 30 L12 10 L25 22 L40 5 L55 22 L68 10 L75 30 Z" fill="#d4a84a"/>
            <circle cx="12" cy="10" r="2" fill="#d4a84a"/>
            <circle cx="40" cy="5" r="2" fill="#d4a84a"/>
            <circle cx="68" cy="10" r="2" fill="#d4a84a"/>
          </svg>
          <div :style="{ fontSize: '10px', letterSpacing: '0.15em', color: '#d4a84a', textTransform: 'uppercase' }">Anno MMXXVI</div>
          <div :style="{ fontFamily: 'var(--font-display)', fontSize: '20px', marginTop: '2px', color: '#f7eeda' }">{{ L.hero }}</div>
          <div :style="{ fontSize: '11px', color: '#c9b88e', marginTop: '2px', lineHeight: 1.3 }">
            {{ lang === 'RU' ? 'Ваша свита ждёт приказаний.' : 'Your retinue awaits your command.' }}
          </div>
          <div :style="{ marginTop: '10px', display: 'flex', gap: '8px' }">
            <button class="btn btn-primary" :style="{ background: 'linear-gradient(180deg, #d4a84a 0%, #b8892e 100%)', color: '#2a1d10', flex: 1, padding: '10px' }" @click="go('game')">
              <Icon name="dice" :size="16" color="#2a1d10"/>
              {{ L.play }}
            </button>
            <button class="btn btn-ghost" :style="{ background: 'rgba(247, 238, 218, 0.12)', color: '#f7eeda', border: '1px solid rgba(212, 168, 74, 0.4)', padding: '10px 14px' }" @click="go('create')">
              <Icon name="plus" :size="16" color="#f7eeda"/>
            </button>
          </div>
        </div>

        <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }">
          <HomeTile icon="users" :title="lang==='RU' ? 'Таверна' : 'The Tavern'" :sub="lang==='RU' ? 'Найти игру' : 'Find a game'" :on-click="() => go('rooms')"/>
          <HomeTile icon="scroll" :title="lang==='RU' ? 'Писарь' : 'Scribe'" :sub="lang==='RU' ? 'Новая комната' : 'New room'" :on-click="() => go('create')"/>
          <HomeTile icon="bag" :title="L.shop" :sub="L.shopSub" :on-click="() => go('shop')"/>
          <HomeTile icon="shield" :title="L.friends" :sub="L.friendsSub" :on-click="() => go('friends')"/>
        </div>

        <div class="card" :style="{ padding: '12px', marginBottom: '10px' }">
          <div class="row between" :style="{ marginBottom: '8px' }">
            <div :style="{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }">
              {{ lang==='RU' ? 'Последняя игра' : 'Recent match' }}
            </div>
            <div :style="{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 600 }">+ 1 240 ◈</div>
          </div>
          <div class="row" :style="{ gap: '8px' }">
            <Sigil name="Eldmark" :color="PLAYER_COLORS.you" :size="32"/>
            <div :style="{ flex: 1 }">
              <div :style="{ fontFamily: 'var(--font-display)', fontSize: '15px' }">Eldmark Vale</div>
              <div :style="{ fontSize: '11px', color: 'var(--ink-3)' }">4 players · 28 rounds · won</div>
            </div>
            <div :style="{
              padding: '3px 9px',
              border: '1px solid var(--gold)',
              borderRadius: '999px',
              color: 'var(--gold)',
              fontSize: '10px',
              fontFamily: 'var(--font-title)',
              letterSpacing: '0.12em',
            }">
              1st
            </div>
          </div>
        </div>

        <div :style="{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }">
          {{ lang==='RU' ? 'Союзники в игре' : 'Allies in play' }}
        </div>
        <div class="rail" :style="{ paddingBottom: '4px' }">
          <div v-for="f in allies" :key="f.n" :style="{ textAlign: 'center', width: '64px', flexShrink: 0 }">
            <div :style="{ position: 'relative', width: '44px', height: '44px', margin: '0 auto' }">
              <Sigil :name="f.n" :color="f.c" :size="44"/>
              <div :style="{
                position: 'absolute', bottom: 0, right: 0,
                width: '11px', height: '11px', borderRadius: '50%',
                background: f.s === 'Playing' ? 'var(--emerald)' : f.s === 'Online' ? 'var(--gold)' : 'var(--ink-4)',
                border: '2px solid var(--bg)',
              }"/>
            </div>
            <div :style="{
              fontSize: '11px', marginTop: '6px', color: 'var(--ink)',
              fontFamily: 'var(--font-display)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }">{{ f.n }}</div>
          </div>
        </div>
      </div>
    `,
  };

  const RoomsScreen = {
    name: 'RoomsScreen',
    props: { go: Function, lang: String },
    setup() {
      const rooms = [
        { code: 'ELDRIC', host: 'Magnus', color: PLAYER_COLORS.magnus, players: 3, cap: 4, bet: 500 },
        { code: 'DUNHOLM', host: 'Lady Cyne', color: PLAYER_COLORS.lady, players: 2, cap: 6, bet: 1000 },
        { code: 'RAVENSH', host: 'Finn', color: PLAYER_COLORS.finn, players: 4, cap: 4, bet: 250, live: true },
        { code: 'VALEBRK', host: 'Mariya', color: PLAYER_COLORS.elara, players: 1, cap: 4, bet: 100 },
      ];
      const range = (n) => Array.from({ length: n });
      return { rooms, range };
    },
    template: `
      <TopBar
        :on-back="() => go('home')"
        :title="lang === 'RU' ? 'Таверна' : 'The Tavern'"
        :subtitle="lang === 'RU' ? 'Открытые столы · 4' : 'Open tables · 4'"
      />
      <div class="content">
        <div :style="{ display: 'flex', gap: '8px', marginBottom: '12px' }">
          <div class="card" :style="{ flex: 1, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }">
            <Icon name="search" :size="16" color="var(--ink-3)"/>
            <div :style="{ fontSize: '13px', color: 'var(--ink-3)' }">
              {{ lang === 'RU' ? 'Введите код…' : 'Enter code…' }}
            </div>
          </div>
          <button class="btn btn-primary" :style="{ padding: '10px 16px' }">
            {{ lang === 'RU' ? 'Создать' : 'Create' }}
          </button>
        </div>

        <div :style="{ display: 'flex', gap: '6px', marginBottom: '12px' }">
          <button v-for="(f, i) in [lang==='RU'?'Все':'All', lang==='RU'?'Публичные':'Public', lang==='RU'?'Друзья':'Friends', lang==='RU'?'Ставка':'Stakes']"
            :key="i"
            :style="{
              padding: '6px 12px',
              background: i === 0 ? 'var(--primary)' : 'transparent',
              color: i === 0 ? '#fff' : 'var(--ink-2)',
              border: i === 0 ? 'none' : '1px solid var(--line)',
              borderRadius: '999px',
              fontSize: '12px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              cursor: 'pointer',
            }">{{ f }}</button>
        </div>

        <div :style="{ display: 'flex', flexDirection: 'column', gap: '10px' }">
          <button v-for="r in rooms" :key="r.code" @click="go('lobby')" :style="{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            padding: '12px 14px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'var(--font-body)',
            color: 'var(--ink)',
          }">
            <Sigil :name="r.host" :color="r.color" :size="40"/>
            <div :style="{ flex: 1, minWidth: 0 }">
              <div class="row" :style="{ gap: '6px' }">
                <div :style="{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--ink)', letterSpacing: '0.05em' }">
                  {{ r.code }}
                </div>
                <div v-if="r.live" :style="{
                  padding: '2px 6px',
                  background: 'rgba(139, 26, 26, 0.12)',
                  color: 'var(--accent)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  borderRadius: '3px',
                }">LIVE</div>
              </div>
              <div :style="{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '2px' }">
                {{ lang === 'RU' ? 'Хозяин' : 'Host' }} · {{ r.host }} · {{ r.bet }}◈ {{ lang === 'RU' ? 'ставка' : 'stake' }}
              </div>
            </div>
            <div :style="{ textAlign: 'right' }">
              <div :style="{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--ink)' }">
                {{ r.players }}/{{ r.cap }}
              </div>
              <div :style="{ display: 'flex', gap: '2px', marginTop: '4px', justifyContent: 'flex-end' }">
                <div v-for="(_, i) in range(r.cap)" :key="i" :style="{
                  width: '8px', height: '8px', borderRadius: '2px',
                  background: i < r.players ? 'var(--emerald)' : 'var(--line-strong)',
                }"/>
              </div>
            </div>
          </button>
        </div>
      </div>
    `,
  };

  const accessBtnStyle = (active) => ({
    padding: '12px',
    background: active ? 'var(--primary)' : 'var(--card)',
    color: active ? '#fff' : 'var(--ink)',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
    borderRadius: '8px',
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  });

  const CreateScreen = {
    name: 'CreateScreen',
    props: { go: Function, lang: String, openModal: Function, selectedBoard: String },
    setup() {
      const players = ref(4);
      const isPrivate = ref(false);
      const name = ref('Dunholm Keep');
      return { players, isPrivate, name, accessBtnStyle };
    },
    template: `
      <TopBar
        :on-back="() => go('home')"
        :title="lang === 'RU' ? 'Новая комната' : 'New Room'"
        :subtitle="lang === 'RU' ? 'Палата писаря' : 'Scribe\\u2019s Chamber'"
      />
      <div class="content">
        <div :style="{ marginBottom: '14px' }">
          <label :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }">
            {{ lang==='RU'?'Название':'Realm name' }}
          </label>
          <input v-model="name" :style="{
            width: '100%',
            padding: '12px 14px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            fontFamily: 'var(--font-display)',
            fontSize: '17px',
            color: 'var(--ink)',
            marginTop: '6px',
            outline: 'none',
          }"/>
        </div>

        <div :style="{ marginBottom: '14px' }">
          <label :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }">
            {{ lang==='RU'?'Доступ':'Access' }}
          </label>
          <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }">
            <button @click="isPrivate = false" :style="accessBtnStyle(!isPrivate)">
              <Icon name="unlock" :size="16" :color="!isPrivate ? '#fff' : 'var(--ink-2)'"/>
              {{ lang==='RU'?'Публичная':'Public' }}
            </button>
            <button @click="isPrivate = true" :style="accessBtnStyle(isPrivate)">
              <Icon name="lock" :size="16" :color="isPrivate ? '#fff' : 'var(--ink-2)'"/>
              {{ lang==='RU'?'Приватная':'Private' }}
            </button>
          </div>
        </div>

        <div :style="{ marginBottom: '14px' }">
          <div class="row between">
            <label :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }">
              {{ lang==='RU'?'Игроков':'Players' }}
            </label>
            <div :style="{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--primary)' }">{{ players }}</div>
          </div>
          <div :style="{ marginTop: '10px', display: 'flex', gap: '6px', justifyContent: 'space-between' }">
            <button v-for="n in [2,3,4,5,6]" :key="n" @click="players = n" :style="{
              flex: 1,
              padding: '12px 0',
              background: players === n ? 'var(--primary)' : 'var(--card)',
              color: players === n ? '#fff' : 'var(--ink)',
              border: '1px solid ' + (players === n ? 'var(--primary)' : 'var(--line)'),
              borderRadius: '8px',
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              cursor: 'pointer',
            }">{{ n }}</button>
          </div>
        </div>

        <div :style="{ marginBottom: '14px' }">
          <label :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }">
            {{ lang==='RU'?'Карта':'Map' }}
          </label>
          <div :style="{ marginTop: '6px' }">
            <MapPickRow
              :board-id="selectedBoard || 'eldmark'"
              :on-open="() => openModal && openModal('boardpick')"
              :lang="lang"
              :editable="true"
            />
          </div>
        </div>

        <div :style="{ marginBottom: '14px' }">
          <label :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }">
            {{ lang==='RU'?'Правила':'Rules' }}
          </label>
          <div class="card" :style="{ marginTop: '6px', padding: 0 }">
            <div v-for="(r, i, a) in [
              { k: lang==='RU'?'Стартовый капитал':'Starting cash', v: '◈ 1 500' },
              { k: lang==='RU'?'Аукционы':'Auctions', v: lang==='RU'?'Вкл':'On' },
              { k: lang==='RU'?'Скорость':'Pace', v: lang==='RU'?'Обычная':'Normal' },
              { k: lang==='RU'?'Ставка':'Entry', v: '◈ 100' },
            ]" :key="r.k" :style="{
              padding: '12px 14px',
              borderBottom: i === 3 ? 'none' : '1px solid var(--divider)',
              display: 'flex', justifyContent: 'space-between',
              fontSize: '13px', color: 'var(--ink)',
            }">
              <span>{{ r.k }}</span>
              <span :style="{ color: 'var(--ink-2)', fontWeight: 500 }">{{ r.v }}</span>
            </div>
          </div>
        </div>

        <button class="btn btn-primary" :style="{ width: '100%', padding: '14px 20px', fontSize: '15px' }" @click="go('lobby')">
          <Icon name="check" :size="16" color="#fff"/>
          {{ lang === 'RU' ? 'Созвать совет' : 'Open the Hall' }}
        </button>
      </div>
    `,
  };

  const ShopScreen = {
    name: 'ShopScreen',
    props: { go: Function, lang: String, openModal: Function },
    setup(props) {
      const tab = ref('tokens');
      const BALANCES = { '◈': 1250, '★': 42 };
      const items = computed(() => ({
        tokens: [
          { id: 'knight',  name: 'Knight',  ru: 'Рыцарь',  price: 0,   owned: true, rarity: 'common' },
          { id: 'shield',  name: 'Shield',  ru: 'Щит',     price: 120, rarity: 'common' },
          { id: 'tower',   name: 'Tower',   ru: 'Башня',   price: 300, rarity: 'rare' },
          { id: 'crown',   name: 'Crown',   ru: 'Корона',  price: 450, rarity: 'rare' },
          { id: 'griffin', name: 'Griffin', ru: 'Грифон',  price: 80,  premium: true, unit: '★', rarity: 'epic' },
          { id: 'wyrm',    name: 'Wyrm',    ru: 'Змей',    price: 90,  premium: true, unit: '★', rarity: 'epic' },
          { id: 'dragon',  name: 'Dragon',  ru: 'Дракон',  price: 150, premium: true, unit: '★', rarity: 'legendary' },
          { id: 'phoenix', name: 'Phoenix', ru: 'Феникс',  price: 180, premium: true, unit: '★', rarity: 'legendary' },
        ],
        themes: [
          { name: 'Dunholm', icon: '▮', price: 180, color: PLAYER_COLORS.you, rarity: 'common' },
          { name: 'Valecross', icon: '▮', price: 180, color: PLAYER_COLORS.magnus, rarity: 'common' },
          { name: 'Thornfell', icon: '▮', price: 220, color: PLAYER_COLORS.lady, rarity: 'rare' },
          { name: 'Rowan', icon: '▮', price: 180, color: PLAYER_COLORS.elara, rarity: 'common' },
        ],
        banners: [
          { name: 'Lion', icon: '⚔', price: 80, rarity: 'common' },
          { name: 'Eagle', icon: '✦', price: 100, rarity: 'rare' },
          { name: 'Rose', icon: '❀', price: 60, rarity: 'common' },
          { name: 'Stag', icon: '⟟', price: 90, rarity: 'common' },
        ],
        dice: [
          { name: 'Ivory', icon: '⚀', price: 500, rarity: 'rare' },
          { name: 'Ruby', icon: '⚀', price: 50, premium: true, unit: '★', rarity: 'legendary' },
        ],
      }));
      const tabs = [
        { id: 'tokens', label: props.lang==='RU'?'Фишки':'Tokens' },
        { id: 'maps', label: props.lang==='RU'?'Карты':'Maps' },
        { id: 'themes', label: props.lang==='RU'?'Цвета дома':'Houses' },
        { id: 'banners', label: props.lang==='RU'?'Знамёна':'Banners' },
        { id: 'dice', label: props.lang==='RU'?'Кости':'Dice' },
      ];
      const rarityStyles = computed(() => ({
        common: { color: 'var(--ink-3)', label: props.lang==='RU'?'Обычная':'Common' },
        rare: { color: 'var(--primary)', label: props.lang==='RU'?'Редкая':'Rare' },
        epic: { color: '#9a3aa3', label: props.lang==='RU'?'Эпическая':'Epic' },
        legendary: { color: 'var(--gold)', label: props.lang==='RU'?'Легенда':'Legendary' },
      }));
      const list = computed(() => items.value[tab.value] || []);
      const boardMeta = (b) => RARITY_META[b.rarity];
      const boardMetaLabel = (b) => boardMeta(b)[props.lang === 'RU' ? 'ru' : 'en'];
      const boardName = (b) => props.lang === 'RU' ? b.ru : b.name;
      const handleBuy = (item, kind) => {
        if (!props.openModal) return;
        const unit = item.unit || '◈';
        const balance = BALANCES[unit] || 0;
        const enough = balance >= item.price;
        const data = {
          id: item.id, name: item.name, ru: item.ru || item.name,
          price: item.price, unit, kind, balance,
          reason: enough ? undefined : 'funds',
        };
        props.openModal(enough ? 'purchase-ok' : 'purchase-fail', data);
      };
      return {
        tab, items, tabs, rarityStyles, list,
        BOARDS, boardMeta, boardMetaLabel, boardName,
        PLAYER_COLORS, lighten, handleBuy,
      };
    },
    template: `
      <TopBar :on-back="() => go('home')" :title="lang==='RU'?'Ярмарка':'The Bazaar'">
        <template #right>
          <div class="row gap-6" :style="{
            padding: '6px 10px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '999px',
          }">
            <Icon name="coin" :size="14" color="var(--gold)"/>
            <span :style="{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }">1 250</span>
            <span :style="{ color: 'var(--line-strong)' }">·</span>
            <Icon name="star" :size="13" color="var(--gold)"/>
            <span :style="{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }">42</span>
          </div>
        </template>
      </TopBar>
      <div class="content">
        <div :style="{
          display: 'flex',
          gap: '4px',
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          padding: '3px',
          marginBottom: '14px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 4px 12px -4px rgba(42, 29, 16, 0.15)',
        }">
          <button v-for="t in tabs" :key="t.id" @click="tab = t.id" :style="{
            flex: 1,
            padding: '8px 4px',
            background: tab === t.id ? 'var(--primary)' : 'transparent',
            color: tab === t.id ? '#fff' : 'var(--ink-2)',
            border: 'none',
            borderRadius: '6px',
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }">{{ t.label }}</button>
        </div>

        <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }">
          <template v-if="tab === 'maps'">
            <div v-for="b in BOARDS" :key="b.id" :style="{
              background: 'var(--card)',
              border: b.rarity === 'legendary' ? '1px solid var(--gold)' : '1px solid var(--line)',
              borderRadius: '10px',
              padding: '10px',
              position: 'relative',
              overflow: 'hidden',
            }">
              <div v-if="b.owned" :style="{
                position: 'absolute', top: '6px', left: '6px', zIndex: 2,
                fontSize: '9px', padding: '2px 6px',
                background: 'var(--emerald)', color: '#fff',
                borderRadius: '3px', letterSpacing: '0.1em', fontWeight: 700,
              }">✓ OWNED</div>
              <div v-if="b.rarity === 'legendary' && !b.owned" :style="{
                position: 'absolute', top: '6px', right: '6px', zIndex: 2,
                fontSize: '9px', padding: '2px 5px', background: 'var(--gold)',
                color: '#fff', borderRadius: '3px', letterSpacing: '0.1em', fontWeight: 700,
              }">★ PRO</div>
              <div :style="{
                borderRadius: '8px', overflow: 'hidden',
                border: '2px solid ' + b.palette.gold,
                marginBottom: '10px',
                boxShadow: b.rarity === 'legendary' ? '0 0 12px rgba(212,168,74,0.25)' : 'none',
              }">
                <BoardPreview :board="b" :size="140"/>
              </div>
              <div :style="{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.15 }">
                {{ boardName(b) }}
              </div>
              <div :style="{
                fontSize: '9px', color: boardMeta(b).color,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                fontWeight: 700, marginTop: '2px',
              }">
                {{ boardMetaLabel(b) }}
              </div>
              <div class="row between" :style="{ marginTop: '8px' }">
                <div :style="{
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  color: b.rarity === 'legendary' || b.rarity === 'epic' ? 'var(--gold)' : 'var(--ink-2)',
                  fontWeight: 600,
                }">
                  {{ b.owned ? '—' : (b.unit === '★' ? ('★ ' + b.price) : ('◈ ' + b.price)) }}
                </div>
                <button :disabled="b.owned" @click="handleBuy({ id: b.id, name: b.name, ru: b.ru, price: b.price, unit: b.unit }, 'map')" :style="{
                  padding: '5px 11px', fontSize: '11px', border: 'none',
                  background: b.owned ? 'var(--bg-deep)' : ((b.rarity === 'legendary' || b.rarity === 'epic') ? 'var(--gold)' : 'var(--primary)'),
                  color: b.owned ? 'var(--ink-3)' : '#fff',
                  borderRadius: '999px',
                  cursor: b.owned ? 'default' : 'pointer',
                  fontFamily: 'var(--font-body)', fontWeight: 600,
                }">
                  {{ b.owned ? (lang==='RU'?'В игре':'Owned') : (lang==='RU'?'Купить':'Buy') }}
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-for="item in list" :key="item.name" :style="{
              background: 'var(--card)',
              border: item.premium ? '1px solid var(--gold)' : '1px solid var(--line)',
              borderRadius: '10px',
              padding: '12px',
              position: 'relative',
              overflow: 'hidden',
            }">
              <div v-if="item.owned" :style="{
                position: 'absolute', top: '6px', left: '6px', zIndex: 2,
                fontSize: '9px', padding: '2px 6px',
                background: 'var(--emerald)', color: '#fff',
                borderRadius: '3px', letterSpacing: '0.1em', fontWeight: 700,
              }">✓ OWNED</div>
              <div v-if="item.premium && !item.owned" :style="{
                position: 'absolute', top: '6px', right: '6px', zIndex: 2,
                fontSize: '9px', padding: '2px 5px', background: 'var(--gold)',
                color: '#fff', borderRadius: '3px', letterSpacing: '0.1em', fontWeight: 700,
              }">★ PRO</div>

              <div v-if="tab === 'tokens'" :style="{
                height: '86px',
                background: item.premium
                  ? 'radial-gradient(circle at 50% 40%, #3a2d0e, #1a130d)'
                  : 'linear-gradient(145deg, var(--card-alt), var(--bg-deep))',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '10px',
                position: 'relative',
                overflow: 'hidden',
              }">
                <div :style="{
                  width: '58px', height: '58px', borderRadius: '50%',
                  background: item.premium
                    ? 'radial-gradient(circle at 32% 28%, #f5d98a, #d4a84a 55%, #8b6914)'
                    : 'radial-gradient(circle at 32% 28%, ' + lighten(PLAYER_COLORS.you, 0.45) + ', ' + PLAYER_COLORS.you + ' 60%, ' + lighten(PLAYER_COLORS.you, -0.25) + ')',
                  boxShadow: item.premium
                    ? '0 0 0 2px #fff, 0 0 14px rgba(212,168,74,0.55), 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.5)'
                    : '0 0 0 2px #fff, 0 3px 6px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }">
                  <TokenArt :id="item.id" :size="42" color="#fff" shadow="rgba(0,0,0,0.55)"/>
                </div>
                <template v-if="item.premium">
                  <div :style="{ position: 'absolute', top: '8px', left: '12px', width: '3px', height: '3px', borderRadius: '50%', background: '#d4a84a', opacity: 0.7 }"/>
                  <div :style="{ position: 'absolute', top: '18px', right: '16px', width: '2px', height: '2px', borderRadius: '50%', background: '#f5d98a', opacity: 0.6 }"/>
                  <div :style="{ position: 'absolute', bottom: '14px', left: '20px', width: '2px', height: '2px', borderRadius: '50%', background: '#d4a84a', opacity: 0.5 }"/>
                </template>
              </div>
              <div v-else :style="{
                height: '68px',
                background: item.color
                  ? 'linear-gradient(135deg, ' + item.color + ', ' + lighten(item.color, 0.2) + ')'
                  : 'linear-gradient(135deg, var(--bg-deep), var(--card-alt))',
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '34px',
                color: item.color ? '#fff' : 'var(--ink-2)',
                fontFamily: 'var(--font-display)',
                marginBottom: '10px',
                border: '1px solid var(--line)',
              }">
                {{ item.icon }}
              </div>

              <div :style="{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--ink)' }">
                {{ lang==='RU' && item.ru ? item.ru : item.name }}
              </div>
              <div :style="{
                fontSize: '9px',
                color: rarityStyles[item.rarity || 'common'].color,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 700,
                marginTop: '2px',
              }">
                {{ rarityStyles[item.rarity || 'common'].label }}
              </div>
              <div class="row between" :style="{ marginTop: '8px' }">
                <div :style="{
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  color: item.premium ? 'var(--gold)' : 'var(--ink-2)',
                  fontWeight: 600,
                }">
                  {{ item.owned ? '—' : ((item.unit || '◈') + ' ' + item.price) }}
                </div>
                <button :disabled="item.owned" @click="handleBuy(item, tab === 'tokens' ? 'token' : tab === 'banners' ? 'banner' : tab === 'dice' ? 'dice' : 'theme')" :style="{
                  padding: '5px 11px', fontSize: '11px', border: 'none',
                  background: item.owned ? 'var(--bg-deep)' : (item.premium ? 'var(--gold)' : 'var(--primary)'),
                  color: item.owned ? 'var(--ink-3)' : '#fff',
                  borderRadius: '999px',
                  cursor: item.owned ? 'default' : 'pointer',
                  fontFamily: 'var(--font-body)', fontWeight: 600,
                }">
                  {{ item.owned ? (lang==='RU'?'В игре':'Equipped') : (lang==='RU'?'Купить':'Buy') }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    `,
  };

  const FriendsScreen = {
    name: 'FriendsScreen',
    props: { go: Function, lang: String },
    setup() {
      const friends = [
        { n: 'Elara', c: PLAYER_COLORS.elara, w: 62, g: 142, status: 'playing' },
        { n: 'Magnus', c: PLAYER_COLORS.magnus, w: 58, g: 88, status: 'online' },
        { n: 'Lady Cyne', c: PLAYER_COLORS.lady, w: 71, g: 55, status: 'online' },
        { n: 'Finn', c: PLAYER_COLORS.finn, w: 44, g: 31, status: 'offline' },
        { n: 'Oren', c: PLAYER_COLORS.oren, w: 52, g: 27, status: 'online' },
      ];
      return { friends, PLAYER_COLORS };
    },
    template: `
      <TopBar
        :on-back="() => go('home')"
        :title="lang==='RU'?'Союзники':'Allies'"
        :subtitle="lang==='RU'?'Книга побратимов':'Book of Brethren'"
      />
      <div class="content">
        <div class="card" :style="{ marginBottom: '14px', padding: '14px' }">
          <div class="row" :style="{ gap: '12px', marginBottom: '12px' }">
            <Sigil name="R" :color="PLAYER_COLORS.you" :size="48"/>
            <div :style="{ flex: 1 }">
              <div :style="{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--ink)' }">Lord Roderick</div>
              <div :style="{ fontSize: '11px', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }">Baron · Rank 412</div>
            </div>
          </div>
          <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }">
            <ShieldStat :label="lang==='RU'?'Игр':'Games'" value="108"/>
            <ShieldStat :label="lang==='RU'?'Побед':'Wins'" value="61" accent="var(--emerald)"/>
            <ShieldStat label="Winrate" value="56%" accent="var(--gold)"/>
          </div>
        </div>

        <Fleuron :text="lang==='RU'?'Соратники':'Comrades'"/>

        <div :style="{ display: 'flex', flexDirection: 'column', gap: '6px' }">
          <div v-for="f in friends" :key="f.n" class="row" :style="{
            padding: '10px 12px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            gap: '12px',
          }">
            <div :style="{ position: 'relative' }">
              <Sigil :name="f.n" :color="f.c" :size="36"/>
              <div :style="{
                position: 'absolute', bottom: 0, right: 0,
                width: '10px', height: '10px', borderRadius: '50%',
                background: f.status === 'playing' ? 'var(--emerald)' : f.status === 'online' ? 'var(--gold)' : 'var(--ink-4)',
                border: '2px solid var(--card)',
              }"/>
            </div>
            <div :style="{ flex: 1 }">
              <div :style="{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--ink)' }">{{ f.n }}</div>
              <div :style="{ fontSize: '11px', color: 'var(--ink-3)' }">{{ f.g }} games · {{ f.w }}% wr</div>
            </div>
            <button v-if="f.status === 'playing'" class="btn btn-primary" :style="{ padding: '6px 12px', fontSize: '11px' }">
              {{ lang==='RU'?'Присоединиться':'Join' }}
            </button>
            <button v-else class="btn btn-ghost" :style="{ padding: '6px 12px', fontSize: '11px' }">
              {{ lang==='RU'?'Позвать':'Invite' }}
            </button>
          </div>
        </div>
      </div>
    `,
  };

  window.MPV = window.MPV || { components: {} };
  Object.assign(window.MPV.components, { HomeScreen, RoomsScreen, CreateScreen, ShopScreen, FriendsScreen });
})();
