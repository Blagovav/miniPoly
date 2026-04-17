// Lobby + Game Board

const LobbyScreen = ({ go, lang, openModal, selectedBoard }) => {
  const players = [
    { n: 'You', c: PLAYER_COLORS.you, ready: true, host: true, me: true },
    { n: 'Elara', c: PLAYER_COLORS.elara, ready: true },
    { n: 'Magnus', c: PLAYER_COLORS.magnus, ready: false },
    { n: 'Lady Cyne', c: PLAYER_COLORS.lady, ready: true },
  ];
  const tokens = ['♞','♜','♕','⛨','🜲','✵'];
  const [token, setToken] = React.useState(0);

  return (
    <>
      <TopBar onBack={() => go('rooms')} title={lang==='RU'?'Зал совета':'Council Hall'} subtitle="DUNHOLM · 4 players"/>
      <div className="content">
        {/* Code card */}
        <div className="card" style={{ textAlign: 'center', padding: '16px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            {lang==='RU'?'Код комнаты':'Room code'}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '0.3em', color: 'var(--ink)' }}>
            DUNHOLM
          </div>
          <button style={{
            marginTop: 8, padding: '6px 12px', fontSize: 11,
            background: 'transparent', color: 'var(--primary)',
            border: '1px solid var(--primary)', borderRadius: 999,
            fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer',
          }}>
            {lang==='RU'?'Скопировать ссылку':'Copy link'}
          </button>
        </div>

        {/* Map selection — host only */}
        <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          {lang==='RU'?'Карта':'Map'}
        </div>
        <div style={{ marginBottom: 14 }}>
          <MapPickRow
            boardId={selectedBoard || 'eldmark'}
            onOpen={() => openModal && openModal('boardpick')}
            lang={lang}
            editable={true}
          />
        </div>

        {/* Players */}
        <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          {lang==='RU'?'Игроки':'At the table'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {players.map(p => (
            <div key={p.n} className="row" style={{
              background: p.me ? 'rgba(90, 58, 154, 0.06)' : 'var(--card)',
              border: `1px solid ${p.me ? 'var(--primary)' : 'var(--line)'}`,
              borderRadius: 10,
              padding: '10px 12px',
              gap: 10,
            }}>
              <Sigil name={p.n} color={p.c} size={36}/>
              <div style={{ flex: 1 }}>
                <div className="row gap-6">
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)' }}>{p.n}</span>
                  {p.host && <Icon name="crown" size={14} color="var(--gold)"/>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {p.ready ? (lang==='RU'?'Готов':'Ready') : (lang==='RU'?'Выбирает':'Choosing…')}
                </div>
              </div>
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: p.ready ? 'var(--emerald)' : 'var(--card-alt)',
                border: `1px solid ${p.ready ? 'var(--emerald)' : 'var(--line)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={p.ready ? 'check' : 'x'} size={16} color={p.ready ? '#fff' : 'var(--ink-4)'}/>
              </div>
            </div>
          ))}
          {Array.from({ length: 4 - players.length }).map((_, i) => (
            <div key={'e'+i} className="row" style={{
              background: 'transparent', border: '1px dashed var(--line-strong)',
              borderRadius: 10, padding: '10px 12px', gap: 10,
              color: 'var(--ink-4)', fontStyle: 'italic', fontSize: 13,
            }}>
              <Icon name="plus" size={18} color="var(--ink-4)"/>
              {lang==='RU'?'Пустая скамья':'Empty seat'}
            </div>
          ))}
        </div>

        {/* Token picker */}
        <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          {lang==='RU'?'Ваша фишка':'Your token'}
        </div>
        <div className="rail" style={{ marginBottom: 14 }}>
          {tokens.map((t, i) => (
            <button key={i} onClick={() => setToken(i)} style={{
              width: 56, height: 56, flexShrink: 0,
              background: token === i
                ? `linear-gradient(135deg, ${PLAYER_COLORS.you}, ${lighten(PLAYER_COLORS.you, 0.2)})`
                : 'var(--card)',
              color: token === i ? '#fff' : 'var(--ink-2)',
              border: `1px solid ${token === i ? PLAYER_COLORS.you : 'var(--line)'}`,
              borderRadius: 10,
              fontSize: 28,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>

        <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: 15 }} onClick={() => go('game')}>
          <Icon name="dice" size={16} color="#fff"/>
          {lang==='RU'?'Начать игру':'Begin the game'}
        </button>
      </div>
    </>
  );
};

// ─── Game Board ───
const TILES = [
  // Clockwise from bottom-right corner (GO)
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
  { k: 'st', name: "Apothecary", ru: 'Алхимик', price: 460, g: 'green' },
  { k: 'chest', name: 'Chest', ru: 'Сундук' },
  { k: 'st', name: 'Tanner Walk', ru: 'Ряд', price: 480, g: 'green' },
  { k: 'rail', name: 'South Gate', ru: 'Врата' },
  { k: 'chance', name: 'Decree', ru: 'Указ' },
  { k: 'st', name: 'Royal Palace', ru: 'Дворец', price: 550, g: 'blue' },
  { k: 'tax', name: 'Crown Levy', ru: 'Сбор' },
  { k: 'st', name: 'Dragon Keep', ru: 'Замок Дракона', price: 600, g: 'blue' },
];

// Position a tile at board row/col given its index 0..39 (0 = bottom-right corner going clockwise upward on right side)
const tilePosition = (idx) => {
  // 11x11: corners at (11,11), (11,1), (1,1), (1,11)
  // Right column (bottom→top): idx 0..10  -> row 11-idx (approx)
  // We'll use: 0 BR, 1..9 right col (top→btm reversed), 10 TR, 11..19 top, 20 TL, 21..29 left, 30 BL, 31..39 bottom
  if (idx === 0) return { row: 11, col: 11 };
  if (idx < 10) return { row: 11 - idx, col: 11 };
  if (idx === 10) return { row: 1, col: 11 };
  if (idx < 20) return { row: 1, col: 11 - (idx - 10) };
  if (idx === 20) return { row: 1, col: 1 };
  if (idx < 30) return { row: 1 + (idx - 20), col: 1 };
  if (idx === 30) return { row: 11, col: 1 };
  return { row: 11, col: 1 + (idx - 30) };
};

const BoardTile = ({ tile, idx, tokens, onClick }) => {
  const pos = tilePosition(idx);
  const isCorner = tile.k === 'corner';
  const group = tile.g ? GROUP_COLORS[tile.g] : null;
  // Orientation for label: right side horizontal, top rotated, left horizontal, bottom normal
  const side =
    idx > 0 && idx < 10 ? 'right' :
    idx > 10 && idx < 20 ? 'top' :
    idx > 20 && idx < 30 ? 'left' :
    idx > 30 && idx < 40 ? 'bottom' : 'corner';

  return (
    <button
      onClick={() => onClick(idx)}
      className={`board-tile ${isCorner ? 'corner' : ''}`}
      style={{
        gridColumn: pos.col,
        gridRow: pos.row,
        padding: 0,
      }}
      title={tile.name}
    >
      {/* Group stripe */}
      {group && (
        <div style={{
          position: 'absolute',
          background: group,
          ...(side === 'bottom' ? { top: 0, left: 0, right: 0, height: '20%' } :
              side === 'top' ? { bottom: 0, left: 0, right: 0, height: '20%' } :
              side === 'right' ? { left: 0, top: 0, bottom: 0, width: '20%' } :
              side === 'left' ? { right: 0, top: 0, bottom: 0, width: '20%' } : {}),
        }}/>
      )}
      <div style={{
        position: 'absolute', inset: 2,
        display: 'flex',
        flexDirection: side === 'left' || side === 'right' ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        {/* Content varies by type, keep it minimal for small size */}
        {isCorner ? (
          <div style={{ fontSize: 9, color: 'var(--ink-2)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
            {tile.name}
          </div>
        ) : tile.k === 'st' ? (
          <CornerLabel side={side} name={tile.name} price={tile.price} group={group}/>
        ) : tile.k === 'rail' ? (
          <CenterIcon side={side} icon="🏰" label={tile.name}/>
        ) : tile.k === 'util' ? (
          <CenterIcon side={side} icon={tile.name==='Well'?'◉':'✦'} label={tile.name}/>
        ) : tile.k === 'tax' ? (
          <CenterIcon side={side} icon="◈" label={tile.name}/>
        ) : tile.k === 'chance' ? (
          <CenterIcon side={side} icon="?" label={tile.name} color="var(--accent)"/>
        ) : tile.k === 'chest' ? (
          <CenterIcon side={side} icon="⎔" label={tile.name} color="var(--primary)"/>
        ) : null}
      </div>

      {/* houses / hotel indicator */}
      {tile.houses !== undefined && tile.houses > 0 && (
        <div style={{
          position: 'absolute',
          zIndex: 2,
          display: 'flex',
          gap: 1,
          ...(side === 'bottom' ? { top: '22%', left: '50%', transform: 'translateX(-50%)' } :
              side === 'top' ? { bottom: '22%', left: '50%', transform: 'translateX(-50%)' } :
              side === 'right' ? { left: '22%', top: '50%', transform: 'translate(0, -50%) rotate(-90deg)' } :
              side === 'left' ? { right: '22%', top: '50%', transform: 'translate(0, -50%) rotate(90deg)' } : {}),
        }}>
          {tile.houses === 5 ? (
            <div style={{
              width: 13, height: 9,
              background: 'linear-gradient(180deg, #8b1a1a, #5a1010)',
              borderRadius: '2px 2px 1px 1px',
              position: 'relative',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}>
              <div style={{
                position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
                width: 3, height: 3, background: '#d4a84a', borderRadius: '1px 1px 0 0',
              }}/>
            </div>
          ) : (
            Array.from({ length: tile.houses }).map((_, i) => (
              <div key={i} style={{
                width: 5, height: 6,
                background: 'linear-gradient(180deg, #2d7a4f, #1e5f3a)',
                borderRadius: '1px 1px 0 0',
                boxShadow: '0 1px 1px rgba(0,0,0,0.3)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: -2, left: 0, right: 0, height: 2,
                  background: '#1e5f3a',
                  clipPath: 'polygon(0 100%, 50% 0, 100% 100%)',
                }}/>
              </div>
            ))
          )}
        </div>
      )}

      {/* owner sigil small corner */}
      {tile.owner && (
        <div style={{
          position: 'absolute',
          top: 2, right: 2,
          width: 10, height: 10, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${lighten(tile.owner, 0.3)}, ${tile.owner})`,
          border: '1.5px solid #fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
          zIndex: 2,
        }}/>
      )}

      {/* token pieces on tile */}
      {tokens && tokens.length > 0 && (
        <div style={{
          position: 'absolute',
          ...(side === 'bottom' ? { bottom: '18%', left: 0, right: 0 } :
              side === 'top' ? { top: '18%', left: 0, right: 0 } :
              side === 'right' ? { right: '18%', top: 0, bottom: 0, flexDirection: 'column' } :
              side === 'left' ? { left: '18%', top: 0, bottom: 0, flexDirection: 'column' } :
              { inset: 0 }),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 1,
          zIndex: 4,
          pointerEvents: 'none',
        }}>
          {tokens.slice(0, 4).map((t, i) => (
            <TokenPiece key={i} token={t} idx={i} total={Math.min(tokens.length, 4)}/>
          ))}
        </div>
      )}
    </button>
  );
};

// A single piece on the board — circular enamel medal with glyph
const TokenPiece = ({ token, idx, total }) => {
  const size = total <= 1 ? 22 : total === 2 ? 18 : total === 3 ? 16 : 14;
  const offset = total > 1 ? (idx - (total - 1) / 2) * (size * 0.6) : 0;
  return (
    <div style={{
      position: 'relative',
      transform: `translate(${offset}px, ${idx % 2 === 0 ? 0 : -2}px)`,
      animation: token.active ? 'pulseSigil 1.6s ease-in-out infinite' : 'fadeIn 400ms ease-out',
    }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle at 32% 28%, ${lighten(token.color, 0.45)}, ${token.color} 55%, ${lighten(token.color, -0.3)})`,
        boxShadow: token.active
          ? `0 0 0 1.5px #fff, 0 0 0 3px var(--gold), 0 3px 6px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.4)`
          : `0 0 0 1.5px #fff, 0 1px 3px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.35)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {token.skin ? (
          <TokenArt
            id={token.skin}
            size={size * 0.88}
            color="#fff"
            shadow={`rgba(0,0,0,${token.active ? 0.55 : 0.45})`}
          />
        ) : (
          <span style={{
            color: '#fff',
            fontSize: size * 0.6,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            lineHeight: 1,
            textShadow: '0 1px 1px rgba(0,0,0,0.35)',
          }}>
            {token.initial}
          </span>
        )}
      </div>
    </div>
  );
};

const CornerLabel = ({ side, name, price, group }) => {
  const rotation = side === 'right' ? 'rotate(-90deg)' : side === 'left' ? 'rotate(90deg)' : side === 'top' ? 'rotate(180deg)' : 'none';
  return (
    <div style={{
      transform: rotation,
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '10% 4%',
    }}>
      <div style={{
        fontSize: 9,
        fontFamily: 'var(--font-display)',
        color: 'var(--ink)',
        lineHeight: 1.1,
        textAlign: 'center',
        maxHeight: '60%',
        overflow: 'hidden',
      }}>
        {name.toUpperCase().replace(' ', '\n').split('\n').map((w, i) => <div key={i}>{w}</div>)}
      </div>
      <div style={{
        fontSize: 9, color: 'var(--ink-2)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
      }}>
        ◈{price}
      </div>
    </div>
  );
};

const CenterIcon = ({ side, icon, label, color }) => {
  const rotation = side === 'right' ? 'rotate(-90deg)' : side === 'left' ? 'rotate(90deg)' : side === 'top' ? 'rotate(180deg)' : 'none';
  return (
    <div style={{
      transform: rotation,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2,
      padding: '4px 2px',
    }}>
      <div style={{
        fontSize: 16,
        color: color || 'var(--ink-2)',
        fontFamily: 'var(--font-display)',
        lineHeight: 1,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: 7,
        color: 'var(--ink-3)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  );
};

const GameScreen = ({ go, lang, openModal, playerCount = 4 }) => {
  const [activePlayer, setActive] = React.useState(0);
  const [rolling, setRolling] = React.useState(false);

  const allPlayers = [
    { n: 'You', c: PLAYER_COLORS.you, cash: 1250, me: true, skin: 'dragon', icon: '⚔' },
    { n: 'Elara', c: PLAYER_COLORS.elara, cash: 980, skin: 'phoenix', icon: '✦' },
    { n: 'Magnus', c: PLAYER_COLORS.magnus, cash: 1420, skin: 'knight', icon: '♛' },
    { n: 'Lady', c: PLAYER_COLORS.lady, cash: 650, skin: 'crown', icon: '♕' },
    { n: 'Oren', c: PLAYER_COLORS.oren, cash: 1100, skin: 'griffin', icon: '♞' },
    { n: 'Finn', c: PLAYER_COLORS.finn, cash: 820, skin: 'shield', icon: '⛨' },
  ];
  const players = allPlayers.slice(0, playerCount);
  const [positions, setPositions] = React.useState([14, 7, 23, 31, 5, 18].slice(0, playerCount));
  const compact = playerCount > 4;

  // Demo: ownership + buildings state (index → { owner, houses })
  const buildings = {
    1:  { owner: players[1]?.c, houses: 2 },   // Cooper Yard — Elara, 2 houses
    3:  { owner: players[1]?.c, houses: 1 },   // Chandler Hall — Elara
    6:  { owner: players[0]?.c, houses: 3 },   // Fortune Tower — You, 3 houses
    8:  { owner: players[0]?.c, houses: 1 },
    9:  { owner: players[0]?.c, houses: 5 },   // Northeby Rd — hotel
    13: { owner: players[2]?.c, houses: 4 },   // Baker's Row — Magnus, 4
    16: { owner: players[2]?.c, houses: 2 },
    19: { owner: players[2]?.c, houses: 2 },
    24: { owner: players[3]?.c, houses: 1 },
    27: { owner: players[4]?.c, houses: 0 },
    39: { owner: players[0]?.c, houses: 0 },
  };
  const decoratedTiles = TILES.map((t, i) => ({
    ...t,
    ...(buildings[i] || {}),
  }));

  // Map tile index → tokens on it (with glyph/icon)
  const tokensByTile = {};
  positions.forEach((p, i) => {
    if (!tokensByTile[p]) tokensByTile[p] = [];
    tokensByTile[p].push({
      color: players[i].c,
      skin: players[i].skin,
      initial: players[i].n[0].toUpperCase(),
      active: i === activePlayer,
    });
  });

  const roll = () => {
    setRolling(true);
    setTimeout(() => {
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const total = d1 + d2;
      setPositions(prev => prev.map((p, i) => i === activePlayer ? (p + total) % 40 : p));
      setRolling(false);
      window.__lastDice = [d1, d2];
    }, 600);
  };

  return (
    <>
      <TopBar
        onBack={() => go('home')}
        avatar={{ initial: 'R' }}
        title="Eldmark Vale"
        subtitle={`${lang==='RU'?'Раунд':'Round'} 14 · ${lang==='RU'?'ваш ход':'your turn'}`}
        rightInitial={true}
      />

      {/* Player pills */}
      <div className="player-pills" style={compact ? { flexWrap: 'nowrap' } : {}}>
        {players.map((p, i) => (
          <PlayerPill
            key={p.n}
            name={p.n}
            cash={p.cash}
            color={p.c}
            me={p.me}
            active={i === activePlayer}
            icon={p.icon}
            skin={p.skin}
            compact={compact}
          />
        ))}
      </div>

      {/* Board */}
      <div style={{ padding: '4px 4px 8px', position: 'relative', zIndex: 4 }}>
        <div className="board">
          {decoratedTiles.map((t, i) => (
            <BoardTile key={i} tile={t} idx={i} tokens={tokensByTile[i]} onClick={(idx) => {
              if (t.k === 'st') openModal('deed', { tile: t, idx });
            }}/>
          ))}
          <div className="board-center">
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-title)',
                fontSize: 20,
                color: 'var(--accent)',
                letterSpacing: '0.08em',
                lineHeight: 1,
              }}>
                REALM<br/>ROYALE
              </div>
              <div style={{
                fontSize: 11, color: 'var(--ink-3)',
                fontFamily: 'var(--font-display)',
                marginTop: 6, letterSpacing: '0.2em',
              }}>— ❦ —</div>
            </div>

            {/* Stylized book stacks */}
            <div style={{
              position: 'absolute',
              top: '18%', right: '14%',
              width: 34, height: 24,
              background: 'linear-gradient(135deg, #8b1a1a, #6a1212)',
              borderRadius: 2,
              transform: 'rotate(-12deg)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
              border: '1px solid #4a0e0e',
            }}>
              <div style={{ position: 'absolute', inset: '4px 4px 4px 7px', border: '1px solid rgba(212, 168, 74, 0.5)', borderRadius: 1 }}/>
            </div>
            <div style={{
              position: 'absolute',
              bottom: '22%', left: '18%',
              width: 30, height: 22,
              background: 'linear-gradient(135deg, #3e2272, #2d1a5a)',
              borderRadius: 2,
              transform: 'rotate(14deg)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
              border: '1px solid #1a0e3a',
            }}>
              <div style={{ position: 'absolute', inset: '3px', border: '1px solid rgba(212, 168, 74, 0.5)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'rgba(212, 168, 74, 0.8)' }}>✦</div>
            </div>
          </div>
        </div>
      </div>

      {/* Event log */}
      <div className="event-log">
        <div className="ev"><b>Elara</b> {lang==='RU'?'купила Weaver Lane':'bought Weaver Lane'}</div>
        <div className="ev"><b>Magnus</b> {lang==='RU'?'выбросил 8 → Fortune Tower':'rolled 8 → Fortune Tower'}</div>
        <div className="ev"><b>{lang==='RU'?'Вы':'You'}</b> {lang==='RU'?'собрали ренту · 60':'collected rent · 60 ◈'}</div>
      </div>

      {/* Action bar */}
      <div className="action-bar">
        <div className="dice-pair">
          <Die value={(window.__lastDice || [3,4])[0]} size={34} rolling={rolling}/>
          <Die value={(window.__lastDice || [3,4])[1]} size={34} rolling={rolling}/>
        </div>
        <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
          <button className="btn btn-primary" style={{ flex: 1, padding: '12px 10px', fontSize: 13 }} onClick={roll}>
            <Icon name="dice" size={16} color="#fff"/>
            {lang==='RU'?'Бросить':'Roll Dice'}
          </button>
          <button className="btn btn-ghost" style={{ padding: '12px 10px', fontSize: 13 }} onClick={() => openModal('trade')}>
            <Icon name="trade" size={14}/>
          </button>
          <button className="btn btn-ghost" style={{ padding: '12px 10px', fontSize: 13 }}>
            {lang==='RU'?'Ход':'End'}
          </button>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { LobbyScreen, GameScreen, TILES });
