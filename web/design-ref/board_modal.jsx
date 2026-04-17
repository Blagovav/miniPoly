// Board selection modal — host picks the map for everyone

function BoardSelectModal({ onClose, lang, selectedId, onSelect, isHost }) {
  const L = lang === 'RU' ? {
    title: 'Выбор карты', sub: 'Королевство, где развернётся игра',
    apply: 'Применить', close: 'Закрыть', owned: 'В наличии', locked: 'Не куплено',
    hostOnly: 'Только хозяин может выбрать карту', price: 'Купить', active: 'Текущая',
    details: 'Детали', desc: 'Описание',
  } : {
    title: 'Choose a Map', sub: 'The realm where this contest unfolds',
    apply: 'Apply', close: 'Close', owned: 'Owned', locked: 'Locked',
    hostOnly: 'Only the host may choose the map', price: 'Buy', active: 'Active',
    details: 'Details', desc: 'Description',
  };

  const [pick, setPick] = React.useState(selectedId || 'eldmark');
  const picked = BOARDS.find(b => b.id === pick) || BOARDS[0];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg)',
        width: '100%', maxWidth: 440,
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        borderRadius: '16px 16px 0 0',
        border: '1px solid var(--line)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--divider)',
          background: 'var(--card)',
        }}>
          <div className="row between">
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink)' }}>{L.title}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{L.sub}</div>
            </div>
            <button className="icon-btn" onClick={onClose} style={{ width: 32, height: 32 }}>
              <Icon name="x" size={16}/>
            </button>
          </div>
          {!isHost && (
            <div style={{
              marginTop: 10, padding: '6px 10px',
              background: 'rgba(154, 28, 58, 0.08)',
              border: '1px solid rgba(154, 28, 58, 0.2)',
              borderRadius: 6, fontSize: 11, color: 'var(--crim)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="lock" size={12} color="var(--crim)"/>
              {L.hostOnly}
            </div>
          )}
        </div>

        {/* Featured preview of selected */}
        <div style={{
          position: 'relative',
          padding: '14px 20px',
          background: picked.palette.bg,
          color: picked.palette.text || '#2a1d10',
          borderBottom: '1px solid var(--divider)',
        }}>
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              borderRadius: 8, overflow: 'hidden',
              border: `2px solid ${picked.palette.gold}`,
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}>
              <BoardPreview board={picked} size={96}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: RARITY_META[picked.rarity].color, marginBottom: 3,
                opacity: picked.dark ? 0.85 : 0.8, fontWeight: 600,
              }}>
                {RARITY_META[picked.rarity][lang === 'RU' ? 'ru' : 'en']}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, lineHeight: 1.1 }}>
                {lang === 'RU' ? picked.ru : picked.name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6, lineHeight: 1.35 }}>
                {picked.desc[lang === 'RU' ? 'ru' : 'en']}
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {BOARDS.map(b => {
              const isActive = b.id === pick;
              const meta = RARITY_META[b.rarity];
              return (
                <button key={b.id} onClick={() => isHost && setPick(b.id)}
                  disabled={!isHost}
                  style={{
                    position: 'relative',
                    padding: 8,
                    background: isActive ? 'rgba(90, 58, 154, 0.08)' : 'var(--card)',
                    border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--line)'}`,
                    borderRadius: 10,
                    cursor: isHost ? 'pointer' : 'default',
                    textAlign: 'left',
                    opacity: isHost ? 1 : 0.6,
                  }}>
                  {/* Preview */}
                  <div style={{
                    borderRadius: 6, overflow: 'hidden',
                    border: `1px solid ${b.palette.line}`,
                    marginBottom: 7,
                    filter: b.owned ? 'none' : 'saturate(0.5) brightness(0.95)',
                  }}>
                    <BoardPreview board={b} size={120}/>
                  </div>

                  {/* Name + rarity */}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.15, marginBottom: 2 }}>
                    {lang === 'RU' ? b.ru : b.name}
                  </div>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: meta.color, fontWeight: 600,
                  }}>
                    {meta[lang === 'RU' ? 'ru' : 'en']}
                  </div>

                  {/* Badge: active / owned / locked */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      padding: '2px 7px', fontSize: 9, letterSpacing: '0.1em',
                      background: 'var(--primary)', color: '#fff',
                      borderRadius: 999, fontWeight: 700,
                    }}>{L.active}</div>
                  )}
                  {!isActive && b.owned && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--emerald)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="check" size={11} color="#fff"/>
                    </div>
                  )}
                  {!b.owned && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      padding: '3px 7px', fontSize: 10,
                      background: 'rgba(42, 29, 16, 0.85)', color: 'var(--gold)',
                      borderRadius: 999, display: 'flex', alignItems: 'center', gap: 3,
                      fontFamily: 'var(--font-mono)', fontWeight: 600,
                    }}>
                      <Icon name={b.unit === '★' ? 'star' : 'coin'} size={10} color="var(--gold)"/>
                      {b.price}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: 14,
          borderTop: '1px solid var(--divider)',
          background: 'var(--card)',
          display: 'flex', gap: 8,
        }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, padding: '12px' }}>
            {L.close}
          </button>
          {isHost && picked.owned && (
            <button className="btn btn-primary" onClick={() => { onSelect(pick); onClose(); }}
              style={{ flex: 2, padding: '12px' }}>
              <Icon name="check" size={16} color="#fff"/>
              {L.apply}
            </button>
          )}
          {isHost && !picked.owned && (
            <button className="btn btn-primary" style={{
              flex: 2, padding: '12px',
              background: 'linear-gradient(180deg, #d4a84a 0%, #b8892e 100%)',
              color: '#2a1d10',
            }}>
              <Icon name={picked.unit === '★' ? 'star' : 'coin'} size={16} color="#2a1d10"/>
              {L.price} · {picked.price}{picked.unit === '★' ? ' ★' : ' ◈'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Small inline map card — used in Lobby & Create screens
function MapPickRow({ boardId, onOpen, lang, editable }) {
  const board = BOARDS.find(b => b.id === boardId) || BOARDS[0];
  const L = lang === 'RU' ? {
    title: 'Карта', change: 'Сменить', locked: 'Выбор хозяина',
  } : {
    title: 'Map', change: 'Change', locked: "Host's choice",
  };
  const meta = RARITY_META[board.rarity];
  return (
    <div style={{
      padding: 10,
      background: 'var(--card)',
      border: `1px solid ${editable ? 'var(--line)' : 'var(--divider)'}`,
      borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        borderRadius: 8, overflow: 'hidden',
        border: `2px solid ${board.palette.gold}`,
        flexShrink: 0,
      }}>
        <BoardPreview board={board} size={64}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: meta.color, fontWeight: 700,
        }}>
          {meta[lang === 'RU' ? 'ru' : 'en']}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)', lineHeight: 1.1, marginTop: 2 }}>
          {lang === 'RU' ? board.ru : board.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {editable ? board.desc[lang === 'RU' ? 'ru' : 'en'] : L.locked}
        </div>
      </div>
      {editable ? (
        <button onClick={onOpen} style={{
          padding: '7px 12px',
          background: 'transparent',
          color: 'var(--primary)',
          border: '1px solid var(--primary)',
          borderRadius: 999,
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>{L.change}</button>
      ) : (
        <Icon name="lock" size={14} color="var(--ink-4)"/>
      )}
    </div>
  );
}

window.BoardSelectModal = BoardSelectModal;
window.MapPickRow = MapPickRow;
