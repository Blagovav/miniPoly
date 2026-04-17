// Home, Rooms, Create, Shop, Friends screens

const HomeScreen = ({ go, lang }) => {
  const L = lang === 'RU' ? {
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
  };

  return (
    <>
      <div className="topbar">
        <div className="avatar-btn">R</div>
        <div className="title">
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: 22, letterSpacing: '0.08em' }}>MINI · POLY</h1>
          <div className="sub">{L.sub}</div>
        </div>
        <button className="icon-btn"><Icon name="bell" size={18}/></button>
        <button className="icon-btn"><Icon name="globe" size={18}/></button>
      </div>

      <div className="content">
        {/* Hero banner */}
        <div style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--line)',
          background:
            'radial-gradient(ellipse at 80% 20%, rgba(184, 137, 46, 0.25) 0%, transparent 50%), linear-gradient(140deg, #4a2e82 0%, #2d1a5a 100%)',
          padding: '14px 14px 12px',
          color: '#f0e4c8',
          marginBottom: 10,
        }}>
          {/* Decorative crown */}
          <svg viewBox="0 0 80 40" style={{ position: 'absolute', right: 10, top: 8, width: 56, opacity: 0.35 }}>
            <path d="M5 30 L12 10 L25 22 L40 5 L55 22 L68 10 L75 30 Z" fill="#d4a84a"/>
            <circle cx="12" cy="10" r="2" fill="#d4a84a"/>
            <circle cx="40" cy="5" r="2" fill="#d4a84a"/>
            <circle cx="68" cy="10" r="2" fill="#d4a84a"/>
          </svg>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#d4a84a', textTransform: 'uppercase' }}>Anno MMXXVI</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 2, color: '#f7eeda' }}>{L.hero}</div>
          <div style={{ fontSize: 11, color: '#c9b88e', marginTop: 2, lineHeight: 1.3 }}>
            {lang === 'RU' ? 'Ваша свита ждёт приказаний.' : 'Your retinue awaits your command.'}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ background: 'linear-gradient(180deg, #d4a84a 0%, #b8892e 100%)', color: '#2a1d10', flex: 1, padding: '10px' }} onClick={() => go('game')}>
              <Icon name="dice" size={16} color="#2a1d10"/>
              {L.play}
            </button>
            <button className="btn btn-ghost" style={{ background: 'rgba(247, 238, 218, 0.12)', color: '#f7eeda', border: '1px solid rgba(212, 168, 74, 0.4)', padding: '10px 14px' }} onClick={() => go('create')}>
              <Icon name="plus" size={16} color="#f7eeda"/>
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <HomeTile icon="users" title={lang==='RU' ? 'Таверна' : 'The Tavern'} sub={lang==='RU' ? 'Найти игру' : 'Find a game'} onClick={() => go('rooms')}/>
          <HomeTile icon="scroll" title={lang==='RU' ? 'Писарь' : 'Scribe'} sub={lang==='RU' ? 'Новая комната' : 'New room'} onClick={() => go('create')}/>
          <HomeTile icon="bag" title={L.shop} sub={L.shopSub} onClick={() => go('shop')}/>
          <HomeTile icon="shield" title={L.friends} sub={L.friendsSub} onClick={() => go('friends')}/>
        </div>

        {/* Last game */}
        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {lang==='RU' ? 'Последняя игра' : 'Recent match'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}>+ 1 240 ◈</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Sigil name="Eldmark" color={PLAYER_COLORS.you} size={32}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>Eldmark Vale</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>4 players · 28 rounds · won</div>
            </div>
            <div style={{
              padding: '3px 9px',
              border: '1px solid var(--gold)',
              borderRadius: 999,
              color: 'var(--gold)',
              fontSize: 10,
              fontFamily: 'var(--font-title)',
              letterSpacing: '0.12em',
            }}>
              1st
            </div>
          </div>
        </div>

        {/* Friends playing */}
        <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          {lang==='RU' ? 'Союзники в игре' : 'Allies in play'}
        </div>
        <div className="rail" style={{ paddingBottom: 4 }}>
          {[
            { n: 'Elara', c: PLAYER_COLORS.elara, s: 'Playing' },
            { n: 'Magnus', c: PLAYER_COLORS.magnus, s: 'Online' },
            { n: 'Finn', c: PLAYER_COLORS.finn, s: 'Lobby' },
            { n: 'Oren', c: PLAYER_COLORS.oren, s: 'Idle' },
            { n: 'Lady', c: PLAYER_COLORS.lady, s: 'Online' },
          ].map(f => (
            <div key={f.n} style={{ textAlign: 'center', width: 64, flexShrink: 0 }}>
              <div style={{ position: 'relative', width: 44, height: 44, margin: '0 auto' }}>
                <Sigil name={f.n} color={f.c} size={44}/>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 11, height: 11, borderRadius: '50%',
                  background: f.s === 'Playing' ? 'var(--emerald)' : f.s === 'Online' ? 'var(--gold)' : 'var(--ink-4)',
                  border: '2px solid var(--bg)',
                }}/>
              </div>
              <div style={{
                fontSize: 11, marginTop: 6, color: 'var(--ink)',
                fontFamily: 'var(--font-display)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>{f.n}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

const HomeTile = ({ icon, title, sub, onClick }) => (
  <button onClick={onClick} style={{
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 10,
    padding: '14px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    color: 'var(--ink)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 78,
  }}>
    <div style={{
      width: 32, height: 32,
      borderRadius: 8,
      background: 'rgba(90, 58, 154, 0.1)',
      color: 'var(--primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={17} color="var(--primary)"/>
    </div>
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{sub}</div>
    </div>
  </button>
);

// ─── Rooms / Tavern ───
const RoomsScreen = ({ go, lang }) => {
  const rooms = [
    { code: 'ELDRIC', host: 'Magnus', color: PLAYER_COLORS.magnus, players: 3, cap: 4, bet: 500 },
    { code: 'DUNHOLM', host: 'Lady Cyne', color: PLAYER_COLORS.lady, players: 2, cap: 6, bet: 1000 },
    { code: 'RAVENSH', host: 'Finn', color: PLAYER_COLORS.finn, players: 4, cap: 4, bet: 250, live: true },
    { code: 'VALEBRK', host: 'Mariya', color: PLAYER_COLORS.elara, players: 1, cap: 4, bet: 100 },
  ];
  return (
    <>
      <TopBar
        onBack={() => go('home')}
        title={lang === 'RU' ? 'Таверна' : 'The Tavern'}
        subtitle={lang === 'RU' ? 'Открытые столы · 4' : 'Open tables · 4'}
      />
      <div className="content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div className="card" style={{ flex: 1, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="search" size={16} color="var(--ink-3)"/>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              {lang === 'RU' ? 'Введите код…' : 'Enter code…'}
            </div>
          </div>
          <button className="btn btn-primary" style={{ padding: '10px 16px' }}>
            {lang === 'RU' ? 'Создать' : 'Create'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[lang==='RU'?'Все':'All', lang==='RU'?'Публичные':'Public', lang==='RU'?'Друзья':'Friends', lang==='RU'?'Ставка':'Stakes'].map((f, i) => (
            <button key={i} style={{
              padding: '6px 12px',
              background: i === 0 ? 'var(--primary)' : 'transparent',
              color: i === 0 ? '#fff' : 'var(--ink-2)',
              border: i === 0 ? 'none' : '1px solid var(--line)',
              borderRadius: 999,
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              cursor: 'pointer',
            }}>{f}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rooms.map(r => (
            <button key={r.code} onClick={() => go('lobby')} style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '12px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontFamily: 'var(--font-body)',
              color: 'var(--ink)',
            }}>
              <Sigil name={r.host} color={r.color} size={40}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)', letterSpacing: '0.05em' }}>
                    {r.code}
                  </div>
                  {r.live && (
                    <div style={{
                      padding: '2px 6px',
                      background: 'rgba(139, 26, 26, 0.12)',
                      color: 'var(--accent)',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      borderRadius: 3,
                    }}>LIVE</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  {lang === 'RU' ? 'Хозяин' : 'Host'} · {r.host} · {r.bet}◈ {lang === 'RU' ? 'ставка' : 'stake'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink)' }}>
                  {r.players}/{r.cap}
                </div>
                <div style={{ display: 'flex', gap: 2, marginTop: 4, justifyContent: 'flex-end' }}>
                  {Array.from({ length: r.cap }).map((_, i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: i < r.players ? 'var(--emerald)' : 'var(--line-strong)',
                    }}/>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

// ─── Create ───
const CreateScreen = ({ go, lang, openModal, selectedBoard }) => {
  const [players, setPlayers] = React.useState(4);
  const [isPrivate, setPrivate] = React.useState(false);
  const [name, setName] = React.useState('Dunholm Keep');

  return (
    <>
      <TopBar
        onBack={() => go('home')}
        title={lang === 'RU' ? 'Новая комната' : 'New Room'}
        subtitle={lang === 'RU' ? 'Палата писаря' : "Scribe's Chamber"}
      />
      <div className="content">
        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
            {lang==='RU'?'Название':'Realm name'}
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              color: 'var(--ink)',
              marginTop: 6,
              outline: 'none',
            }}
          />
        </div>

        {/* Private / Public */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
            {lang==='RU'?'Доступ':'Access'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            <button onClick={() => setPrivate(false)} style={accessBtn(!isPrivate)}>
              <Icon name="unlock" size={16} color={!isPrivate ? '#fff' : 'var(--ink-2)'}/>
              {lang==='RU'?'Публичная':'Public'}
            </button>
            <button onClick={() => setPrivate(true)} style={accessBtn(isPrivate)}>
              <Icon name="lock" size={16} color={isPrivate ? '#fff' : 'var(--ink-2)'}/>
              {lang==='RU'?'Приватная':'Private'}
            </button>
          </div>
        </div>

        {/* Player count */}
        <div style={{ marginBottom: 14 }}>
          <div className="row between">
            <label style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
              {lang==='RU'?'Игроков':'Players'}
            </label>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--primary)' }}>{players}</div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            {[2,3,4,5,6].map(n => (
              <button key={n} onClick={() => setPlayers(n)} style={{
                flex: 1,
                padding: '12px 0',
                background: players === n ? 'var(--primary)' : 'var(--card)',
                color: players === n ? '#fff' : 'var(--ink)',
                border: `1px solid ${players === n ? 'var(--primary)' : 'var(--line)'}`,
                borderRadius: 8,
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                cursor: 'pointer',
              }}>{n}</button>
            ))}
          </div>
        </div>

        {/* Map selection — creator-editable */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
            {lang==='RU'?'Карта':'Map'}
          </label>
          <div style={{ marginTop: 6 }}>
            <MapPickRow
              boardId={selectedBoard || 'eldmark'}
              onOpen={() => openModal && openModal('boardpick')}
              lang={lang}
              editable={true}
            />
          </div>
        </div>

        {/* Rules */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
            {lang==='RU'?'Правила':'Rules'}
          </label>
          <div className="card" style={{ marginTop: 6, padding: 0 }}>
            {[
              { k: lang==='RU'?'Стартовый капитал':'Starting cash', v: '◈ 1 500' },
              { k: lang==='RU'?'Аукционы':'Auctions', v: lang==='RU'?'Вкл':'On' },
              { k: lang==='RU'?'Скорость':'Pace', v: lang==='RU'?'Обычная':'Normal' },
              { k: lang==='RU'?'Ставка':'Entry', v: '◈ 100' },
            ].map((r, i, a) => (
              <div key={r.k} style={{
                padding: '12px 14px',
                borderBottom: i === a.length - 1 ? 'none' : '1px solid var(--divider)',
                display: 'flex', justifyContent: 'space-between',
                fontSize: 13, color: 'var(--ink)',
              }}>
                <span>{r.k}</span>
                <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', padding: '14px 20px', fontSize: 15 }} onClick={() => go('lobby')}>
          <Icon name="check" size={16} color="#fff"/>
          {lang === 'RU' ? 'Созвать совет' : 'Open the Hall'}
        </button>
      </div>
    </>
  );
};

const accessBtn = (active) => ({
  padding: '12px',
  background: active ? 'var(--primary)' : 'var(--card)',
  color: active ? '#fff' : 'var(--ink)',
  border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
  borderRadius: 8,
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
});

// ─── Shop ───
const ShopScreen = ({ go, lang, openModal }) => {
  const [tab, setTab] = React.useState('tokens');
  const BALANCES = { '◈': 1250, '★': 42 };
  const handleBuy = (item, kind) => {
    if (!openModal) return;
    const unit = item.unit || '◈';
    const balance = BALANCES[unit] || 0;
    const enough = balance >= item.price;
    const data = {
      id: item.id,
      name: item.name,
      ru: item.ru || item.name,
      price: item.price,
      unit,
      kind,
      balance,
      reason: enough ? undefined : 'funds',
    };
    openModal(enough ? 'purchase-ok' : 'purchase-fail', data);
  };
  const tabs = [
    { id: 'tokens', label: lang==='RU'?'Фишки':'Tokens' },
    { id: 'maps', label: lang==='RU'?'Карты':'Maps' },
    { id: 'themes', label: lang==='RU'?'Цвета дома':'Houses' },
    { id: 'banners', label: lang==='RU'?'Знамёна':'Banners' },
    { id: 'dice', label: lang==='RU'?'Кости':'Dice' },
  ];
  const items = {
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
  };
  const rarityStyles = {
    common: { color: 'var(--ink-3)', label: lang==='RU'?'Обычная':'Common' },
    rare: { color: 'var(--primary)', label: lang==='RU'?'Редкая':'Rare' },
    epic: { color: '#9a3aa3', label: lang==='RU'?'Эпическая':'Epic' },
    legendary: { color: 'var(--gold)', label: lang==='RU'?'Легенда':'Legendary' },
  };
  const list = items[tab] || [];

  return (
    <>
      <TopBar
        onBack={() => go('home')}
        title={lang==='RU'?'Ярмарка':'The Bazaar'}
        right={
          <div className="row gap-6" style={{
            padding: '6px 10px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 999,
          }}>
            <Icon name="coin" size={14} color="var(--gold)"/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>1 250</span>
            <span style={{ color: 'var(--line-strong)' }}>·</span>
            <Icon name="star" size={13} color="var(--gold)"/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>42</span>
          </div>
        }
      />
      <div className="content">
        <div style={{
          display: 'flex',
          gap: 4,
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 3,
          marginBottom: 14,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 4px 12px -4px rgba(42, 29, 16, 0.15)',
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1,
              padding: '8px 4px',
              background: tab === t.id ? 'var(--primary)' : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--ink-2)',
              border: 'none',
              borderRadius: 6,
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {tab === 'maps' ? BOARDS.map(b => {
            const meta = RARITY_META[b.rarity];
            return (
              <div key={b.id} style={{
                background: 'var(--card)',
                border: b.rarity === 'legendary' ? '1px solid var(--gold)' : '1px solid var(--line)',
                borderRadius: 10,
                padding: 10,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {b.owned && (
                  <div style={{
                    position: 'absolute', top: 6, left: 6, zIndex: 2,
                    fontSize: 9, padding: '2px 6px',
                    background: 'var(--emerald)', color: '#fff',
                    borderRadius: 3, letterSpacing: '0.1em', fontWeight: 700,
                  }}>✓ OWNED</div>
                )}
                {b.rarity === 'legendary' && !b.owned && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 2,
                    fontSize: 9, padding: '2px 5px', background: 'var(--gold)',
                    color: '#fff', borderRadius: 3, letterSpacing: '0.1em', fontWeight: 700,
                  }}>★ PRO</div>
                )}
                <div style={{
                  borderRadius: 8, overflow: 'hidden',
                  border: `2px solid ${b.palette.gold}`,
                  marginBottom: 10,
                  boxShadow: b.rarity === 'legendary' ? '0 0 12px rgba(212,168,74,0.25)' : 'none',
                }}>
                  <BoardPreview board={b} size={140}/>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.15 }}>
                  {lang==='RU' ? b.ru : b.name}
                </div>
                <div style={{
                  fontSize: 9, color: meta.color,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontWeight: 700, marginTop: 2,
                }}>
                  {meta[lang === 'RU' ? 'ru' : 'en']}
                </div>
                <div className="row between" style={{ marginTop: 8 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: b.rarity === 'legendary' || b.rarity === 'epic' ? 'var(--gold)' : 'var(--ink-2)',
                    fontWeight: 600,
                  }}>
                    {b.owned ? '—' : (b.unit === '★' ? `★ ${b.price}` : `◈ ${b.price}`)}
                  </div>
                  <button disabled={b.owned} style={{
                    padding: '5px 11px', fontSize: 11, border: 'none',
                    background: b.owned ? 'var(--bg-deep)' : ((b.rarity === 'legendary' || b.rarity === 'epic') ? 'var(--gold)' : 'var(--primary)'),
                    color: b.owned ? 'var(--ink-3)' : '#fff',
                    borderRadius: 999,
                    cursor: b.owned ? 'default' : 'pointer',
                    fontFamily: 'var(--font-body)', fontWeight: 600,
                  }}>
                    {b.owned ? (lang==='RU'?'В игре':'Owned') : (lang==='RU'?'Купить':'Buy')}
                  </button>
                </div>
              </div>
            );
          }) : list.map(item => {
            const rarity = rarityStyles[item.rarity || 'common'];
            const isToken = tab === 'tokens';
            return (
              <div key={item.name} style={{
                background: 'var(--card)',
                border: item.premium ? '1px solid var(--gold)' : '1px solid var(--line)',
                borderRadius: 10,
                padding: 12,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {item.owned && (
                  <div style={{
                    position: 'absolute', top: 6, left: 6, zIndex: 2,
                    fontSize: 9, padding: '2px 6px',
                    background: 'var(--emerald)', color: '#fff',
                    borderRadius: 3, letterSpacing: '0.1em', fontWeight: 700,
                  }}>✓ OWNED</div>
                )}
                {item.premium && !item.owned && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 2,
                    fontSize: 9, padding: '2px 5px', background: 'var(--gold)',
                    color: '#fff', borderRadius: 3, letterSpacing: '0.1em', fontWeight: 700,
                  }}>★ PRO</div>
                )}

                {/* Preview */}
                {isToken ? (
                  <div style={{
                    height: 86,
                    background: item.premium
                      ? 'radial-gradient(circle at 50% 40%, #3a2d0e, #1a130d)'
                      : 'linear-gradient(145deg, var(--card-alt), var(--bg-deep))',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 10,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: 58, height: 58, borderRadius: '50%',
                      background: item.premium
                        ? `radial-gradient(circle at 32% 28%, #f5d98a, #d4a84a 55%, #8b6914)`
                        : `radial-gradient(circle at 32% 28%, ${lighten(PLAYER_COLORS.you, 0.45)}, ${PLAYER_COLORS.you} 60%, ${lighten(PLAYER_COLORS.you, -0.25)})`,
                      boxShadow: item.premium
                        ? '0 0 0 2px #fff, 0 0 14px rgba(212,168,74,0.55), 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.5)'
                        : '0 0 0 2px #fff, 0 3px 6px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <TokenArt id={item.id} size={42} color="#fff" shadow="rgba(0,0,0,0.55)"/>
                    </div>
                    {item.premium && (
                      <>
                        <div style={{ position: 'absolute', top: 8, left: 12, width: 3, height: 3, borderRadius: '50%', background: '#d4a84a', opacity: 0.7 }}/>
                        <div style={{ position: 'absolute', top: 18, right: 16, width: 2, height: 2, borderRadius: '50%', background: '#f5d98a', opacity: 0.6 }}/>
                        <div style={{ position: 'absolute', bottom: 14, left: 20, width: 2, height: 2, borderRadius: '50%', background: '#d4a84a', opacity: 0.5 }}/>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{
                    height: 68,
                    background: item.color
                      ? `linear-gradient(135deg, ${item.color}, ${lighten(item.color, 0.2)})`
                      : 'linear-gradient(135deg, var(--bg-deep), var(--card-alt))',
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 34,
                    color: item.color ? '#fff' : 'var(--ink-2)',
                    fontFamily: 'var(--font-display)',
                    marginBottom: 10,
                    border: '1px solid var(--line)',
                  }}>
                    {item.icon}
                  </div>
                )}

                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)' }}>
                  {lang==='RU' && item.ru ? item.ru : item.name}
                </div>
                <div style={{
                  fontSize: 9,
                  color: rarity.color,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginTop: 2,
                }}>
                  {rarity.label}
                </div>
                <div className="row between" style={{ marginTop: 8 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: item.premium ? 'var(--gold)' : 'var(--ink-2)',
                    fontWeight: 600,
                  }}>
                    {item.owned ? '—' : `${item.unit || '◈'} ${item.price}`}
                  </div>
                  <button disabled={item.owned} style={{
                    padding: '5px 11px', fontSize: 11, border: 'none',
                    background: item.owned ? 'var(--bg-deep)' : (item.premium ? 'var(--gold)' : 'var(--primary)'),
                    color: item.owned ? 'var(--ink-3)' : '#fff',
                    borderRadius: 999,
                    cursor: item.owned ? 'default' : 'pointer',
                    fontFamily: 'var(--font-body)', fontWeight: 600,
                  }}>
                    {item.owned ? (lang==='RU'?'В игре':'Equipped') : (lang==='RU'?'Купить':'Buy')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// ─── Friends ───
const FriendsScreen = ({ go, lang }) => {
  const friends = [
    { n: 'Elara', c: PLAYER_COLORS.elara, w: 62, g: 142, status: 'playing' },
    { n: 'Magnus', c: PLAYER_COLORS.magnus, w: 58, g: 88, status: 'online' },
    { n: 'Lady Cyne', c: PLAYER_COLORS.lady, w: 71, g: 55, status: 'online' },
    { n: 'Finn', c: PLAYER_COLORS.finn, w: 44, g: 31, status: 'offline' },
    { n: 'Oren', c: PLAYER_COLORS.oren, w: 52, g: 27, status: 'online' },
  ];
  return (
    <>
      <TopBar
        onBack={() => go('home')}
        title={lang==='RU'?'Союзники':'Allies'}
        subtitle={lang==='RU'?'Книга побратимов':'Book of Brethren'}
      />
      <div className="content">
        {/* My stats */}
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <Sigil name="R" color={PLAYER_COLORS.you} size={48}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>Lord Roderick</div>
              <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>Baron · Rank 412</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <ShieldStat label={lang==='RU'?'Игр':'Games'} value="108"/>
            <ShieldStat label={lang==='RU'?'Побед':'Wins'} value="61" accent="var(--emerald)"/>
            <ShieldStat label="Winrate" value="56%" accent="var(--gold)"/>
          </div>
        </div>

        <Fleuron text={lang==='RU'?'Соратники':'Comrades'}/>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {friends.map(f => (
            <div key={f.n} className="row" style={{
              padding: '10px 12px',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              gap: 12,
            }}>
              <div style={{ position: 'relative' }}>
                <Sigil name={f.n} color={f.c} size={36}/>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 10, height: 10, borderRadius: '50%',
                  background: f.status === 'playing' ? 'var(--emerald)' : f.status === 'online' ? 'var(--gold)' : 'var(--ink-4)',
                  border: '2px solid var(--card)',
                }}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)' }}>{f.n}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{f.g} games · {f.w}% wr</div>
              </div>
              {f.status === 'playing' ? (
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>
                  {lang==='RU'?'Присоединиться':'Join'}
                </button>
              ) : (
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
                  {lang==='RU'?'Позвать':'Invite'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

Object.assign(window, { HomeScreen, RoomsScreen, CreateScreen, ShopScreen, FriendsScreen });
