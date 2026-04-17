// Modals: Deed, Profile, Trade, Decree, Chat, Coronation

const DeedModal = ({ onClose, lang, data }) => {
  const tile = data?.tile || { name: 'Weaver Lane', price: 200, g: 'teal', ru: 'Переулок' };
  const group = GROUP_COLORS[tile.g || 'teal'];
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ borderTopColor: group }}>
        <div style={{ width: 40, height: 4, background: 'var(--line-strong)', borderRadius: 2, margin: '-4px auto 14px' }}/>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            {lang==='RU'?'Грамота на владение':'Deed of Title'}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginTop: 2 }}>
            {tile.name}
          </div>
          <div style={{
            display: 'inline-block', marginTop: 6,
            padding: '3px 14px', background: group, color: '#fff',
            fontSize: 10, letterSpacing: '0.2em', fontFamily: 'var(--font-title)',
            borderRadius: 3,
          }}>
            {(tile.g || 'teal').toUpperCase()} QUARTER
          </div>
        </div>

        {/* Engraving placeholder */}
        <div style={{
          height: 100,
          background: `repeating-linear-gradient(135deg, rgba(42,29,16,0.1) 0 6px, transparent 6px 12px), linear-gradient(180deg, ${group}20, var(--bg-deep))`,
          border: '1px solid var(--line)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          ※ engraving ※
        </div>

        {/* Rent table */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            {lang==='RU'?'Аренда':'Rent schedule'}
          </div>
          <div className="card" style={{ padding: 0 }}>
            {[
              [lang==='RU'?'Базовая':'Base', 16],
              ['+ 1 ⌂', 80],
              ['+ 2 ⌂', 220],
              ['+ 3 ⌂', 600],
              ['+ 4 ⌂', 800],
              [lang==='RU'?'Замок ♖':'Castle ♖', 1100],
            ].map((r, i, a) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '9px 12px',
                borderBottom: i === a.length - 1 ? 'none' : '1px solid var(--divider)',
                fontSize: 13,
              }}>
                <span style={{ color: 'var(--ink-2)' }}>{r[0]}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 600 }}>◈ {r[1]}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ textAlign: 'center', padding: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{lang==='RU'?'Цена':'Price'}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>◈ {tile.price || 200}</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{lang==='RU'?'Залог':'Mortgage'}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>◈ {Math.floor((tile.price||200)/2)}</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{lang==='RU'?'Дом':'House'}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>◈ 100</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-emerald" style={{ flex: 2 }}>{lang==='RU'?'Купить':'Buy'}</button>
          <button className="btn btn-ghost" style={{ flex: 1 }}>{lang==='RU'?'Аукцион':'Auction'}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Trade ───
const TradeModal = ({ onClose, lang }) => (
  <div className="modal-scrim" onClick={onClose} style={{ alignItems: 'flex-start' }}>
    <div className="modal-sheet-top" onClick={e => e.stopPropagation()}>
      <div style={{ width: 40, height: 4, background: 'var(--line-strong)', borderRadius: 2, margin: '0 auto 14px' }}/>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
          {lang==='RU'?'Гонец':'Messenger'}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)', marginTop: 2 }}>
          {lang==='RU'?'Предложение сделки':'A proposal arrives'}
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div className="row gap-10" style={{ marginBottom: 10 }}>
          <Sigil name="Magnus" color={PLAYER_COLORS.magnus} size={36}/>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>Lord Magnus</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{lang==='RU'?'шлёт предложение':'sends an offer'}</div>
          </div>
        </div>
        <div style={{
          fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5,
          padding: '10px 12px',
          background: 'var(--bg)',
          border: '1px dashed var(--line-strong)',
          borderRadius: 6,
        }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span>{lang==='RU'?'Он отдаёт':'He gives'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 600 }}>◈ 500</span>
          </div>
          <div className="row between">
            <span>{lang==='RU'?'Взамен просит':'He wants'}</span>
            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Weaver Lane</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-wax" style={{ flex: 1 }} onClick={onClose}>
          <Icon name="x" size={14} color="#fff"/>
          {lang==='RU'?'Отказать':'Decline'}
        </button>
        <button className="btn btn-emerald" style={{ flex: 1 }} onClick={onClose}>
          <Icon name="check" size={14} color="#fff"/>
          {lang==='RU'?'Принять':'Accept'}
        </button>
      </div>
    </div>
  </div>
);

