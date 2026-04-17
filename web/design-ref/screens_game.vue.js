// Lobby + Game Board
// Vue 3 / Composition API port.

(() => {
  const { ref, computed, reactive } = Vue;
  const { lighten } = window.MPUtil;

  const TILES = [
    { k: 'corner', name: 'Start', ru: 'Врата' },
    { k: 'st', name: 'Cooper Yard', ru: 'Двор', price: 120, g: 'brown' },
    { k: 'chance', name: 'Decree', ru: 'Указ' },
    { k: 'st', name: 'Chandler Hall', ru: 'Холл', price: 120, g: 'brown' },
    { k: 'tax', name: 'Tithe', ru: 'Десятина' },
    { k: 'rail', name: 'North Gate', ru: 'Врата' },
    { k: 'st', name: 'Fortune Tower', ru: 'Башня', price: 180, g: 'teal' },
    { k: 'chest', name: 'Chest', ru: 'Сундук' },
    { k: 'st', name: 'Weaver Lane', ru: 'Переулок', price: 200, g: 'teal' },
    { k: 'st', name: 'Northeby Road', ru: 'Дорога', price: 200, g: 'teal' },
    { k: 'corner', name: 'Jail', ru: 'Темница' },
    { k: 'st', name: "King's Tithe", ru: 'Подать', price: 220, g: 'pink' },
    { k: 'util', name: 'Well', ru: 'Колодец' },
    { k: 'st', name: "Baker's Row", ru: 'Пекарня', price: 240, g: 'pink' },
    { k: 'st', name: 'Royal Decree', ru: 'Указ', price: 260, g: 'pink' },
    { k: 'rail', name: 'East Gate', ru: 'Врата' },
    { k: 'st', name: "Miller's Cottage", ru: 'Мельница', price: 280, g: 'orange' },
    { k: 'chance', name: 'Decree', ru: 'Указ' },
    { k: 'st', name: 'Castle Gate', ru: 'Врата Замка', price: 300, g: 'orange' },
    { k: 'st', name: 'Dungeon Moat', ru: 'Ров', price: 320, g: 'orange' },
    { k: 'corner', name: 'Free Fair', ru: 'Ярмарка' },
    { k: 'st', name: 'Market Sq', ru: 'Рынок', price: 340, g: 'red' },
    { k: 'chance', name: 'Decree', ru: 'Указ' },
    { k: 'st', name: 'Armory Keep', ru: 'Оружейная', price: 360, g: 'red' },
    { k: 'st', name: 'Royal Guard', ru: 'Стража', price: 380, g: 'red' },
    { k: 'rail', name: 'West Gate', ru: 'Врата' },
    { k: 'st', name: 'Blacksmith Forge', ru: 'Кузница', price: 400, g: 'yellow' },
    { k: 'st', name: 'Westerby Rd', ru: 'Дорога', price: 400, g: 'yellow' },
    { k: 'util', name: 'Mill', ru: 'Мельница' },
    { k: 'st', name: 'Herald Sq', ru: 'Площадь', price: 420, g: 'yellow' },
    { k: 'corner', name: 'To Dungeon', ru: 'В Темницу' },
    { k: 'st', name: 'Minstrel Ct', ru: 'Корт', price: 450, g: 'green' },
    { k: 'st', name: 'Apothecary', ru: 'Алхимик', price: 460, g: 'green' },
    { k: 'chest', name: 'Chest', ru: 'Сундук' },
    { k: 'st', name: 'Tanner Walk', ru: 'Ряд', price: 480, g: 'green' },
    { k: 'rail', name: 'South Gate', ru: 'Врата' },
    { k: 'chance', name: 'Decree', ru: 'Указ' },
    { k: 'st', name: 'Royal Palace', ru: 'Дворец', price: 550, g: 'blue' },
    { k: 'tax', name: 'Crown Levy', ru: 'Сбор' },
    { k: 'st', name: 'Dragon Keep', ru: 'Замок Дракона', price: 600, g: 'blue' },
  ];

  const tilePosition = (idx) => {
    if (idx === 0) return { row: 11, col: 11 };
    if (idx < 10) return { row: 11 - idx, col: 11 };
    if (idx === 10) return { row: 1, col: 11 };
    if (idx < 20) return { row: 1, col: 11 - (idx - 10) };
    if (idx === 20) return { row: 1, col: 1 };
    if (idx < 30) return { row: 1 + (idx - 20), col: 1 };
    if (idx === 30) return { row: 11, col: 1 };
    return { row: 11, col: 1 + (idx - 30) };
  };

  const sideOf = (idx) =>
    idx > 0 && idx < 10 ? 'right' :
    idx > 10 && idx < 20 ? 'top' :
    idx > 20 && idx < 30 ? 'left' :
    idx > 30 && idx < 40 ? 'bottom' : 'corner';

  const CornerLabel = {
    name: 'CornerLabel',
    props: { side: String, name: String, price: Number, group: String },
    setup(props) {
      const rotation = computed(() => props.side === 'right' ? 'rotate(-90deg)' : props.side === 'left' ? 'rotate(90deg)' : props.side === 'top' ? 'rotate(180deg)' : 'none');
      const words = computed(() => (props.name || '').toUpperCase().replace(' ', '\n').split('\n'));
      return { rotation, words };
    },
    template: `
      <div :style="{
        transform: rotation,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '10% 4%',
      }">
        <div :style="{
          fontSize: '9px',
          fontFamily: 'var(--font-display)',
          color: 'var(--ink)',
          lineHeight: 1.1,
          textAlign: 'center',
          maxHeight: '60%',
          overflow: 'hidden',
        }">
          <div v-for="(w, i) in words" :key="i">{{ w }}</div>
        </div>
        <div :style="{
          fontSize: '9px', color: 'var(--ink-2)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }">
          ◈{{ price }}
        </div>
      </div>
    `,
  };

  const CenterIcon = {
    name: 'CenterIcon',
    props: { side: String, icon: String, label: String, color: String },
    setup(props) {
      const rotation = computed(() => props.side === 'right' ? 'rotate(-90deg)' : props.side === 'left' ? 'rotate(90deg)' : props.side === 'top' ? 'rotate(180deg)' : 'none');
      return { rotation };
    },
    template: `
      <div :style="{
        transform: rotation,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '2px',
        padding: '4px 2px',
      }">
        <div :style="{
          fontSize: '16px',
          color: color || 'var(--ink-2)',
          fontFamily: 'var(--font-display)',
          lineHeight: 1,
        }">
          {{ icon }}
        </div>
        <div :style="{
          fontSize: '7px',
          color: 'var(--ink-3)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }">
          {{ label }}
        </div>
      </div>
    `,
  };

  const TokenPiece = {
    name: 'TokenPiece',
    props: { token: Object, idx: Number, total: Number },
    setup(props) {
      const size = computed(() => props.total <= 1 ? 22 : props.total === 2 ? 18 : props.total === 3 ? 16 : 14);
      const offset = computed(() => props.total > 1 ? (props.idx - (props.total - 1) / 2) * (size.value * 0.6) : 0);
      const outerStyle = computed(() => ({
        position: 'relative',
        transform: `translate(${offset.value}px, ${props.idx % 2 === 0 ? 0 : -2}px)`,
        animation: props.token.active ? 'pulseSigil 1.6s ease-in-out infinite' : 'fadeIn 400ms ease-out',
      }));
      const medalStyle = computed(() => ({
        width: size.value + 'px',
        height: size.value + 'px',
        borderRadius: '50%',
        background: `radial-gradient(circle at 32% 28%, ${lighten(props.token.color, 0.45)}, ${props.token.color} 55%, ${lighten(props.token.color, -0.3)})`,
        boxShadow: props.token.active
          ? '0 0 0 1.5px #fff, 0 0 0 3px var(--gold), 0 3px 6px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.4)'
          : '0 0 0 1.5px #fff, 0 1px 3px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }));
      const glyphStyle = computed(() => ({
        color: '#fff',
        fontSize: (size.value * 0.6) + 'px',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        lineHeight: 1,
        textShadow: '0 1px 1px rgba(0,0,0,0.35)',
      }));
      const skinSize = computed(() => size.value * 0.88);
      const skinShadow = computed(() => `rgba(0,0,0,${props.token.active ? 0.55 : 0.45})`);
      return { outerStyle, medalStyle, glyphStyle, skinSize, skinShadow };
    },
    template: `
      <div :style="outerStyle">
        <div :style="medalStyle">
          <TokenArt v-if="token.skin" :id="token.skin" :size="skinSize" color="#fff" :shadow="skinShadow"/>
          <span v-else :style="glyphStyle">{{ token.initial }}</span>
        </div>
      </div>
    `,
  };

  const BoardTile = {
    name: 'BoardTile',
    components: { CornerLabel, CenterIcon, TokenPiece },
    props: { tile: Object, idx: Number, tokens: Array, onClick: Function },
    setup(props) {
      const pos = computed(() => tilePosition(props.idx));
      const side = computed(() => sideOf(props.idx));
      const isCorner = computed(() => props.tile.k === 'corner');
      const group = computed(() => props.tile.g ? GROUP_COLORS[props.tile.g] : null);
      const stripeStyle = computed(() => {
        if (!group.value) return null;
        const base = { position: 'absolute', background: group.value };
        if (side.value === 'bottom') return { ...base, top: 0, left: 0, right: 0, height: '20%' };
        if (side.value === 'top') return { ...base, bottom: 0, left: 0, right: 0, height: '20%' };
        if (side.value === 'right') return { ...base, left: 0, top: 0, bottom: 0, width: '20%' };
        if (side.value === 'left') return { ...base, right: 0, top: 0, bottom: 0, width: '20%' };
        return base;
      });
      const innerStyle = computed(() => ({
        position: 'absolute', inset: '2px',
        display: 'flex',
        flexDirection: side.value === 'left' || side.value === 'right' ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
      }));
      const utilIcon = computed(() => props.tile.name === 'Well' ? '◉' : '✦');
      const buttonStyle = computed(() => ({
        gridColumn: pos.value.col,
        gridRow: pos.value.row,
        padding: 0,
      }));
      const housesStyle = computed(() => {
        const base = { position: 'absolute', zIndex: 2, display: 'flex', gap: '1px' };
        if (side.value === 'bottom') return { ...base, top: '22%', left: '50%', transform: 'translateX(-50%)' };
        if (side.value === 'top') return { ...base, bottom: '22%', left: '50%', transform: 'translateX(-50%)' };
        if (side.value === 'right') return { ...base, left: '22%', top: '50%', transform: 'translate(0, -50%) rotate(-90deg)' };
        if (side.value === 'left') return { ...base, right: '22%', top: '50%', transform: 'translate(0, -50%) rotate(90deg)' };
        return base;
      });
      const ownerDotStyle = computed(() => props.tile.owner ? {
        position: 'absolute', top: '2px', right: '2px',
        width: '10px', height: '10px', borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${lighten(props.tile.owner, 0.3)}, ${props.tile.owner})`,
        border: '1.5px solid #fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
        zIndex: 2,
      } : null);
      const tokenStackStyle = computed(() => {
        const base = {
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '1px',
          zIndex: 4,
          pointerEvents: 'none',
        };
        if (side.value === 'bottom') return { ...base, bottom: '18%', left: 0, right: 0 };
        if (side.value === 'top') return { ...base, top: '18%', left: 0, right: 0 };
        if (side.value === 'right') return { ...base, right: '18%', top: 0, bottom: 0, flexDirection: 'column' };
        if (side.value === 'left') return { ...base, left: '18%', top: 0, bottom: 0, flexDirection: 'column' };
        return { ...base, inset: 0 };
      });
      const houseRange = computed(() => Array.from({ length: props.tile.houses || 0 }));
      const tokensSlice = computed(() => (props.tokens || []).slice(0, 4));
      const tokensTotal = computed(() => Math.min((props.tokens || []).length, 4));
      return {
        pos, side, isCorner, group, stripeStyle, innerStyle, utilIcon, buttonStyle,
        housesStyle, ownerDotStyle, tokenStackStyle, houseRange, tokensSlice, tokensTotal,
      };
    },
    template: `
      <button @click="onClick(idx)"
        class="board-tile"
        :class="{ corner: isCorner }"
        :style="buttonStyle"
        :title="tile.name">
        <div v-if="stripeStyle" :style="stripeStyle"/>
        <div :style="innerStyle">
          <div v-if="isCorner" :style="{ fontSize: '9px', color: 'var(--ink-2)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }">
            {{ tile.name }}
          </div>
          <CornerLabel v-else-if="tile.k === 'st'" :side="side" :name="tile.name" :price="tile.price" :group="group"/>
          <CenterIcon v-else-if="tile.k === 'rail'" :side="side" icon="🏰" :label="tile.name"/>
          <CenterIcon v-else-if="tile.k === 'util'" :side="side" :icon="utilIcon" :label="tile.name"/>
          <CenterIcon v-else-if="tile.k === 'tax'" :side="side" icon="◈" :label="tile.name"/>
          <CenterIcon v-else-if="tile.k === 'chance'" :side="side" icon="?" :label="tile.name" color="var(--accent)"/>
          <CenterIcon v-else-if="tile.k === 'chest'" :side="side" icon="⎔" :label="tile.name" color="var(--primary)"/>
        </div>

        <div v-if="tile.houses !== undefined && tile.houses > 0" :style="housesStyle">
          <div v-if="tile.houses === 5" :style="{
            width: '13px', height: '9px',
            background: 'linear-gradient(180deg, #8b1a1a, #5a1010)',
            borderRadius: '2px 2px 1px 1px',
            position: 'relative',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }">
            <div :style="{
              position: 'absolute', top: '-3px', left: '50%', transform: 'translateX(-50%)',
              width: '3px', height: '3px', background: '#d4a84a', borderRadius: '1px 1px 0 0',
            }"/>
          </div>
          <template v-else>
            <div v-for="(_, i) in houseRange" :key="i" :style="{
              width: '5px', height: '6px',
              background: 'linear-gradient(180deg, #2d7a4f, #1e5f3a)',
              borderRadius: '1px 1px 0 0',
              boxShadow: '0 1px 1px rgba(0,0,0,0.3)',
              position: 'relative',
            }">
              <div :style="{
                position: 'absolute', top: '-2px', left: 0, right: 0, height: '2px',
                background: '#1e5f3a',
                clipPath: 'polygon(0 100%, 50% 0, 100% 100%)',
              }"/>
            </div>
          </template>
        </div>

        <div v-if="ownerDotStyle" :style="ownerDotStyle"/>

        <div v-if="tokens && tokens.length > 0" :style="tokenStackStyle">
          <TokenPiece v-for="(t, i) in tokensSlice" :key="i" :token="t" :idx="i" :total="tokensTotal"/>
        </div>
      </button>
    `,
  };

  const LobbyScreen = {
    name: 'LobbyScreen',
    props: { go: Function, lang: String, openModal: Function, selectedBoard: String },
    setup() {
      const players = [
        { n: 'You', c: PLAYER_COLORS.you, ready: true, host: true, me: true },
        { n: 'Elara', c: PLAYER_COLORS.elara, ready: true },
        { n: 'Magnus', c: PLAYER_COLORS.magnus, ready: false },
        { n: 'Lady Cyne', c: PLAYER_COLORS.lady, ready: true },
      ];
      const tokens = ['♞', '♜', '♕', '⛨', '🜲', '✵'];
      const token = ref(0);
      const emptySeats = Array.from({ length: 4 - players.length });
      return { players, tokens, token, emptySeats, PLAYER_COLORS, lighten };
    },
    template: `
      <TopBar :on-back="() => go('rooms')" :title="lang==='RU'?'Зал совета':'Council Hall'" subtitle="DUNHOLM · 4 players"/>
      <div class="content">
        <div class="card" :style="{ textAlign: 'center', padding: '16px 14px', marginBottom: '14px' }">
          <div :style="{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }">
            {{ lang==='RU'?'Код комнаты':'Room code' }}
          </div>
          <div :style="{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '0.3em', color: 'var(--ink)' }">
            DUNHOLM
          </div>
          <button :style="{
            marginTop: '8px', padding: '6px 12px', fontSize: '11px',
            background: 'transparent', color: 'var(--primary)',
            border: '1px solid var(--primary)', borderRadius: '999px',
            fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer',
          }">
            {{ lang==='RU'?'Скопировать ссылку':'Copy link' }}
          </button>
        </div>

        <div :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }">
          {{ lang==='RU'?'Карта':'Map' }}
        </div>
        <div :style="{ marginBottom: '14px' }">
          <MapPickRow
            :board-id="selectedBoard || 'eldmark'"
            :on-open="() => openModal && openModal('boardpick')"
            :lang="lang"
            :editable="true"
          />
        </div>

        <div :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }">
          {{ lang==='RU'?'Игроки':'At the table' }}
        </div>
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }">
          <div v-for="p in players" :key="p.n" class="row" :style="{
            background: p.me ? 'rgba(90, 58, 154, 0.06)' : 'var(--card)',
            border: '1px solid ' + (p.me ? 'var(--primary)' : 'var(--line)'),
            borderRadius: '10px',
            padding: '10px 12px',
            gap: '10px',
          }">
            <Sigil :name="p.n" :color="p.c" :size="36"/>
            <div :style="{ flex: 1 }">
              <div class="row gap-6">
                <span :style="{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--ink)' }">{{ p.n }}</span>
                <Icon v-if="p.host" name="crown" :size="14" color="var(--gold)"/>
              </div>
              <div :style="{ fontSize: '11px', color: 'var(--ink-3)' }">
                {{ p.ready ? (lang==='RU'?'Готов':'Ready') : (lang==='RU'?'Выбирает':'Choosing…') }}
              </div>
            </div>
            <div :style="{
              width: '28px', height: '28px',
              borderRadius: '50%',
              background: p.ready ? 'var(--emerald)' : 'var(--card-alt)',
              border: '1px solid ' + (p.ready ? 'var(--emerald)' : 'var(--line)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }">
              <Icon :name="p.ready ? 'check' : 'x'" :size="16" :color="p.ready ? '#fff' : 'var(--ink-4)'"/>
            </div>
          </div>
          <div v-for="(_, i) in emptySeats" :key="'e'+i" class="row" :style="{
            background: 'transparent', border: '1px dashed var(--line-strong)',
            borderRadius: '10px', padding: '10px 12px', gap: '10px',
            color: 'var(--ink-4)', fontStyle: 'italic', fontSize: '13px',
          }">
            <Icon name="plus" :size="18" color="var(--ink-4)"/>
            {{ lang==='RU'?'Пустая скамья':'Empty seat' }}
          </div>
        </div>

        <div :style="{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }">
          {{ lang==='RU'?'Ваша фишка':'Your token' }}
        </div>
        <div class="rail" :style="{ marginBottom: '14px' }">
          <button v-for="(t, i) in tokens" :key="i" @click="token = i" :style="{
            width: '56px', height: '56px', flexShrink: 0,
            background: token === i
              ? 'linear-gradient(135deg, ' + PLAYER_COLORS.you + ', ' + lighten(PLAYER_COLORS.you, 0.2) + ')'
              : 'var(--card)',
            color: token === i ? '#fff' : 'var(--ink-2)',
            border: '1px solid ' + (token === i ? PLAYER_COLORS.you : 'var(--line)'),
            borderRadius: '10px',
            fontSize: '28px',
            fontFamily: 'var(--font-display)',
            cursor: 'pointer',
          }">{{ t }}</button>
        </div>

        <button class="btn btn-primary" :style="{ width: '100%', padding: '14px', fontSize: '15px' }" @click="go('game')">
          <Icon name="dice" :size="16" color="#fff"/>
          {{ lang==='RU'?'Начать игру':'Begin the game' }}
        </button>
      </div>
    `,
  };

  const GameScreen = {
    name: 'GameScreen',
    components: { BoardTile },
    props: { go: Function, lang: String, openModal: Function, playerCount: { type: Number, default: 4 } },
    setup(props) {
      const activePlayer = ref(0);
      const rolling = ref(false);
      const lastDice = ref([3, 4]);

      const allPlayers = [
        { n: 'You', c: PLAYER_COLORS.you, cash: 1250, me: true, skin: 'dragon', icon: '⚔' },
        { n: 'Elara', c: PLAYER_COLORS.elara, cash: 980, skin: 'phoenix', icon: '✦' },
        { n: 'Magnus', c: PLAYER_COLORS.magnus, cash: 1420, skin: 'knight', icon: '♛' },
        { n: 'Lady', c: PLAYER_COLORS.lady, cash: 650, skin: 'crown', icon: '♕' },
        { n: 'Oren', c: PLAYER_COLORS.oren, cash: 1100, skin: 'griffin', icon: '♞' },
        { n: 'Finn', c: PLAYER_COLORS.finn, cash: 820, skin: 'shield', icon: '⛨' },
      ];
      const players = computed(() => allPlayers.slice(0, props.playerCount));
      const positions = ref([14, 7, 23, 31, 5, 18].slice(0, props.playerCount));
      const compact = computed(() => props.playerCount > 4);

      const decoratedTiles = computed(() => {
        const buildings = {
          1:  { owner: players.value[1]?.c, houses: 2 },
          3:  { owner: players.value[1]?.c, houses: 1 },
          6:  { owner: players.value[0]?.c, houses: 3 },
          8:  { owner: players.value[0]?.c, houses: 1 },
          9:  { owner: players.value[0]?.c, houses: 5 },
          13: { owner: players.value[2]?.c, houses: 4 },
          16: { owner: players.value[2]?.c, houses: 2 },
          19: { owner: players.value[2]?.c, houses: 2 },
          24: { owner: players.value[3]?.c, houses: 1 },
          27: { owner: players.value[4]?.c, houses: 0 },
          39: { owner: players.value[0]?.c, houses: 0 },
        };
        return TILES.map((t, i) => ({ ...t, ...(buildings[i] || {}) }));
      });

      const tokensByTile = computed(() => {
        const acc = {};
        positions.value.forEach((p, i) => {
          if (!acc[p]) acc[p] = [];
          acc[p].push({
            color: players.value[i].c,
            skin: players.value[i].skin,
            initial: players.value[i].n[0].toUpperCase(),
            active: i === activePlayer.value,
          });
        });
        return acc;
      });

      const onTileClick = (idx) => {
        const t = decoratedTiles.value[idx];
        if (t.k === 'st') props.openModal('deed', { tile: t, idx });
      };

      const roll = () => {
        rolling.value = true;
        setTimeout(() => {
          const d1 = 1 + Math.floor(Math.random() * 6);
          const d2 = 1 + Math.floor(Math.random() * 6);
          const total = d1 + d2;
          const idx = activePlayer.value;
          positions.value = positions.value.map((p, i) => i === idx ? (p + total) % 40 : p);
          rolling.value = false;
          lastDice.value = [d1, d2];
        }, 600);
      };

      return {
        activePlayer, rolling, lastDice,
        players, positions, compact,
        decoratedTiles, tokensByTile,
        onTileClick, roll,
      };
    },
    template: `
      <TopBar
        :on-back="() => go('home')"
        :avatar="{ initial: 'R' }"
        title="Eldmark Vale"
        :subtitle="(lang==='RU'?'Раунд':'Round') + ' 14 · ' + (lang==='RU'?'ваш ход':'your turn')"
        :right-initial="true"
      />

      <div class="player-pills" :style="compact ? { flexWrap: 'nowrap' } : {}">
        <PlayerPill v-for="(p, i) in players" :key="p.n"
          :name="p.n" :cash="p.cash" :color="p.c" :me="p.me"
          :active="i === activePlayer" :icon="p.icon" :skin="p.skin" :compact="compact"/>
      </div>

      <div :style="{ padding: '4px 4px 8px', position: 'relative', zIndex: 4 }">
        <div class="board">
          <BoardTile v-for="(t, i) in decoratedTiles" :key="i" :tile="t" :idx="i" :tokens="tokensByTile[i]" :on-click="onTileClick"/>
          <div class="board-center">
            <div :style="{ textAlign: 'center' }">
              <div :style="{
                fontFamily: 'var(--font-title)',
                fontSize: '20px',
                color: 'var(--accent)',
                letterSpacing: '0.08em',
                lineHeight: 1,
              }">
                REALM<br/>ROYALE
              </div>
              <div :style="{
                fontSize: '11px', color: 'var(--ink-3)',
                fontFamily: 'var(--font-display)',
                marginTop: '6px', letterSpacing: '0.2em',
              }">— ❦ —</div>
            </div>

            <div :style="{
              position: 'absolute',
              top: '18%', right: '14%',
              width: '34px', height: '24px',
              background: 'linear-gradient(135deg, #8b1a1a, #6a1212)',
              borderRadius: '2px',
              transform: 'rotate(-12deg)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
              border: '1px solid #4a0e0e',
            }">
              <div :style="{ position: 'absolute', inset: '4px 4px 4px 7px', border: '1px solid rgba(212, 168, 74, 0.5)', borderRadius: '1px' }"/>
            </div>
            <div :style="{
              position: 'absolute',
              bottom: '22%', left: '18%',
              width: '30px', height: '22px',
              background: 'linear-gradient(135deg, #3e2272, #2d1a5a)',
              borderRadius: '2px',
              transform: 'rotate(14deg)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
              border: '1px solid #1a0e3a',
            }">
              <div :style="{ position: 'absolute', inset: '3px', border: '1px solid rgba(212, 168, 74, 0.5)', borderRadius: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'rgba(212, 168, 74, 0.8)' }">✦</div>
            </div>
          </div>
        </div>
      </div>

      <div class="event-log">
        <div class="ev"><b>Elara</b> {{ lang==='RU'?'купила Weaver Lane':'bought Weaver Lane' }}</div>
        <div class="ev"><b>Magnus</b> {{ lang==='RU'?'выбросил 8 → Fortune Tower':'rolled 8 → Fortune Tower' }}</div>
        <div class="ev"><b>{{ lang==='RU'?'Вы':'You' }}</b> {{ lang==='RU'?'собрали ренту · 60':'collected rent · 60 ◈' }}</div>
      </div>

      <div class="action-bar">
        <div class="dice-pair">
          <Die :value="lastDice[0]" :size="34" :rolling="rolling"/>
          <Die :value="lastDice[1]" :size="34" :rolling="rolling"/>
        </div>
        <div :style="{ display: 'flex', gap: '6px', minWidth: 0 }">
          <button class="btn btn-primary" :style="{ flex: 1, padding: '12px 10px', fontSize: '13px' }" @click="roll">
            <Icon name="dice" :size="16" color="#fff"/>
            {{ lang==='RU'?'Бросить':'Roll Dice' }}
          </button>
          <button class="btn btn-ghost" :style="{ padding: '12px 10px', fontSize: '13px' }" @click="openModal('trade')">
            <Icon name="trade" :size="14"/>
          </button>
          <button class="btn btn-ghost" :style="{ padding: '12px 10px', fontSize: '13px' }">
            {{ lang==='RU'?'Ход':'End' }}
          </button>
        </div>
      </div>
    `,
  };

  window.MPV = window.MPV || { components: {} };
  Object.assign(window.MPV.components, { LobbyScreen, GameScreen });
  window.TILES = TILES;
})();
