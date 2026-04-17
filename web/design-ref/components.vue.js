// Primitives: Sigil, Icon, Die, Fleuron, WaxChip, TopBar, PlayerPill, TabBar, ShieldStat
// Vue 3 / Composition API port.

(() => {
  const { h, computed } = Vue;

  const GROUP_COLORS = {
    brown: 'var(--g-brown)', teal: 'var(--g-teal)', pink: 'var(--g-pink)',
    orange: 'var(--g-orange)', red: 'var(--g-red)', yellow: 'var(--g-yellow)',
    green: 'var(--g-green)', blue: 'var(--g-blue)',
  };

  const PLAYER_COLORS = {
    you:    '#8b1a1a',
    elara:  '#c07028',
    magnus: '#2d7a4f',
    lady:   '#5a3a9a',
    oren:   '#3a7a8a',
    finn:   '#b8892e',
  };

  function lighten(hex, amt) {
    const c = hex.replace('#', '');
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.round(r + (255 - r) * amt));
    g = Math.min(255, Math.round(g + (255 - g) * amt));
    b = Math.min(255, Math.round(b + (255 - b) * amt));
    return `rgb(${r}, ${g}, ${b})`;
  }

  const formatCash = (n) => {
    if (n >= 10000) return Math.round(n / 1000) + 'к';
    if (n >= 1000) {
      const whole = Math.floor(n / 1000);
      const dec = Math.round((n - whole * 1000) / 100);
      return dec === 0 ? whole + 'к' : whole + ',' + dec + 'к';
    }
    return n.toLocaleString();
  };

  // Sigil — circular crest
  const Sigil = {
    name: 'Sigil',
    props: {
      name: String,
      color: String,
      size: { type: Number, default: 22 },
      initial: String,
    },
    setup(props) {
      return () => h('div', {
        style: {
          width: props.size + 'px',
          height: props.size + 'px',
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${lighten(props.color, 0.2)}, ${props.color})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: 'var(--font-display)',
          fontSize: Math.round(props.size * 0.5) + 'px',
          fontWeight: 500,
          flexShrink: 0,
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(0,0,0,0.2)',
          letterSpacing: 0,
        },
      }, props.initial || (props.name ? props.name[0].toUpperCase() : '?'));
    },
  };

  // Icon — inline SVG icon library
  const iconPaths = (color, strokeWidth) => ({
    back: [h('path', { d: 'M15 18l-6-6 6-6', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })],
    menu: [
      h('line', { x1: '4', y1: '7', x2: '20', y2: '7', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round' }),
      h('line', { x1: '4', y1: '12', x2: '20', y2: '12', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round' }),
      h('line', { x1: '4', y1: '17', x2: '20', y2: '17', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round' }),
    ],
    bell: [
      h('path', { d: 'M6 9a6 6 0 1112 0c0 4 2 5 2 5H4s2-1 2-5z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('path', { d: 'M10 19a2 2 0 004 0', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
    dice: [
      h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('circle', { cx: '9', cy: '9', r: '1', fill: color }),
      h('circle', { cx: '15', cy: '9', r: '1', fill: color }),
      h('circle', { cx: '9', cy: '15', r: '1', fill: color }),
      h('circle', { cx: '15', cy: '15', r: '1', fill: color }),
    ],
    trade: [h('path', { d: 'M7 7h13l-3-3M17 17H4l3 3', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })],
    check: [h('path', { d: 'M5 12l4 4L19 6', stroke: color, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })],
    x: [
      h('line', { x1: '6', y1: '6', x2: '18', y2: '18', stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
      h('line', { x1: '18', y1: '6', x2: '6', y2: '18', stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
    ],
    plus: [
      h('line', { x1: '12', y1: '5', x2: '12', y2: '19', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round' }),
      h('line', { x1: '5', y1: '12', x2: '19', y2: '12', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round' }),
    ],
    coin: [
      h('circle', { cx: '12', cy: '12', r: '8', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M9 10c0-1 1-2 3-2s3 1 3 2-1 1.5-3 2-3 1-3 2 1 2 3 2 3-1 3-2M12 6v2M12 16v2', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
    castle: [
      h('path', { d: 'M4 20V10l2 2V8l2 2V8l2 2V8l2 2V8l2 2V8l2 2V8l2 2v10z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' }),
      h('path', { d: 'M9 20v-4h6v4', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
    ],
    shield: [h('path', { d: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' })],
    trophy: [
      h('path', { d: 'M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('path', { d: 'M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
    ],
    users: [
      h('circle', { cx: '9', cy: '9', r: '3', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M3 19c0-3 3-5 6-5s6 2 6 5', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
      h('circle', { cx: '17', cy: '8', r: '2.5', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M15 13c3 0 6 2 6 5', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
    bag: [
      h('path', { d: 'M6 8h12l-1 12H7z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' }),
      h('path', { d: 'M9 8a3 3 0 016 0', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
    ],
    user: [
      h('circle', { cx: '12', cy: '9', r: '3.5', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M4 20c0-4 4-6 8-6s8 2 8 6', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
    home: [h('path', { d: 'M4 11l8-7 8 7v9h-6v-6h-4v6H4z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' })],
    scroll: [
      h('path', { d: 'M6 4h12v14a2 2 0 01-2 2H8a2 2 0 01-2-2V4z', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M9 8h6M9 11h6M9 14h4', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
    globe: [
      h('circle', { cx: '12', cy: '12', r: '8', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M4 12h16M12 4c2 3 2 13 0 16M12 4c-2 3-2 13 0 16', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
    ],
    search: [
      h('circle', { cx: '11', cy: '11', r: '6', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('line', { x1: '16', y1: '16', x2: '20', y2: '20', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round' }),
    ],
    send: [h('path', { d: 'M4 12L20 4l-4 16-3-7z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' })],
    crown: [h('path', { d: 'M3 8l3 6h12l3-6-4 3-3-5-2 5-2-5-3 5z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' })],
    key: [
      h('circle', { cx: '8', cy: '12', r: '4', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M12 12h9l-2 2M17 12v3', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
    lock: [
      h('rect', { x: '5', y: '11', width: '14', height: '9', rx: '1.5', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M8 11V7a4 4 0 018 0v4', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
    ],
    unlock: [
      h('rect', { x: '5', y: '11', width: '14', height: '9', rx: '1.5', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
      h('path', { d: 'M8 11V7a4 4 0 018 0', stroke: color, 'stroke-width': strokeWidth, fill: 'none' }),
    ],
    star: [h('path', { d: 'M12 3l2.5 6 6.5.5-5 4.5 1.5 6.5L12 17l-5.5 3.5L8 14l-5-4.5L9.5 9z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' })],
    chat: [h('path', { d: 'M4 5h16v10H9l-5 5V5z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' })],
    horse: [h('path', { d: 'M5 20h14M7 20V9l5-5 4 3-2 2 3 3v8M9 14h2', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' })],
    tavern: [
      h('path', { d: 'M4 9l3-5h10l3 5M5 9h14v11H5z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' }),
      h('path', { d: 'M12 9v11M8 13h8', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
    swords: [h('path', { d: 'M5 4l7 7M19 4l-7 7M12 11l3 3-4 4-3-3zM12 11l-3 3 4 4 3-3z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' })],
    banner: [
      h('path', { d: 'M7 3h10v12l-5-3-5 3z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' }),
      h('path', { d: 'M7 3v18M17 3v18', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
    chalice: [h('path', { d: 'M6 4h12v3c0 4-3 6-6 6s-6-2-6-6V4zM12 13v6M8 20h8', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })],
    helm: [
      h('path', { d: 'M5 12a7 7 0 0114 0v6H5z', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linejoin': 'round' }),
      h('path', { d: 'M5 15h14M9 11v3M15 11v3', stroke: color, 'stroke-width': strokeWidth, fill: 'none', 'stroke-linecap': 'round' }),
    ],
  });

  const Icon = {
    name: 'Icon',
    props: {
      name: String,
      size: { type: Number, default: 18 },
      color: { type: String, default: 'currentColor' },
      strokeWidth: { type: Number, default: 1.8 },
    },
    setup(props) {
      return () => {
        const paths = iconPaths(props.color, props.strokeWidth);
        return h('svg', {
          width: props.size, height: props.size,
          viewBox: '0 0 24 24', fill: 'none',
          style: { display: 'block', flexShrink: 0 },
        }, paths[props.name] || []);
      };
    },
  };

  // Die face with pips
  const Die = {
    name: 'Die',
    props: {
      value: Number,
      size: { type: Number, default: 44 },
      rolling: { type: Boolean, default: false },
    },
    setup(props) {
      const dotMap = {
        1: [[50, 50]],
        2: [[28, 28], [72, 72]],
        3: [[25, 25], [50, 50], [75, 75]],
        4: [[28, 28], [72, 28], [28, 72], [72, 72]],
        5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
        6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
      };
      const dots = computed(() => dotMap[props.value] || []);
      const pipSize = computed(() => Math.max(4, props.size * 0.14));
      return { dots, pipSize };
    },
    template: `
      <div :style="{
        width: size + 'px',
        height: size + 'px',
        background: 'linear-gradient(145deg, #fefaf0 0%, #e8dcc0 100%)',
        borderRadius: '7px',
        position: 'relative',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(90,60,30,0.2), 0 2px 4px rgba(0,0,0,0.2)',
        border: '1px solid #c9b88e',
        animation: rolling ? 'diceRoll 600ms ease-out' : 'none',
        flexShrink: 0,
      }">
        <div v-for="([x,y], i) in dots" :key="i" :style="{
          position: 'absolute',
          left: x + '%',
          top: y + '%',
          width: pipSize + 'px',
          height: pipSize + 'px',
          borderRadius: '50%',
          background: '#2a1d10',
          transform: 'translate(-50%, -50%)',
          boxShadow: 'inset 0 0 1px rgba(212, 168, 74, 0.6)',
        }"/>
      </div>
    `,
  };

  const Fleuron = {
    name: 'Fleuron',
    props: { text: String },
    template: `
      <div :style="{
        display: 'flex', alignItems: 'center', gap: '10px',
        margin: '10px 0', color: 'var(--ink-3)',
      }">
        <div :style="{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--line-strong))' }"/>
        <span :style="{ fontSize: '12px', fontFamily: 'var(--font-title)', letterSpacing: '0.15em' }">
          {{ text || '❦' }}
        </span>
        <div :style="{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--line-strong), transparent)' }"/>
      </div>
    `,
  };

  const WaxChip = {
    name: 'WaxChip',
    props: {
      color: { type: String, default: 'var(--accent)' },
      size: { type: String, default: 'sm' },
    },
    setup(props) {
      const S = computed(() => props.size === 'sm' ? { w: 22, f: 10 } : { w: 32, f: 13 });
      const styleObj = computed(() => ({
        width: S.value.w + 'px',
        height: S.value.w + 'px',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${lighten(props.color, 0.25)}, ${props.color})`,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: S.value.f + 'px',
        fontWeight: 500,
        flexShrink: 0,
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25)',
      }));
      return { styleObj };
    },
    template: `<div :style="styleObj"><slot/></div>`,
  };

  const TopBar = {
    name: 'TopBar',
    props: {
      onBack: Function,
      onMenu: Function,
      title: String,
      subtitle: String,
      avatar: Object,
      rightInitial: Boolean,
    },
    template: `
      <div class="topbar">
        <button v-if="onBack" class="icon-btn" @click="onBack" aria-label="Back">
          <Icon name="back" :size="18"/>
        </button>
        <div v-if="avatar" class="avatar-btn">{{ avatar.initial || 'R' }}</div>
        <div class="title">
          <h1>{{ title }}</h1>
          <div v-if="subtitle" class="sub">{{ subtitle }}</div>
        </div>
        <slot name="right"/>
        <template v-if="rightInitial">
          <button class="icon-btn"><Icon name="bell" :size="18"/></button>
          <button class="icon-btn" @click="onMenu"><Icon name="menu" :size="18"/></button>
        </template>
      </div>
    `,
  };

  const PlayerPill = {
    name: 'PlayerPill',
    props: {
      name: String,
      cash: Number,
      color: String,
      me: Boolean,
      active: Boolean,
      icon: String,
      skin: String,
      compact: Boolean,
    },
    setup(props) {
      const pillStyle = computed(() => {
        const s = {};
        if (props.active) {
          s.borderColor = 'var(--primary)';
          s.boxShadow = '0 0 0 1.5px var(--primary)';
        }
        if (props.compact) {
          s.minWidth = '78px';
          s.padding = '5px 8px';
          s.flex = '0 0 auto';
        }
        return s;
      });
      const dotSize = computed(() => props.compact ? 22 : 24);
      const dotStyle = computed(() => ({
        background: `radial-gradient(circle at 30% 30%, ${lighten(props.color, 0.35)}, ${props.color} 60%, ${lighten(props.color, -0.2)})`,
        width: dotSize.value + 'px',
        height: dotSize.value + 'px',
        boxShadow: '0 0 0 1.5px #fff, 0 1px 2px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.4)',
        overflow: 'hidden',
      }));
      const hasTokenArt = computed(() => props.skin && !!window.MPV?.components?.TokenArt);
      return { pillStyle, dotStyle, dotSize, hasTokenArt, formatCash };
    },
    template: `
      <div class="ppill" :class="{ me: me }" :style="pillStyle">
        <div class="dot" :style="dotStyle">
          <TokenArt v-if="hasTokenArt" :id="skin" :size="dotSize * 0.88" color="#fff" shadow="rgba(0,0,0,0.55)"/>
          <span v-else>{{ icon || name[0] }}</span>
        </div>
        <div :style="{ minWidth: 0, flex: 1 }">
          <div class="nm" :style="{
            fontSize: (compact ? 12 : 13) + 'px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }">{{ name }}</div>
          <div class="cash" :style="{ fontSize: (compact ? 10 : 11) + 'px' }">
            ◈ {{ formatCash(cash) }}
          </div>
        </div>
      </div>
    `,
  };

  const TabBar = {
    name: 'TabBar',
    props: {
      active: String,
      onChange: Function,
    },
    setup() {
      const tabs = [
        { id: 'rooms', label: 'Tavern', ru: 'Таверна', icon: 'tavern' },
        { id: 'game', label: 'Play', ru: 'Игра', icon: 'swords' },
        { id: 'friends', label: 'Allies', ru: 'Союзники', icon: 'banner' },
        { id: 'shop', label: 'Bazaar', ru: 'Ярмарка', icon: 'chalice' },
        { id: 'profile', label: 'Herald', ru: 'Герольд', icon: 'helm' },
      ];
      return { tabs };
    },
    template: `
      <div class="tabbar">
        <button v-for="t in tabs" :key="t.id"
          class="tab" :class="{ active: active === t.id }"
          @click="onChange(t.id)">
          <div class="tab-icon">
            <Icon :name="t.icon" :size="22" :stroke-width="1.6"/>
          </div>
          <span>{{ t.label }}</span>
        </button>
      </div>
    `,
  };

  const ShieldStat = {
    name: 'ShieldStat',
    props: {
      label: String,
      value: [String, Number],
      accent: { type: String, default: 'var(--primary)' },
    },
    template: `
      <div :style="{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '10px',
        padding: '10px 8px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }">
        <div :style="{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: accent }"/>
        <div :style="{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          color: 'var(--ink)',
          fontWeight: 400,
          letterSpacing: '0.02em',
        }">{{ value }}</div>
        <div :style="{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '2px' }">
          {{ label }}
        </div>
      </div>
    `,
  };

  window.MPV = window.MPV || { components: {} };
  Object.assign(window.MPV.components, {
    Sigil, Icon, Die, Fleuron, WaxChip, TopBar, PlayerPill, TabBar, ShieldStat,
  });

  // Expose helpers for other files
  window.GROUP_COLORS = GROUP_COLORS;
  window.PLAYER_COLORS = PLAYER_COLORS;
  window.MPUtil = { lighten, formatCash };
})();