// ─── Royal Decree (card modal) ───
const DecreeModal = ({ onClose, lang, kind = 'chance' }) => {
  const isChance = kind === 'chance';
  return (
    <div className="modal-scrim" onClick={onClose} style={{ alignItems: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(320px, 85%)',
        background: 'var(--card-alt)',
        border: `2px solid ${isChance ? 'var(--accent)' : 'var(--primary)'}`,
        borderRadius: 10,
        padding: 22,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'scrollUnfurl 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Corner flourishes */}
        {[['tl', '0 0'], ['tr', '0 100%'], ['bl', '100% 0'], ['br', '100% 100%']].map(([k, tf]) => (
          <div key={k} style={{
            position: 'absolute',
            [k[0]==='t'?'top':'bottom']: -1,
            [k[1]==='l'?'left':'right']: -1,
            width: 14, height: 14,
            borderTop: k[0]==='t' ? `2px solid ${isChance ? 'var(--accent)' : 'var(--primary)'}` : 'none',
            borderBottom: k[0]==='b' ? `2px solid ${isChance ? 'var(--accent)' : 'var(--primary)'}` : 'none',
            borderLeft: k[1]==='l' ? `2px solid ${isChance ? 'var(--accent)' : 'var(--primary)'}` : 'none',
            borderRight: k[1]==='r' ? `2px solid ${isChance ? 'var(--accent)' : 'var(--primary)'}` : 'none',
          }}/>
        ))}

        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
          {isChance ? (lang==='RU'?'Указ':'Royal Decree') : (lang==='RU'?'Сундук':'Town Chest')}
        </div>

        {/* Seal */}
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          margin: '0 auto 14px',
          background: `radial-gradient(circle at 35% 30%, ${isChance ? '#c04040' : '#8a68d0'}, ${isChance ? '#8b1a1a' : '#3e2272'})`,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
          fontFamily: 'var(--font-display)',
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.3), inset 0 -2px 3px rgba(0,0,0,0.3)',
        }}>
          {isChance ? '?' : '⎔'}
        </div>

        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 17, color: 'var(--ink)', lineHeight: 1.4,
        }}>
          {lang==='RU'?
            '«Вы избраны хранителем казны. Получите ◈ 200 от каждого лорда».':
            '"You are named keeper of the coin. Collect ◈ 200 from every lord."'}
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
          {lang==='RU'?'Принять волю короля':"As the crown wills"}
        </button>
      </div>
    </div>
  );
};

// ─── Profile ───
const ProfileModal = ({ onClose, lang }) => (
  <div className="modal-scrim" onClick={onClose}>
    <div className="modal-card" onClick={e => e.stopPropagation()}>
      <div style={{ width: 40, height: 4, background: 'var(--line-strong)', borderRadius: 2, margin: '-4px auto 14px' }}/>

      <div className="row gap-12" style={{ marginBottom: 14 }}>
        <Sigil name="E" color={PLAYER_COLORS.elara} size={56}/>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>Elara the Fox</div>
          <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>
            Countess · Rank 88
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <ShieldStat label="Games" value="142"/>
        <ShieldStat label="Wins" value="88" accent="var(--emerald)"/>
        <ShieldStat label="Winrate" value="62%" accent="var(--gold)"/>
      </div>

      <Fleuron text={lang==='RU'?'Владения':'Holdings'}/>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {[
          { n: 'Weaver Lane', g: 'teal', h: 2 },
          { n: 'Fortune Tower', g: 'teal', h: 1 },
          { n: "Baker's Row", g: 'pink', h: 0 },
        ].map(h => (
          <div key={h.n} className="row" style={{
            padding: '8px 10px', background: 'var(--card)',
            border: '1px solid var(--line)', borderRadius: 6, gap: 8,
          }}>
            <div style={{ width: 3, height: 20, background: GROUP_COLORS[h.g], borderRadius: 2 }}/>
            <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 13 }}>{h.n}</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{'⌂'.repeat(h.h)}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }}>
        <Icon name="send" size={14} color="#fff"/>
        {lang==='RU'?'Отправить гонца':'Send messenger'}
      </button>
    </div>
  </div>
);

// ─── Chat ───
const ChatModal = ({ onClose, lang }) => {
  const msgs = [
    { who: 'Magnus', c: PLAYER_COLORS.magnus, t: lang==='RU'?'Предлагаю сделку':'Fancy a trade?' },
    { who: 'You', c: PLAYER_COLORS.you, t: 'gg', me: true },
    { who: 'Elara', c: PLAYER_COLORS.elara, t: lang==='RU'?'Ха! Я на коне':'Ha! Fortune favors me today.' },
    { who: 'Lady', c: PLAYER_COLORS.lady, t: '⚔ ⚔ ⚔' },
  ];
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxHeight: '80%' }}>
        <div style={{ width: 40, height: 4, background: 'var(--line-strong)', borderRadius: 2, margin: '-4px auto 14px' }}/>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            {lang==='RU'?'Голубятня':'Pigeon roost'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} className="row" style={{
              gap: 8,
              justifyContent: m.me ? 'flex-end' : 'flex-start',
              flexDirection: m.me ? 'row-reverse' : 'row',
            }}>
              <Sigil name={m.who} color={m.c} size={26}/>
              <div style={{
                maxWidth: '70%',
                padding: '7px 11px',
                background: m.me ? 'var(--primary)' : 'var(--card)',
                color: m.me ? '#fff' : 'var(--ink)',
                border: m.me ? 'none' : '1px solid var(--line)',
                borderRadius: m.me ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                fontSize: 13,
              }}>
                {!m.me && <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 1 }}>{m.who}</div>}
                {m.t}
              </div>
            </div>
          ))}
        </div>

        {/* Emoji strip */}
        <div className="rail" style={{ marginBottom: 8 }}>
          {['⚔','⚜','♕','🜲','✦','⎔','♞','✵'].map(e => (
            <button key={e} style={{
              width: 34, height: 34, flexShrink: 0,
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontSize: 16,
              fontFamily: 'var(--font-display)',
              color: 'var(--ink)',
              cursor: 'pointer',
            }}>{e}</button>
          ))}
        </div>

        <div className="row gap-6">
          <input placeholder={lang==='RU'?'Написать…':'Message…'} style={{
            flex: 1, padding: '10px 12px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            fontSize: 13, color: 'var(--ink)',
            fontFamily: 'var(--font-body)', outline: 'none',
          }}/>
          <button className="btn btn-primary" style={{ padding: '10px 14px' }}>
            <Icon name="send" size={15} color="#fff"/>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Coronation ───
