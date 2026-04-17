// Main app shell — routes, tweaks, Telegram safe-area handling

const { useState, useEffect } = React;

const TWEAKS = /*EDITMODE-BEGIN*/{
  "screen": "home",
  "modal": "none",
  "lang": "EN",
  "safeTop": 90,
  "safeBottom": 34,
  "showDesktop": true,
  "playerCount": 4,
  "loadingVariant": "sigil",
  "showBoot": false,
  "errorKind": "generic"
} /*EDITMODE-END*/;

function App() {
  const [screen, setScreen] = useState(TWEAKS.screen || 'home');
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [lang, setLang] = useState(TWEAKS.lang || 'EN');
  const [safeTop, setSafeTop] = useState(TWEAKS.safeTop ?? 0);
  const [safeBottom, setSafeBottom] = useState(TWEAKS.safeBottom ?? 34);
  const [showDesktop, setShowDesktop] = useState(TWEAKS.showDesktop ?? true);
  const [playerCount, setPlayerCount] = useState(TWEAKS.playerCount ?? 4);
  const [selectedBoard, setSelectedBoard] = useState('eldmark');
  const [tweaksOn, setTweaksOn] = useState(false);
  const [loadingVariant, setLoadingVariant] = useState(TWEAKS.loadingVariant || 'sigil');
  const [showBoot, setShowBoot] = useState(!!TWEAKS.showBoot);
  const [errorKind, setErrorKind] = useState(TWEAKS.errorKind || 'generic');
  // Inline loading overlay — brief flash during screen transitions
  const [transitioning, setTransitioning] = useState(false);

  // Apply Telegram-style safe-area CSS vars
  useEffect(() => {
    document.documentElement.style.setProperty('--csat', safeTop + 'px');
    document.documentElement.style.setProperty('--csab', safeBottom + 'px');
  }, [safeTop, safeBottom]);

  // Tweaks protocol
  useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOn(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOn(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  // Persist screen/modal/lang
  const persist = (patch) => {
    try {window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');} catch {}
  };

  // Show boot loader briefly on mount
  useEffect(() => {
    if (TWEAKS.showBoot) return; // manual control via tweaks
    const t = setTimeout(() => setShowBoot(false), 1800);
    setShowBoot(true);
    return () => clearTimeout(t);
  }, []);

  // Brief overlay on screen change
  useEffect(() => {
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 380);
    return () => clearTimeout(t);
  }, [screen]);

  const go = (s) => {setScreen(s);persist({ screen: s });};
  const openModal = (m, data) => {setModal(m);setModalData(data);persist({ modal: m });};
  const closeModal = () => {setModal(null);persist({ modal: 'none' });};

  const showGameTabs = ['rooms', 'game', 'friends', 'shop', 'profile'].includes(screen);
  const isSystemScreen = ['rotate', 'error'].includes(screen);

  const renderScreen = () => {
    switch (screen) {
      case 'home':return <HomeScreen go={go} lang={lang} />;
      case 'rooms':return <RoomsScreen go={go} lang={lang} />;
      case 'create':return <CreateScreen go={go} lang={lang} openModal={openModal} selectedBoard={selectedBoard} />;
      case 'shop':return <ShopScreen go={go} lang={lang} openModal={openModal} />;
      case 'friends':return <FriendsScreen go={go} lang={lang} />;
      case 'lobby':return <LobbyScreen go={go} lang={lang} openModal={openModal} selectedBoard={selectedBoard} />;
      case 'game':return <GameScreen go={go} lang={lang} openModal={openModal} playerCount={playerCount} />;
      case 'profile':return <HomeScreen go={go} lang={lang} />; // profile ≈ home for now
      case 'rotate':return <RotateScreen lang={lang} />;
      case 'error':return <ErrorScreen lang={lang} kind={errorKind} onRetry={() => go('home')} onHome={() => go('home')} />;
      default:return <HomeScreen go={go} lang={lang} />;
    }
  };

  const renderModal = () => {
    if (!modal || modal === 'none') return null;
    const props = { onClose: closeModal, lang, data: modalData };
    switch (modal) {
      case 'deed':return <DeedModal {...props} />;
      case 'trade':return <TradeModal {...props} />;
      case 'decree':return <DecreeModal {...props} kind="chance" />;
      case 'chest':return <DecreeModal {...props} kind="chest" />;
      case 'profile':return <ProfileModal {...props} />;
      case 'chat':return <ChatModal {...props} />;
      case 'crown':return <CoronationModal {...props} />;
      case 'boardpick':return <BoardSelectModal {...props} selectedId={selectedBoard} onSelect={setSelectedBoard} isHost={true} />;
      case 'purchase-ok':return <PurchaseSuccessModal {...props} />;
      case 'purchase-fail':return <PurchaseFailModal {...props} />;
      default:return null;
    }
  };

  const appContent = (isDesktop) =>
  <div className={`app parchment ${isDesktop ? 'is-desktop' : 'is-mobile'}`} style={isSystemScreen ? { padding: 0 } : { padding: "var(--csat, 50px) 0 var(--csab, 20px)" }}>
      {tweaksOn && !isDesktop && <>
        <div className="safe-debug-top" />
        <div className="safe-debug-bottom" />
      </>}
      {showBoot ?
    <LoadingScreen variant={loadingVariant} lang={lang} /> :

    <>
          {renderScreen()}
          {showGameTabs && screen !== 'game' && !isSystemScreen &&
      <TabBar active={screen} onChange={go} />
      }
          {transitioning && !isDesktop && !isSystemScreen &&
      <LoadingScreen variant={loadingVariant} lang={lang} fullscreen={false} message=" " />
      }
          {!isSystemScreen && renderModal()}
        </>
    }
    </div>;


  return (
    <>
      <div className="stage">
        {/* Phone */}
        <div className="device">
          <div className="device-inner">
            <div className="device-notch" />
            {appContent(false)}
            <div className="device-indicator" />
          </div>
        </div>

        {/* Desktop (PC) preview */}
        {showDesktop &&
        <div className="desktop">
            <div className="desktop-chrome">
              <div className="dots"><span /><span /><span /></div>
              <div className="url">minipoly.game · Desktop preview</div>
              <div style={{ width: 48 }} />
            </div>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'stretch' }}>
              {/* Desktop layout: sidebar + main */}
              <div style={{
              width: 220,
              background: '#2a1d10',
              color: '#c9b88e',
              display: 'flex',
              flexDirection: 'column',
              padding: '18px 14px',
              borderRight: '1px solid #1a110a',
              gap: 4,
              flexShrink: 0
            }}>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: 16, letterSpacing: '0.18em', color: '#d4a84a', marginBottom: 16 }}>
                  MINI · POLY
                </div>
                {[
              { id: 'home', l: lang === 'RU' ? 'Тронный зал' : 'Home', i: 'home' },
              { id: 'rooms', l: lang === 'RU' ? 'Таверна' : 'Tavern', i: 'users' },
              { id: 'game', l: lang === 'RU' ? 'В игре' : 'In Game', i: 'dice' },
              { id: 'shop', l: lang === 'RU' ? 'Ярмарка' : 'Bazaar', i: 'bag' },
              { id: 'friends', l: lang === 'RU' ? 'Союзники' : 'Friends', i: 'shield' },
              { id: 'create', l: lang === 'RU' ? 'Создать' : 'Create', i: 'plus' }].
              map((it) =>
              <button key={it.id} onClick={() => go(it.id)} style={{
                background: screen === it.id ? 'rgba(212, 168, 74, 0.15)' : 'transparent',
                color: screen === it.id ? '#d4a84a' : '#c9b88e',
                border: 'none',
                borderLeft: screen === it.id ? '2px solid #d4a84a' : '2px solid transparent',
                padding: '10px 12px',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 4,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                    <Icon name={it.i} size={15} color={screen === it.id ? '#d4a84a' : '#8a7152'} />
                    {it.l}
                  </button>
              )}
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 10, color: '#6a5838', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Anno MMXXVI
                </div>
              </div>
              {/* Main: show the phone app full-bleed */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {appContent(true)}
              </div>
            </div>
          </div>
        }
      </div>

      {/* Tweaks panel */}
      {tweaksOn &&
      <div className="tweaks-panel">
          <div className="tweaks-title">⚜ TWEAKS</div>

          <label>Screen</label>
          <select value={screen} onChange={(e) => {setScreen(e.target.value);persist({ screen: e.target.value });}}>
            <option value="home">Home · Throne Hall</option>
            <option value="rooms">Rooms · Tavern</option>
            <option value="create">Create</option>
            <option value="lobby">Lobby</option>
            <option value="game">Game Board</option>
            <option value="shop">Bazaar</option>
            <option value="friends">Friends</option>
            <option value="rotate">⟲ Rotate device (landscape lock)</option>
            <option value="error">⚠ Error · something went wrong</option>
          </select>

          <div className="sep" />
          <label>Error kind</label>
          <select value={errorKind} onChange={(e) => {setErrorKind(e.target.value);persist({ errorKind: e.target.value });}}>
            <option value="generic">Generic (#418)</option>
            <option value="server">Server (#503)</option>
            <option value="offline">Connection lost</option>
          </select>

          <div className="sep" />
          <label>Modal</label>
          <select value={modal || 'none'} onChange={(e) => {const v = e.target.value;setModal(v === 'none' ? null : v);persist({ modal: v });}}>
            <option value="none">— none —</option>
            <option value="deed">Deed of Title</option>
            <option value="trade">Messenger (Trade)</option>
            <option value="decree">Royal Decree</option>
            <option value="chest">Town Chest</option>
            <option value="profile">Player Profile</option>
            <option value="chat">Pigeon Roost (Chat)</option>
            <option value="crown">Coronation</option>
            <option value="boardpick">Board selector</option>
            <option value="purchase-ok">Purchase · success</option>
            <option value="purchase-fail">Purchase · failed</option>
          </select>

          <div className="sep" />
          <label>Players (Game screen)</label>
          <select value={playerCount} onChange={(e) => {const v = +e.target.value;setPlayerCount(v);persist({ playerCount: v });}}>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>

          <div className="sep" />
          <label>Language</label>
          <select value={lang} onChange={(e) => {setLang(e.target.value);persist({ lang: e.target.value });}}>
            <option value="EN">English</option>
            <option value="RU">Русский</option>
          </select>

          <div className="sep" />
          <label>Safe area (top / bottom, px)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={safeTop} onChange={(e) => {const v = +e.target.value;setSafeTop(v);persist({ safeTop: v });}}
          style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', padding: '6px 8px', borderRadius: 6, fontSize: 12 }} />
            <input type="number" value={safeBottom} onChange={(e) => {const v = +e.target.value;setSafeBottom(v);persist({ safeBottom: v });}}
          style={{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', padding: '6px 8px', borderRadius: 6, fontSize: 12 }} />
          </div>

          <div className="sep" />
          <label>Loading variant</label>
          <select value={loadingVariant} onChange={(e) => {setLoadingVariant(e.target.value);persist({ loadingVariant: e.target.value });}}>
            <option value="sigil">Sigil (crest + crown)</option>
            <option value="dice">Tumbling dice</option>
            <option value="scroll">Unrolling scroll</option>
            <option value="coins">Stacking coins</option>
          </select>

          <div className="sep" />
          <label>
            <input type="checkbox" checked={showBoot} onChange={(e) => {setShowBoot(e.target.checked);persist({ showBoot: e.target.checked });}} />
            {' '}Show boot loader
          </label>

          <div className="sep" />
          <label>
            <input type="checkbox" checked={showDesktop} onChange={(e) => {setShowDesktop(e.target.checked);persist({ showDesktop: e.target.checked });}} />
            {' '}Show desktop preview
          </label>
        </div>
      }
    </>);

}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);