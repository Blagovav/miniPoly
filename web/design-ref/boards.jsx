// Premium game boards — 10 themed maps
// Each board has: id, name, ru, rarity, price, owned, palette, scenery (SVG background for center)
// Rarities: free, rare, epic, legendary

const BOARDS = [
  {
    id: 'eldmark',
    name: 'Eldmark Vale',
    ru: 'Эльдмарк',
    rarity: 'free',
    price: 0,
    owned: true,
    desc: { en: 'The classic realm. Rolling hills and stone keeps.', ru: 'Классическое королевство. Холмы и каменные крепости.' },
    palette: { bg: '#f0e4c8', land: '#d9c79a', line: '#8a7152', accent: '#4a2e82', water: '#8fb8c8', gold: '#b8892e' },
    tiles: { brown: '#8b5a3c', teal: '#3a7a8a', pink: '#c17aa8', orange: '#c17a3a', red: '#9a3a3a', yellow: '#c9a84a', green: '#5a8a3a', blue: '#3a5a9a' },
  },
  {
    id: 'silvermere',
    name: 'Silvermere',
    ru: 'Сильвермер',
    rarity: 'rare',
    price: 800,
    owned: true,
    desc: { en: 'The harbour kingdom. Moonlit docks and silver sails.', ru: 'Портовое королевство. Лунные доки и серебряные паруса.' },
    palette: { bg: '#e0e8ee', land: '#b8c8d4', line: '#4a6578', accent: '#2a5a8a', water: '#6a8fa8', gold: '#8a9fb0' },
    tiles: { brown: '#5a7590', teal: '#2a8a9a', pink: '#8a7aa8', orange: '#a8703a', red: '#8a3a5a', yellow: '#9a9a3a', green: '#4a7a6a', blue: '#2a4a7a' },
  },
  {
    id: 'emberhold',
    name: 'Emberhold',
    ru: 'Эмберхолд',
    rarity: 'rare',
    price: 950,
    desc: { en: 'The forge kingdom. Volcanic crags and ember-lit halls.', ru: 'Кузничное королевство. Вулканические скалы и залы огня.' },
    palette: { bg: '#2a1810', land: '#4a2a1a', line: '#8a4a2a', accent: '#d4703a', water: '#6a2a1a', gold: '#e8a03a', text: '#f0d4a0' },
    tiles: { brown: '#6a3a1a', teal: '#c04a2a', pink: '#c07a5a', orange: '#e07a3a', red: '#c03030', yellow: '#e8a83a', green: '#8a6a2a', blue: '#8a4a6a' },
    dark: true,
  },
  {
    id: 'thornwood',
    name: 'Thornwood',
    ru: 'Терновый Лес',
    rarity: 'rare',
    price: 900,
    desc: { en: 'The wild realm. Ancient oaks and fey circles.', ru: 'Дикое королевство. Древние дубы и феи в кругах.' },
    palette: { bg: '#e8e4d0', land: '#c8d4b0', line: '#4a6a3a', accent: '#2a6a3a', water: '#6a9a7a', gold: '#a8a03a' },
    tiles: { brown: '#6a4a2a', teal: '#3a8a6a', pink: '#a86a8a', orange: '#c08a3a', red: '#8a3a2a', yellow: '#b8a82a', green: '#4a7a2a', blue: '#3a5a6a' },
  },
  {
    id: 'frostpeak',
    name: 'Frostpeak',
    ru: 'Ледяной Пик',
    rarity: 'epic',
    price: 15,
    unit: '★',
    desc: { en: 'The frozen throne. Glacier ranges and aurora skies.', ru: 'Ледяной трон. Ледники и северное сияние.' },
    palette: { bg: '#eaf0f5', land: '#c8d8e4', line: '#5a7890', accent: '#5a8ab8', water: '#8ab0c8', gold: '#b8c0d0' },
    tiles: { brown: '#6a7a8a', teal: '#3aa0b0', pink: '#a8a0c8', orange: '#9a8a7a', red: '#8a5a7a', yellow: '#b8b8a0', green: '#5a8a8a', blue: '#4a7aa8' },
  },
  {
    id: 'scarletmarch',
    name: 'Scarlet March',
    ru: 'Алый Поход',
    rarity: 'epic',
    price: 18,
    unit: '★',
    desc: { en: 'The warring counties. Red banners and crossed swords.', ru: 'Воюющие графства. Алые знамёна и скрещённые мечи.' },
    palette: { bg: '#f0dcd0', land: '#d8a898', line: '#6a2a2a', accent: '#9a1c3a', water: '#a87878', gold: '#c08a2a' },
    tiles: { brown: '#7a3a2a', teal: '#8a4a4a', pink: '#b85a7a', orange: '#c0602a', red: '#a81c2a', yellow: '#c89a2a', green: '#6a7a3a', blue: '#6a3a6a' },
  },
  {
    id: 'goldensteppe',
    name: 'Golden Steppe',
    ru: 'Золотая Степь',
    rarity: 'epic',
    price: 20,
    unit: '★',
    desc: { en: 'The caravan road. Sun-baked plains and spice markets.', ru: 'Караванный путь. Выжженные равнины и базары.' },
    palette: { bg: '#f8ecc0', land: '#e8c878', line: '#8a6a2a', accent: '#d08a1a', water: '#c8a868', gold: '#e8a020' },
    tiles: { brown: '#8a5a2a', teal: '#d09a3a', pink: '#c88a5a', orange: '#e07a2a', red: '#a83a2a', yellow: '#f0b820', green: '#8a8a2a', blue: '#6a7a4a' },
  },
  {
    id: 'moonspire',
    name: 'Moonspire',
    ru: 'Лунный Шпиль',
    rarity: 'legendary',
    price: 40,
    unit: '★',
    desc: { en: 'The mage-queen\'s citadel. Stars beneath glass domes.', ru: 'Цитадель королевы-мага. Звёзды под куполами.' },
    palette: { bg: '#1a1832', land: '#2a2a4a', line: '#6a5aa0', accent: '#a878e0', water: '#4a4a7a', gold: '#d4b0e8', text: '#ead8f0' },
    tiles: { brown: '#5a4a6a', teal: '#4a90c0', pink: '#c080e0', orange: '#c07a90', red: '#a04870', yellow: '#e0c870', green: '#6a9a8a', blue: '#5a6ac0' },
    dark: true,
  },
  {
    id: 'dragonreach',
    name: 'Dragonreach',
    ru: 'Драконий Предел',
    rarity: 'legendary',
    price: 45,
    unit: '★',
    desc: { en: 'Where wyrms still wake. Molten gold and black scales.', ru: 'Где ещё просыпаются змеи. Золото и чёрная чешуя.' },
    palette: { bg: '#1a0808', land: '#2a1010', line: '#a03030', accent: '#e8a020', water: '#3a1818', gold: '#f0c040', text: '#f0d8a0' },
    tiles: { brown: '#6a2a1a', teal: '#8a2a3a', pink: '#c85070', orange: '#e06020', red: '#e02020', yellow: '#f0c020', green: '#8a6a2a', blue: '#5a2a4a' },
    dark: true,
  },
  {
    id: 'sunderhall',
    name: 'Sunderhall',
    ru: 'Разлом-Холл',
    rarity: 'legendary',
    price: 50,
    unit: '★',
    desc: { en: 'The shattered kingdom. Floating isles and arcane rifts.', ru: 'Разрушенное королевство. Летающие острова и разломы.' },
    palette: { bg: '#e8dcc0', land: '#d0b898', line: '#7a4a8a', accent: '#6a3a9a', water: '#8a8ac0', gold: '#c0a040' },
    tiles: { brown: '#7a5a3a', teal: '#4a8ac0', pink: '#c060a0', orange: '#d08a3a', red: '#a03060', yellow: '#d0b030', green: '#6a9a4a', blue: '#4a4aa0' },
    border: 'arcane',
  },
];

