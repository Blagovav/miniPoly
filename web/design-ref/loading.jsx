// Loading screen — shown on app boot and as overlay during transitions/async waits.
// Multiple variants switchable via Tweaks: sigil, dice, scroll, coins.

const LoadingScreen = ({ variant = 'sigil', message, lang = 'EN', fullscreen = true }) => {
  const L = lang === 'RU' ? {
    sigil: 'Герб пробуждается…',
    dice: 'Жребий брошен…',
    scroll: 'Разворачиваем свитки…',
    coins: 'Пересчитываем казну…',
    boot: 'Готовим королевство',
    wait: 'Минуту, милорд…',
  } : {
    sigil: 'The sigil awakens…',
    dice: 'The die is cast…',
    scroll: 'Unfurling the scrolls…',
    coins: 'Counting the coffers…',
    boot: 'Preparing the realm',
    wait: 'A moment, my lord…',
  };

  const msg = message || L[variant] || L.wait;

  const body = (
    <div className="loading-inner">
      <div className="loading-art">
        {variant === 'sigil' && <SigilSpinner/>}
        {variant === 'dice' && <DiceSpinner/>}
        {variant === 'scroll' && <ScrollSpinner/>}
        {variant === 'coins' && <CoinsSpinner/>}
      </div>
      <div className="loading-text">
        <div className="loading-title">Mini · Poly</div>
        <div className="loading-sub">{msg}</div>
        <div className="loading-dots" aria-hidden>
          <span/><span/><span/>
        </div>
      </div>
    </div>
  );

  if (!fullscreen) return <div className="loading-overlay loading-inline">{body}</div>;

  return (
    <div className="loading-screen parchment">
      <div className="loading-bg"/>
      {body}
      <div className="loading-foot">Anno MMXXVI · Guild of Mapmakers</div>
    </div>
  );
};

// ─── Variant: heraldic sigil rotating inside a ring ───
const SigilSpinner = () => (
  <div className="ls-sigil">
    <svg viewBox="0 0 120 120" width="140" height="140">
      <defs>
        <radialGradient id="sg-ring" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5d98a" stopOpacity="0"/>
          <stop offset="70%" stopColor="#f5d98a" stopOpacity="0"/>
          <stop offset="92%" stopColor="#d4a84a" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#8b6914" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Outer rotating ring with tick marks */}
      <g className="ls-spin-slow">
        <circle cx="60" cy="60" r="54" fill="none" stroke="url(#sg-ring)" strokeWidth="2"/>
        {Array.from({length: 24}).map((_, i) => {
          const a = (i * 15) * Math.PI / 180;
          const long = i % 3 === 0;
          const r1 = 52, r2 = long ? 46 : 49;
          return <line key={i}
            x1={60 + Math.cos(a) * r1} y1={60 + Math.sin(a) * r1}
            x2={60 + Math.cos(a) * r2} y2={60 + Math.sin(a) * r2}
            stroke="#8b6914" strokeWidth={long ? 1.4 : 0.8} opacity="0.7"/>;
        })}
      </g>
      {/* Middle ring (counter-rotating) */}
      <g className="ls-spin-fast-rev">
        <circle cx="60" cy="60" r="40" fill="none" stroke="#8b6914" strokeWidth="0.6" strokeDasharray="2 4" opacity="0.55"/>
      </g>
      {/* Center heraldic shield */}
      <g className="ls-pulse">
        <path d="M40 38 L80 38 L80 64 Q80 82 60 92 Q40 82 40 64 Z"
              fill="#6b4cc4" stroke="#3e2272" strokeWidth="1.5" strokeLinejoin="round"/>
        {/* Crown on top */}
        <path d="M44 38 L46 28 L50 34 L54 24 L60 32 L66 24 L70 34 L74 28 L76 38 Z"
              fill="#d4a84a" stroke="#8b6914" strokeWidth="1" strokeLinejoin="round"/>
        <circle cx="46" cy="28" r="1.3" fill="#8b6914"/>
        <circle cx="54" cy="24" r="1.5" fill="#8b6914"/>
        <circle cx="66" cy="24" r="1.5" fill="#8b6914"/>
        <circle cx="74" cy="28" r="1.3" fill="#8b6914"/>
        {/* Charge — fleur-de-lis */}
        <path d="M60 54 Q57 50 57 47 Q57 44 60 46 Q63 44 63 47 Q63 50 60 54 Z M55 58 Q52 56 54 53 Q57 55 58 56 Z M65 58 Q68 56 66 53 Q63 55 62 56 Z"
              fill="#d4a84a" opacity="0.95"/>
        <line x1="52" y1="60" x2="68" y2="60" stroke="#d4a84a" strokeWidth="1.5"/>
        <path d="M60 62 L60 76" stroke="#d4a84a" strokeWidth="1.3"/>
      </g>
    </svg>
  </div>
);

