// System screens: Rotate, Error
// Vue 3 / Composition API port.

(() => {
  const { computed } = Vue;

  const RotateScreen = {
    name: 'RotateScreen',
    props: { lang: String },
    setup(props) {
      const L = computed(() => props.lang === 'RU' ? {
        title: 'Поверните устройство',
        sub: 'Mini · Poly задуман для вертикального режима.',
        hint: 'Разверните телефон, чтобы продолжить игру.',
      } : {
        title: 'Please rotate',
        sub: 'Mini · Poly is designed for portrait mode.',
        hint: 'Turn your phone upright to continue.',
      });
      const stars = [];
      for (let i = 0; i < 30; i++) {
        const x = (i * 37) % 100, y = (i * 53) % 100, r = (i % 3) * 0.4 + 0.4;
        stars.push({ i, x, y, r, opacity: 0.3 + (i % 5) * 0.14 });
      }
      return { L, stars };
    },
    template: `
      <div :style="{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, #3a2a62 0%, #1e1038 70%, #140828 100%)',
        color: '#f0e4c8',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px', textAlign: 'center', overflow: 'hidden', zIndex: 1000,
      }">
        <svg :style="{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4 }">
          <circle v-for="s in stars" :key="s.i" :cx="s.x + '%'" :cy="s.y + '%'" :r="s.r" fill="#d4a84a" :opacity="s.opacity"/>
        </svg>

        <div :style="{ position: 'relative', width: '140px', height: '140px', marginBottom: '28px' }">
          <svg viewBox="0 0 140 140" :style="{ width: '100%', height: '100%' }">
            <g :style="{ transformOrigin: '70px 70px', animation: 'rotateLoop 3s linear infinite' }">
              <path d="M 70 20 A 50 50 0 1 1 20 70" stroke="#d4a84a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="4 6"/>
              <path d="M 66 16 L 70 22 L 76 18" stroke="#d4a84a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
            <g :style="{ transformOrigin: '70px 70px', animation: 'rotatePhone 3s ease-in-out infinite' }">
              <rect x="38" y="50" width="64" height="40" rx="6" fill="#2a1d10" stroke="#d4a84a" stroke-width="2"/>
              <rect x="42" y="54" width="56" height="32" rx="3" fill="#4a2e82"/>
              <circle cx="70" cy="70" r="3" fill="#d4a84a"/>
            </g>
          </svg>
        </div>

        <svg viewBox="0 0 80 32" :style="{ width: '56px', marginBottom: '12px', opacity: 0.7 }">
          <path d="M5 26 L12 8 L25 18 L40 4 L55 18 L68 8 L75 26 Z" fill="#d4a84a"/>
          <circle cx="12" cy="8" r="2" fill="#f7eeda"/>
          <circle cx="40" cy="4" r="2.5" fill="#f7eeda"/>
          <circle cx="68" cy="8" r="2" fill="#f7eeda"/>
        </svg>

        <div :style="{
          fontFamily: 'var(--font-display)',
          fontSize: '26px', letterSpacing: '0.04em',
          color: '#f7eeda', marginBottom: '8px', textWrap: 'balance',
        }">{{ L.title }}</div>
        <div :style="{ fontSize: '14px', color: '#c9b88e', lineHeight: 1.5, maxWidth: '280px', marginBottom: '18px' }">
          {{ L.sub }}
        </div>
        <div :style="{
          fontSize: '11px', color: '#8a7152', letterSpacing: '0.12em',
          textTransform: 'uppercase', padding: '6px 12px',
          border: '1px solid rgba(212, 168, 74, 0.3)', borderRadius: '999px',
        }">
          {{ L.hint }}
        </div>
      </div>
    `,
  };

  const ErrorScreen = {
    name: 'ErrorScreen',
    props: { lang: String, onRetry: Function, onHome: Function, kind: String },
    setup(props) {
      const L = computed(() => {
        const k = props.kind;
        return props.lang === 'RU' ? {
          title: 'Что-то пошло не так',
          sub: k === 'offline' ? 'Связь с королевством потеряна.' : 'Писарь уронил перо в чернильницу.',
          code: k === 'offline' ? 'CONNECTION LOST' : 'ERROR #' + (k === 'server' ? '503' : '418'),
          retry: 'Попробовать снова',
          home: 'В Тронный зал',
          hint: 'Если ошибка повторяется — сообщите герольду.',
        } : {
          title: 'Something went awry',
          sub: k === 'offline' ? 'The realm has lost its tether.' : 'The scribe has dropped his quill.',
          code: k === 'offline' ? 'CONNECTION LOST' : 'ERROR #' + (k === 'server' ? '503' : '418'),
          retry: 'Try again',
          home: 'Return to Throne Hall',
          hint: 'If this persists — summon the herald.',
        };
      });
      return { L };
    },
    template: `
      <div :style="{
        position: 'absolute', inset: 0,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        padding: 'var(--csat, 50px) 24px var(--csab, 20px)',
        overflow: 'auto',
        zIndex: 100,
      }">
        <div :style="{ flex: 1 }"/>

        <div :style="{ position: 'relative', width: '160px', height: '160px', margin: '0 auto 24px' }">
          <svg viewBox="0 0 160 160" :style="{ width: '100%', height: '100%' }">
            <defs>
              <linearGradient id="scrollFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#f7eeda"/>
                <stop offset="1" stop-color="#e8dcb8"/>
              </linearGradient>
              <filter id="softShadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
              </filter>
            </defs>
            <g filter="url(#softShadow)">
              <path d="M 28 36 L 132 36 Q 138 36 138 42 L 138 60 L 142 66 L 136 72 L 142 80 L 136 88 L 140 96 L 134 102 L 138 118 Q 138 124 132 124 L 92 124 L 84 132 L 76 124 L 28 124 Q 22 124 22 118 L 22 100 L 18 92 L 24 86 L 18 78 L 26 70 L 20 60 L 22 42 Q 22 36 28 36 Z"
                fill="url(#scrollFill)" stroke="#8a7152" stroke-width="1.5"/>
              <path d="M 70 36 L 66 50 L 74 62 L 68 76 L 76 90 L 70 104 L 78 124"
                stroke="#c0a060" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-dasharray="2 3" opacity="0.5"/>
              <ellipse cx="52" cy="74" rx="10" ry="6" fill="#4a2e82" opacity="0.25"/>
              <circle cx="96" cy="86" r="3" fill="#4a2e82" opacity="0.4"/>
              <circle cx="104" cy="92" r="1.5" fill="#4a2e82" opacity="0.5"/>
              <circle cx="46" cy="92" r="1" fill="#4a2e82" opacity="0.5"/>
              <line x1="36" y1="54" x2="62" y2="54" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="82" y1="54" x2="124" y2="54" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="80" y1="68" x2="122" y2="68" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="80" y1="100" x2="116" y2="100" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="36" y1="112" x2="64" y2="112" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
            </g>
            <g :style="{ transformOrigin: '84px 132px', animation: 'wobble 3s ease-in-out infinite' }">
              <circle cx="84" cy="132" r="14" fill="#9a1c3a" stroke="#5a0818" stroke-width="1.5"/>
              <path d="M 84 118 L 90 126 L 84 132 L 90 140 L 84 146" stroke="#5a0818" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              <path d="M 72 132 L 78 128 M 78 136 L 72 132 M 96 132 L 90 128 M 90 136 L 96 132" stroke="#f7eeda" stroke-width="1" fill="none" stroke-linecap="round" opacity="0.7"/>
            </g>
          </svg>
        </div>

        <div :style="{
          fontFamily: 'var(--font-display)', fontSize: '24px',
          textAlign: 'center', color: 'var(--ink)',
          marginBottom: '6px', textWrap: 'balance',
        }">{{ L.title }}</div>
        <div :style="{
          fontSize: '14px', textAlign: 'center', color: 'var(--ink-3)',
          lineHeight: 1.5, maxWidth: '300px', margin: '0 auto 14px',
        }">{{ L.sub }}</div>

        <div :style="{
          display: 'inline-block', margin: '0 auto 28px',
          padding: '4px 10px',
          fontSize: '10px', fontFamily: 'var(--font-mono)',
          letterSpacing: '0.16em',
          color: 'var(--ink-3)',
          border: '1px solid var(--line)', borderRadius: '4px',
          background: 'var(--card)',
        }">{{ L.code }}</div>

        <div :style="{ flex: 1 }"/>

        <div :style="{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }">
          <button class="btn btn-primary" @click="onRetry" :style="{ padding: '12px' }">
            <Icon name="dice" :size="16" color="#f7eeda"/>
            {{ L.retry }}
          </button>
          <button class="btn btn-ghost" @click="onHome" :style="{ padding: '12px' }">
            {{ L.home }}
          </button>
        </div>
        <div :style="{
          fontSize: '11px', color: 'var(--ink-4)',
          textAlign: 'center', lineHeight: 1.4,
        }">
          {{ L.hint }}
        </div>
      </div>
    `,
  };

  window.MPV = window.MPV || { components: {} };
  Object.assign(window.MPV.components, { RotateScreen, ErrorScreen });
})();
