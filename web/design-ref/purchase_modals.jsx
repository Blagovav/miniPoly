// Purchase result modals — success + failure

// Success — victorious celebration
function PurchaseSuccessModal({ onClose, lang, data }) {
  const item = data || { name: 'Dragon', ru: 'Дракон', price: 150, unit: '★', kind: 'token' };
  const L = lang === 'RU' ? {
    title: 'Сделка заключена!',
    sub: 'Ваше приобретение добавлено в казну.',
    ok: 'Отлично',
    equip: 'Экипировать',
    spent: 'Потрачено',
    balance: 'Остаток',
    kindLabels: { token: 'Фишка', map: 'Карта', banner: 'Знамя', dice: 'Кости', theme: 'Цвет' },
  } : {
    title: 'Purchase complete',
    sub: 'Your acquisition has joined the treasury.',
    ok: 'Splendid',
    equip: 'Equip',
    spent: 'Spent',
    balance: 'Balance',
    kindLabels: { token: 'Token', map: 'Map', banner: 'Banner', dice: 'Dice', theme: 'House' },
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative',
        width: '100%', maxWidth: 360, margin: '16px',
        background: 'var(--bg)',
        borderRadius: 16,
        border: '1px solid var(--gold)',
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35), 0 0 40px rgba(212, 168, 74, 0.25)',
        animation: 'successPop 420ms cubic-bezier(0.2, 1.4, 0.4, 1)',
      }}>
        {/* Celebratory banner top */}
        <div style={{
          position: 'relative',
          background: 'radial-gradient(ellipse at 50% 130%, rgba(212, 168, 74, 0.45) 0%, transparent 60%), linear-gradient(180deg, #2d1a5a 0%, #1a0e3a 100%)',
          padding: '24px 20px 18px',
          color: '#f7eeda',
          textAlign: 'center',
          overflow: 'hidden',
        }}>
          {/* Confetti/coins */}
          {[...Array(12)].map((_, i) => {
            const x = (i * 31) % 100;
            const delay = (i * 80) % 900;
            const size = 3 + (i % 3);
            const colors = ['#d4a84a', '#f5d98a', '#f7eeda', '#b8892e'];
            return (
              <div key={i} style={{
                position: 'absolute',
                left: x + '%',
                top: -10,
                width: size, height: size,
                borderRadius: '50%',
                background: colors[i % colors.length],
                animation: `confettiFall 2.2s ${delay}ms ease-out infinite`,
                opacity: 0.8,
              }}/>
            );
          })}

          {/* Big sparkle icon */}
          <div style={{
            width: 72, height: 72,
            margin: '0 auto 12px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #f5d98a 0%, #d4a84a 60%, #8b6914 100%)',
            boxShadow: '0 0 0 3px rgba(247, 238, 218, 0.15), 0 8px 20px rgba(0,0,0,0.4), inset 0 2px 3px rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <svg viewBox="0 0 40 40" width="42" height="42">
              <path d="M 20 4 L 23 16 L 36 20 L 23 24 L 20 36 L 17 24 L 4 20 L 17 16 Z"
                fill="#2a1d10" opacity="0.85"/>
              <path d="M 20 9 L 22 17 L 30 20 L 22 23 L 20 31 L 18 23 L 10 20 L 18 17 Z"
                fill="#fffef0" opacity="0.95"/>
            </svg>
          </div>

          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, letterSpacing: '0.02em',
            color: '#f7eeda', marginBottom: 4,
          }}>{L.title}</div>
          <div style={{ fontSize: 12, color: '#c9b88e', lineHeight: 1.4, maxWidth: 260, margin: '0 auto' }}>
            {L.sub}
          </div>
        </div>

        {/* Item card */}
        <div style={{ padding: '18px 20px 14px' }}>
          <div className="row" style={{ gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 10,
              background: `radial-gradient(circle at 32% 28%, #f5d98a, #d4a84a 55%, #8b6914)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.4)',
              border: '2px solid #fff',
              flexShrink: 0,
            }}>
              {item.kind === 'token' ? (
                <TokenArt id={item.id || 'dragon'} size={40} color="#fff" shadow="rgba(0,0,0,0.55)"/>
              ) : item.kind === 'map' && window.BoardPreview ? (
                <div style={{ borderRadius: 6, overflow: 'hidden' }}>
                  <BoardPreview board={BOARDS.find(b => b.id === (item.id || 'eldmark')) || BOARDS[0]} size={48}/>
                </div>
              ) : (
                <svg viewBox="0 0 32 32" width="32" height="32">
                  <circle cx="16" cy="16" r="10" fill="#fff" opacity="0.9"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                {L.kindLabels[item.kind] || ''}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)', lineHeight: 1.15, marginTop: 2 }}>
                {lang === 'RU' ? item.ru : item.name}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 4, padding: '2px 8px',
                background: 'rgba(212, 168, 74, 0.12)',
                border: '1px solid rgba(212, 168, 74, 0.4)',
                borderRadius: 999,
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--gold)',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}>
                <Icon name={item.unit === '★' ? 'star' : 'coin'} size={10} color="var(--gold)"/>
                {item.unit === '★' ? `${item.price} ★` : `${item.price} ◈`}
              </div>
            </div>
          </div>

          {/* Balance row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'var(--card)',
            border: '1px solid var(--divider)',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 14,
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{L.spent}</div>
              <div style={{ color: 'var(--crim)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 2 }}>
                − {item.unit === '★' ? `${item.price} ★` : `${item.price} ◈`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{L.balance}</div>
              <div style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 2 }}>
                {item.unit === '★' ? '28 ★' : '1 100 ◈'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
              {L.ok}
            </button>
            <button className="btn btn-primary" onClick={onClose} style={{ flex: 2,
              background: 'linear-gradient(180deg, #d4a84a 0%, #b8892e 100%)',
              color: '#2a1d10',
            }}>
              <Icon name="check" size={16} color="#2a1d10"/>
              {L.equip}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes successPop {
          0% { transform: scale(0.9) translateY(12px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(180px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Failure — not enough coin
function PurchaseFailModal({ onClose, lang, data }) {
  const item = data || { name: 'Moonspire', ru: 'Лунный Шпиль', price: 40, unit: '★', kind: 'map', balance: 28 };
  const reason = item.reason || 'funds';  // 'funds' | 'sold-out' | 'error'

  const L = lang === 'RU' ? {
    title: reason === 'funds' ? 'Казна пуста' : reason === 'sold-out' ? 'Распродано' : 'Сделка отклонена',
    sub: reason === 'funds'
      ? 'Недостаточно средств в вашей казне.'
      : reason === 'sold-out'
        ? 'Этого товара больше нет у торговца.'
        : 'Казначей не смог провести сделку.',
    need: 'Требуется',
    have: 'В казне',
    short: 'Не хватает',
    cancel: 'Отмена',
    topup: 'Пополнить казну',
    browse: 'К другим товарам',
    retry: 'Повторить',
    hint: reason === 'funds'
      ? 'Пополните казну монетами или звёздами ярмарки.'
      : 'Вернитесь позже — или попробуйте другой товар.',
  } : {
    title: reason === 'funds' ? 'Empty coffers' : reason === 'sold-out' ? 'Sold out' : 'Transaction declined',
    sub: reason === 'funds'
      ? 'Your treasury lacks the necessary coin.'
      : reason === 'sold-out'
        ? 'The merchant has none left to sell.'
        : 'The royal accountant could not complete this transaction.',
    need: 'Needed',
    have: 'You have',
    short: 'Short by',
    cancel: 'Cancel',
    topup: 'Top up coffers',
    browse: 'Browse other wares',
    retry: 'Try again',
    hint: reason === 'funds'
      ? 'Top up with bazaar coin or royal stars.'
      : 'Come back later — or try another ware.',
  };

  const shortBy = reason === 'funds' ? item.price - (item.balance ?? 0) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative',
        width: '100%', maxWidth: 360, margin: '16px',
        background: 'var(--bg)',
        borderRadius: 16,
        border: '1px solid var(--crim)',
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        animation: 'failShake 420ms ease-out',
      }}>
        {/* Dim header */}
        <div style={{
          position: 'relative',
          background: 'radial-gradient(ellipse at 50% 130%, rgba(154, 28, 58, 0.25) 0%, transparent 60%), linear-gradient(180deg, #3a1218 0%, #1a0810 100%)',
          padding: '24px 20px 18px',
          color: '#f7eeda',
          textAlign: 'center',
        }}>
          {/* Broken coin icon */}
          <div style={{
            width: 72, height: 72,
            margin: '0 auto 12px',
            position: 'relative',
          }}>
            <svg viewBox="0 0 72 72" width="72" height="72">
              <defs>
                <linearGradient id="brokenCoin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#8a7152"/>
                  <stop offset="1" stopColor="#4a3a28"/>
                </linearGradient>
              </defs>
              {/* left half */}
              <path d="M 36 10 A 26 26 0 0 0 24 58 L 32 34 Z"
                fill="url(#brokenCoin)" stroke="#2a1d10" strokeWidth="1.5"/>
              {/* right half — slightly detached */}
              <g transform="translate(4, 1) rotate(6 36 36)">
                <path d="M 36 10 A 26 26 0 0 1 48 58 L 40 34 Z"
                  fill="url(#brokenCoin)" stroke="#2a1d10" strokeWidth="1.5"/>
              </g>
              {/* crack */}
              <path d="M 36 10 L 34 22 L 38 30 L 32 40 L 36 58"
                stroke="#1a110a" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, color: '#f7eeda', marginBottom: 4,
          }}>{L.title}</div>
          <div style={{ fontSize: 12, color: '#c9b88e', lineHeight: 1.4, maxWidth: 260, margin: '0 auto' }}>
            {L.sub}
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: '16px 20px 14px' }}>
          {reason === 'funds' && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, marginBottom: 14,
            }}>
              {[
                { k: L.need,  v: `${item.price} ${item.unit || '◈'}`,  color: 'var(--ink)' },
                { k: L.have,  v: `${item.balance ?? 0} ${item.unit || '◈'}`, color: 'var(--ink-2)' },
                { k: L.short, v: `${shortBy} ${item.unit || '◈'}`,      color: 'var(--crim)' },
              ].map((c, i) => (
                <div key={i} style={{
                  padding: '8px 6px',
                  background: 'var(--card)',
                  border: '1px solid var(--divider)',
                  borderRadius: 8,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c.k}</div>
                  <div style={{
                    marginTop: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12, fontWeight: 700,
                    color: c.color,
                  }}>{c.v}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{
            fontSize: 11, color: 'var(--ink-3)',
            textAlign: 'center', lineHeight: 1.4,
            padding: '0 8px 12px',
          }}>
            {L.hint}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
              {L.cancel}
            </button>
            <button className="btn btn-primary" onClick={onClose} style={{ flex: 2 }}>
              {reason === 'funds' ? (
                <>
                  <Icon name={item.unit === '★' ? 'star' : 'coin'} size={16} color="#fff"/>
                  {L.topup}
                </>
              ) : reason === 'sold-out' ? L.browse : L.retry}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes failShake {
          0%    { transform: translateX(0); opacity: 0; }
          15%   { transform: translateX(-8px); opacity: 1; }
          30%   { transform: translateX(6px); }
          45%   { transform: translateX(-4px); }
          60%   { transform: translateX(3px); }
          75%   { transform: translateX(-2px); }
          100%  { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

window.PurchaseSuccessModal = PurchaseSuccessModal;
window.PurchaseFailModal = PurchaseFailModal;