// ─── Variant: tumbling dice ───
const DiceSpinner = () => (
  <div className="ls-dice">
    <div className="ls-die ls-die-1">
      <svg viewBox="0 0 40 40" width="56" height="56">
        <rect x="2" y="2" width="36" height="36" rx="6" fill="#fff" stroke="#8b6914" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="2.5" fill="#2a1d10"/>
        <circle cx="28" cy="12" r="2.5" fill="#2a1d10"/>
        <circle cx="20" cy="20" r="2.5" fill="#2a1d10"/>
        <circle cx="12" cy="28" r="2.5" fill="#2a1d10"/>
        <circle cx="28" cy="28" r="2.5" fill="#2a1d10"/>
      </svg>
    </div>
    <div className="ls-die ls-die-2">
      <svg viewBox="0 0 40 40" width="56" height="56">
        <rect x="2" y="2" width="36" height="36" rx="6" fill="#fff" stroke="#8b6914" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="2.5" fill="#2a1d10"/>
        <circle cx="28" cy="12" r="2.5" fill="#2a1d10"/>
        <circle cx="28" cy="28" r="2.5" fill="#2a1d10"/>
      </svg>
    </div>
  </div>
);

// ─── Variant: unrolling scroll ───
const ScrollSpinner = () => (
  <div className="ls-scroll">
    <svg viewBox="0 0 160 90" width="180" height="110">
      {/* Left roll */}
      <rect x="8" y="20" width="14" height="50" rx="7" fill="#8b6914" stroke="#4a3008" strokeWidth="1.5"/>
      <rect x="11" y="20" width="8" height="50" rx="4" fill="#b88834"/>
      {/* Right roll */}
      <rect x="138" y="20" width="14" height="50" rx="7" fill="#8b6914" stroke="#4a3008" strokeWidth="1.5"/>
      <rect x="141" y="20" width="8" height="50" rx="4" fill="#b88834"/>
      {/* Parchment */}
      <path d="M22 22 L138 22 L138 68 L22 68 Z" fill="#f7eeda" stroke="#c8b07c" strokeWidth="1"/>
      {/* Lines of text (animated) */}
      <g className="ls-scroll-lines">
        <line x1="32" y1="32" x2="128" y2="32" stroke="#6b4a2a" strokeWidth="1.2" opacity="0.6"/>
        <line x1="32" y1="38" x2="120" y2="38" stroke="#6b4a2a" strokeWidth="1.2" opacity="0.6"/>
        <line x1="32" y1="44" x2="124" y2="44" stroke="#6b4a2a" strokeWidth="1.2" opacity="0.6"/>
        <line x1="32" y1="50" x2="110" y2="50" stroke="#6b4a2a" strokeWidth="1.2" opacity="0.6"/>
        <line x1="32" y1="56" x2="116" y2="56" stroke="#6b4a2a" strokeWidth="1.2" opacity="0.6"/>
      </g>
      {/* Wax seal */}
      <g className="ls-pulse">
        <circle cx="80" cy="70" r="7" fill="#8b1a1a" stroke="#4a0e0e" strokeWidth="1"/>
        <text x="80" y="73" textAnchor="middle" fontSize="7" fill="#d4a84a" fontFamily="serif" fontWeight="700">M</text>
      </g>
    </svg>
  </div>
);

// ─── Variant: stacking coins ───
const CoinsSpinner = () => (
  <div className="ls-coins">
    {[0, 1, 2, 3, 4].map(i => (
      <div key={i} className="ls-coin" style={{ animationDelay: `${i * 0.12}s` }}>
        <svg viewBox="0 0 40 40" width="48" height="48">
          <defs>
            <radialGradient id={`coin-grad-${i}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#f5d98a"/>
              <stop offset="60%" stopColor="#d4a84a"/>
              <stop offset="100%" stopColor="#8b6914"/>
            </radialGradient>
          </defs>
          <circle cx="20" cy="20" r="17" fill={`url(#coin-grad-${i})`} stroke="#4a3008" strokeWidth="1.2"/>
          <circle cx="20" cy="20" r="13" fill="none" stroke="#8b6914" strokeWidth="0.7"/>
          <text x="20" y="25" textAnchor="middle" fontSize="13" fill="#4a3008" fontFamily="serif" fontWeight="700">◈</text>
        </svg>
      </div>
    ))}
  </div>
);

window.LoadingScreen = LoadingScreen;