const CoronationModal = ({ onClose, lang }) => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 1000,
    background: 'radial-gradient(ellipse at 50% 40%, rgba(90, 58, 154, 0.9), rgba(26, 15, 5, 0.95))',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  }}>
    {/* Falling coins / petals */}
    {Array.from({ length: 24 }).map((_, i) => (
      <div key={i} style={{
        position: 'absolute',
        top: -20,
        left: `${(i * 4.3) % 100}%`,
        width: 10, height: 10,
        borderRadius: i % 3 === 0 ? '50%' : '50% 0',
        background: i % 3 === 0 ? 'var(--gold)' : i % 3 === 1 ? '#c04040' : '#b8892e',
        animation: `coinFall ${3 + (i % 5) * 0.5}s linear ${i * 0.2}s infinite`,
        opacity: 0.8,
      }}/>
    ))}

    <style>{`
      @keyframes coinFall {
        0% { transform: translateY(0) rotate(0); }
        100% { transform: translateY(800px) rotate(720deg); }
      }
    `}</style>

    <div style={{ fontSize: 11, letterSpacing: '0.3em', color: 'var(--gold)', textTransform: 'uppercase' }}>
      {lang==='RU'?'Возведение на престол':'Coronation'}
    </div>
    <div style={{
      fontFamily: 'var(--font-title)',
      fontSize: 30,
      color: '#f7eeda',
      letterSpacing: '0.05em',
      marginTop: 6,
      textAlign: 'center',
    }}>
      LORD RODERICK
    </div>

    {/* Throne SVG */}
    <svg viewBox="0 0 200 200" style={{ width: 180, margin: '14px 0' }}>
      <rect x="60" y="90" width="80" height="60" fill="#4a2e1a" stroke="#d4a84a" strokeWidth="2" rx="3"/>
      <rect x="50" y="40" width="100" height="60" fill="#5a3820" stroke="#d4a84a" strokeWidth="2" rx="4"/>
      <path d="M70 40 L80 20 L100 10 L120 20 L130 40" fill="none" stroke="#d4a84a" strokeWidth="2"/>
      <circle cx="100" cy="12" r="4" fill="#d4a84a"/>
      <rect x="55" y="140" width="10" height="40" fill="#3a2818" stroke="#d4a84a" strokeWidth="1"/>
      <rect x="135" y="140" width="10" height="40" fill="#3a2818" stroke="#d4a84a" strokeWidth="1"/>
      {/* Player sigil on throne */}
      <circle cx="100" cy="80" r="20" fill={PLAYER_COLORS.you} stroke="#d4a84a" strokeWidth="2"/>
      <text x="100" y="87" textAnchor="middle" fill="#fff" fontSize="20" fontFamily="serif">R</text>
      {/* Crown above */}
      <path d="M80 50 L84 40 L92 46 L100 34 L108 46 L116 40 L120 50 Z" fill="#d4a84a" stroke="#8b6914" strokeWidth="1"/>
    </svg>

    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: '#c9b88e', textAlign: 'center', maxWidth: 280, lineHeight: 1.4 }}>
      {lang==='RU'?
        'Королевство пало к вашим ногам. Слава и золото ваши.':
        'The realm bows at your feet. Glory and gold are yours.'}
    </div>

    <div className="row gap-8" style={{ marginTop: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--gold)' }}>◈ 4 820</div>
        <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{lang==='RU'?'Сокровища':'Treasury'}</div>
      </div>
      <div style={{ width: 1, height: 30, background: 'var(--line-strong)' }}/>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--gold)' }}>+ 120</div>
        <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{lang==='RU'?'Ранг':'Rank'}</div>
      </div>
    </div>

    <button className="btn btn-primary" style={{ marginTop: 22, padding: '12px 28px' }} onClick={onClose}>
      {lang==='RU'?'Вернуться':'Return'}
    </button>
  </div>
);

Object.assign(window, { DeedModal, TradeModal, DecreeModal, ProfileModal, ChatModal, CoronationModal });