// Small board preview — 6×6 simplified tile grid in board's palette
function BoardPreview({ board, size = 120 }) {
  const p = board.palette;
  const t = board.tiles;
  const tileColors = [t.brown, t.teal, t.pink, t.orange, t.red, t.yellow, t.green, t.blue];
  const cells = 7; // 7x7 with center scenery

  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size, display: 'block' }}>
      {/* Board base */}
      <rect x="0" y="0" width="100" height="100" fill={p.bg} rx="3"/>
      {/* Land inside */}
      <rect x="14" y="14" width="72" height="72" fill={p.land} opacity="0.6"/>

      {/* Top row tiles */}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={'t'+i} x={i*14} y="0" width="14" height="14" fill={i === 0 || i === 6 ? p.gold : tileColors[i % tileColors.length]}
          stroke={p.line} strokeWidth="0.3"/>
      ))}
      {/* Bottom row */}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={'b'+i} x={i*14} y="86" width="14" height="14" fill={i === 0 || i === 6 ? p.gold : tileColors[(i + 3) % tileColors.length]}
          stroke={p.line} strokeWidth="0.3"/>
      ))}
      {/* Left column */}
      {[1,2,3,4,5].map(i => (
        <rect key={'l'+i} x="0" y={i*14} width="14" height="14" fill={tileColors[(i+2) % tileColors.length]}
          stroke={p.line} strokeWidth="0.3"/>
      ))}
      {/* Right column */}
      {[1,2,3,4,5].map(i => (
        <rect key={'r'+i} x="86" y={i*14} width="14" height="14" fill={tileColors[(i+5) % tileColors.length]}
          stroke={p.line} strokeWidth="0.3"/>
      ))}

      {/* Center scenery — theme-specific */}
      <BoardScenery board={board}/>
    </svg>
  );
}

// Center emblem per theme
function BoardScenery({ board }) {
  const { id, palette: p } = board;
  // Common: crown/sigil — but different per theme
  if (id === 'eldmark') {
    return (
      <g>
        <path d="M 35 58 L 40 45 L 50 52 L 60 45 L 65 58 Z" fill={p.gold} stroke={p.line} strokeWidth="0.4"/>
        <circle cx="50" cy="52" r="1.5" fill={p.accent}/>
        <text x="50" y="42" textAnchor="middle" fontSize="5" fill={p.line} fontFamily="serif" fontWeight="700">M</text>
      </g>
    );
  }
  if (id === 'silvermere') {
    return (
      <g>
        {/* Ship */}
        <path d="M 32 62 L 68 62 L 64 68 L 36 68 Z" fill={p.accent}/>
        <line x1="50" y1="40" x2="50" y2="62" stroke={p.line} strokeWidth="0.6"/>
        <path d="M 50 42 L 62 52 L 50 54 Z" fill={p.gold}/>
        <path d="M 50 44 L 40 54 L 50 56 Z" fill={p.gold} opacity="0.7"/>
      </g>
    );
  }
  if (id === 'emberhold') {
    return (
      <g>
        {/* Volcano */}
        <path d="M 28 68 L 42 40 L 58 40 L 72 68 Z" fill={p.line}/>
        <path d="M 42 40 Q 50 32 58 40" fill={p.accent}/>
        <circle cx="50" cy="38" r="2" fill={p.gold}/>
        <path d="M 46 42 L 44 48 M 50 42 L 50 50 M 54 42 L 56 48" stroke={p.gold} strokeWidth="0.6" opacity="0.8"/>
      </g>
    );
  }
  if (id === 'thornwood') {
    return (
      <g>
        {/* Tree */}
        <rect x="48" y="58" width="4" height="10" fill={p.line}/>
        <circle cx="50" cy="50" r="10" fill={p.accent}/>
        <circle cx="44" cy="46" r="5" fill={p.accent} opacity="0.8"/>
        <circle cx="56" cy="48" r="6" fill={p.accent} opacity="0.9"/>
      </g>
    );
  }
  if (id === 'frostpeak') {
    return (
      <g>
        {/* Peaks */}
        <path d="M 28 68 L 40 42 L 48 52 L 58 38 L 72 68 Z" fill={p.accent}/>
        <path d="M 34 56 L 40 42 L 45 50 M 52 48 L 58 38 L 63 50" stroke="#f7f7ff" strokeWidth="0.5" fill="none"/>
        {/* Snowflake */}
        <g transform="translate(50, 35)" stroke={p.line} strokeWidth="0.4" fill="none">
          <line x1="-4" y1="0" x2="4" y2="0"/>
          <line x1="0" y1="-4" x2="0" y2="4"/>
          <line x1="-3" y1="-3" x2="3" y2="3"/>
          <line x1="-3" y1="3" x2="3" y2="-3"/>
        </g>
      </g>
    );
  }
  if (id === 'scarletmarch') {
    return (
      <g>
        {/* Crossed swords */}
        <g transform="translate(50, 50)">
          <line x1="-12" y1="-12" x2="12" y2="12" stroke={p.line} strokeWidth="1.2"/>
          <line x1="12" y1="-12" x2="-12" y2="12" stroke={p.line} strokeWidth="1.2"/>
          <rect x="-2" y="-14" width="4" height="4" fill={p.gold} transform="rotate(45)"/>
          <rect x="-2" y="-14" width="4" height="4" fill={p.gold} transform="rotate(-45)"/>
          <circle cx="0" cy="0" r="3" fill={p.accent}/>
        </g>
      </g>
    );
  }
  if (id === 'goldensteppe') {
    return (
      <g>
        {/* Sun + caravan */}
        <circle cx="50" cy="42" r="7" fill={p.accent}/>
        {[0,45,90,135,180,225,270,315].map(a => {
          const rx = Math.cos(a * Math.PI/180) * 11;
          const ry = Math.sin(a * Math.PI/180) * 11;
          const rx2 = Math.cos(a * Math.PI/180) * 15;
          const ry2 = Math.sin(a * Math.PI/180) * 15;
          return <line key={a} x1={50+rx} y1={42+ry} x2={50+rx2} y2={42+ry2} stroke={p.accent} strokeWidth="0.8"/>;
        })}
        <path d="M 30 62 Q 36 56 42 62 Q 48 58 54 62 Q 60 56 66 62 Q 70 64 70 66 L 30 66 Z" fill={p.line}/>
      </g>
    );
  }
  if (id === 'moonspire') {
    return (
      <g>
        {/* Spire + moon */}
        <circle cx="50" cy="40" r="6" fill={p.gold}/>
        <circle cx="53" cy="38" r="5" fill={p.bg}/>
        <path d="M 46 68 L 48 50 L 50 44 L 52 50 L 54 68 Z" fill={p.accent}/>
        <circle cx="50" cy="45" r="1" fill={p.gold}/>
        {/* Stars */}
        <circle cx="30" cy="44" r="0.8" fill={p.gold}/>
        <circle cx="70" cy="50" r="0.6" fill={p.gold}/>
        <circle cx="38" cy="55" r="0.7" fill={p.gold}/>
      </g>
    );
  }
  if (id === 'dragonreach') {
    return (
      <g>
        {/* Dragon curled */}
        <path d="M 30 55 Q 30 40 50 40 Q 68 40 68 55 Q 68 66 52 66 Q 38 66 38 58 Q 38 52 48 52 Q 56 52 56 58"
          fill="none" stroke={p.accent} strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="30" cy="55" r="2" fill={p.gold}/>
        <circle cx="29" cy="54" r="0.6" fill="#000"/>
        {/* Hoard */}
        <circle cx="46" cy="66" r="1.5" fill={p.gold}/>
        <circle cx="50" cy="66" r="1.5" fill={p.gold}/>
        <circle cx="54" cy="66" r="1.5" fill={p.gold}/>
      </g>
    );
  }
  if (id === 'sunderhall') {
    return (
      <g>
        {/* Floating islands + rift */}
        <g>
          <ellipse cx="40" cy="48" rx="8" ry="3" fill={p.land}/>
          <rect x="38" y="44" width="4" height="4" fill={p.accent}/>
        </g>
        <g>
          <ellipse cx="60" cy="54" rx="10" ry="3" fill={p.land}/>
          <path d="M 57 48 L 60 42 L 63 48" fill={p.gold}/>
        </g>
        {/* Rift */}
        <path d="M 32 60 Q 40 56 48 60 Q 56 64 64 60 Q 68 58 72 62"
          stroke={p.accent} strokeWidth="0.8" fill="none" strokeDasharray="1 1.5"/>
      </g>
    );
  }
  // fallback
  return <circle cx="50" cy="50" r="6" fill={p.gold}/>;
}

const RARITY_META = {
  free:      { en: 'Included',  ru: 'Включено',  color: 'var(--ink-3)' },
  rare:      { en: 'Rare',      ru: 'Редкая',    color: 'var(--primary)' },
  epic:      { en: 'Epic',      ru: 'Эпическая', color: '#9a3aa3' },
  legendary: { en: 'Legendary', ru: 'Легенда',   color: 'var(--gold)' },
};

window.BOARDS = BOARDS;
window.BoardPreview = BoardPreview;
window.BoardScenery = BoardScenery;
window.RARITY_META = RARITY_META;
