// Main app shell — routes, tweaks, Telegram safe-area handling
// Vue 3 / Composition API entry point.

(() => {
  const { createApp, ref, computed, watch, onMounted, onBeforeUnmount } = Vue;

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

  const App = {
    name: 'App',
    setup() {
      const screen = ref(TWEAKS.screen || 'home');
      const modal = ref(null);
      const modalData = ref(null);
      const lang = ref(TWEAKS.lang || 'EN');
      const safeTop = ref(TWEAKS.safeTop ?? 0);
      const safeBottom = ref(TWEAKS.safeBottom ?? 34);
      const showDesktop = ref(TWEAKS.showDesktop ?? true);
      const playerCount = ref(TWEAKS.playerCount ?? 4);
      const selectedBoard = ref('eldmark');
      const tweaksOn = ref(false);
      const loadingVariant = ref(TWEAKS.loadingVariant || 'sigil');
      const showBoot = ref(!!TWEAKS.showBoot);
      const errorKind = ref(TWEAKS.errorKind || 'generic');
      const transitioning = ref(false);

      const persist = (patch) => {
        try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*'); } catch {}
      };

      // Safe-area CSS vars
      watch([safeTop, safeBottom], ([t, b]) => {
        document.documentElement.style.setProperty('--csat', t + 'px');
        document.documentElement.style.setProperty('--csab', b + 'px');
      }, { immediate: true });

      // Tweaks protocol
      const onMessage = (e) => {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === '__activate_edit_mode') tweaksOn.value = true;
        if (e.data.type === '__deactivate_edit_mode') tweaksOn.value = false;
      };

      let bootTimer = null;
      let transitionTimer = null;

      onMounted(() => {
        window.addEventListener('message', onMessage);
        window.parent.postMessage({ type: '__edit_mode_available' }, '*');

        if (!TWEAKS.showBoot) {
          showBoot.value = true;
          bootTimer = setTimeout(() => { showBoot.value = false; }, 1800);
        }
      });

      onBeforeUnmount(() => {
        window.removeEventListener('message', onMessage);
        if (bootTimer) clearTimeout(bootTimer);
        if (transitionTimer) clearTimeout(transitionTimer);
      });

      // Brief overlay on screen change
      watch(screen, () => {
        transitioning.value = true;
        if (transitionTimer) clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => { transitioning.value = false; }, 380);
      }, { immediate: true });

      const go = (s) => { screen.value = s; persist({ screen: s }); };
      const openModal = (m, data) => { modal.value = m; modalData.value = data; persist({ modal: m }); };
      const closeModal = () => { modal.value = null; persist({ modal: 'none' }); };
      const setBoard = (id) => { selectedBoard.value = id; };

      const showGameTabs = computed(() => ['rooms', 'game', 'friends', 'shop', 'profile'].includes(screen.value));
      const isSystemScreen = computed(() => ['rotate', 'error'].includes(screen.value));

      const screenComponent = computed(() => {
        switch (screen.value) {
          case 'home': return 'HomeScreen';
          case 'rooms': return 'RoomsScreen';
          case 'create': return 'CreateScreen';
          case 'shop': return 'ShopScreen';
          case 'friends': return 'FriendsScreen';
          case 'lobby': return 'LobbyScreen';
          case 'game': return 'GameScreen';
          case 'profile': return 'HomeScreen';
          case 'rotate': return 'RotateScreen';
          case 'error': return 'ErrorScreen';
          default: return 'HomeScreen';
        }
      });

      const screenProps = computed(() => {
        const base = { go, lang: lang.value };
        switch (screen.value) {
          case 'create': return { ...base, openModal, selectedBoard: selectedBoard.value };
          case 'shop': return { ...base, openModal };
          case 'lobby': return { ...base, openModal, selectedBoard: selectedBoard.value };
          case 'game': return { ...base, openModal, playerCount: playerCount.value };
          case 'rotate': return { lang: lang.value };
          case 'error': return { lang: lang.value, kind: errorKind.value, onRetry: () => go('home'), onHome: () => go('home') };
          default: return base;
        }
      });

      const modalComponent = computed(() => {
        if (!modal.value || modal.value === 'none') return null;
        switch (modal.value) {
          case 'deed': return 'DeedModal';
          case 'trade': return 'TradeModal';
          case 'decree': return 'DecreeModal';
          case 'chest': return 'DecreeModal';
          case 'profile': return 'ProfileModal';
          case 'chat': return 'ChatModal';
          case 'crown': return 'CoronationModal';
          case 'boardpick': return 'BoardSelectModal';
          case 'purchase-ok': return 'PurchaseSuccessModal';
          case 'purchase-fail': return 'PurchaseFailModal';
          default: return null;
        }
      });

      const modalProps = computed(() => {
        const base = { onClose: closeModal, lang: lang.value, data: modalData.value };
        if (modal.value === 'decree') return { ...base, kind: 'chance' };
        if (modal.value === 'chest') return { ...base, kind: 'chest' };
        if (modal.value === 'boardpick') return { ...base, selectedId: selectedBoard.value, onSelect: setBoard, isHost: true };
        return base;
      });

      const desktopNav = computed(() => [
        { id: 'home', l: lang.value === 'RU' ? 'Тронный зал' : 'Home', i: 'home' },
        { id: 'rooms', l: lang.value === 'RU' ? 'Таверна' : 'Tavern', i: 'users' },
        { id: 'game', l: lang.value === 'RU' ? 'В игре' : 'In Game', i: 'dice' },
        { id: 'shop', l: lang.value === 'RU' ? 'Ярмарка' : 'Bazaar', i: 'bag' },
        { id: 'friends', l: lang.value === 'RU' ? 'Союзники' : 'Friends', i: 'shield' },
        { id: 'create', l: lang.value === 'RU' ? 'Создать' : 'Create', i: 'plus' },
      ]);

      // Tweak updaters
      const setScreen = (v) => { screen.value = v; persist({ screen: v }); };
      const setErrorKind = (v) => { errorKind.value = v; persist({ errorKind: v }); };
      const setModal = (v) => { modal.value = v === 'none' ? null : v; persist({ modal: v }); };
      const setPlayerCount = (v) => { playerCount.value = +v; persist({ playerCount: +v }); };
      const setLang = (v) => { lang.value = v; persist({ lang: v }); };
      const setSafeTop = (v) => { safeTop.value = +v; persist({ safeTop: +v }); };
      const setSafeBottom = (v) => { safeBottom.value = +v; persist({ safeBottom: +v }); };
      const setLoadingVariant = (v) => { loadingVariant.value = v; persist({ loadingVariant: v }); };
      const setShowBoot = (v) => { showBoot.value = v; persist({ showBoot: v }); };
      const setShowDesktop = (v) => { showDesktop.value = v; persist({ showDesktop: v }); };

      return {
        screen, modal, modalData, lang, safeTop, safeBottom, showDesktop, playerCount,
        selectedBoard, tweaksOn, loadingVariant, showBoot, errorKind, transitioning,
        go, openModal, closeModal,
        showGameTabs, isSystemScreen,
        screenComponent, screenProps, modalComponent, modalProps,
        desktopNav,
        setScreen, setErrorKind, setModal, setPlayerCount, setLang,
        setSafeTop, setSafeBottom, setLoadingVariant, setShowBoot, setShowDesktop,
      };
    },
    template: `
      <div class="stage">
        <div class="device">
          <div class="device-inner">
            <div class="device-notch"/>
            <div class="app parchment is-mobile" :style="isSystemScreen ? { padding: 0 } : { padding: 'var(--csat, 50px) 0 var(--csab, 20px)' }">
              <template v-if="tweaksOn">
                <div class="safe-debug-top"/>
                <div class="safe-debug-bottom"/>
              </template>
              <LoadingScreen v-if="showBoot" :variant="loadingVariant" :lang="lang"/>
              <template v-else>
                <component :is="screenComponent" v-bind="screenProps"/>
                <TabBar v-if="showGameTabs && screen !== 'game' && !isSystemScreen" :active="screen" :on-change="go"/>
                <LoadingScreen v-if="transitioning && !isSystemScreen" :variant="loadingVariant" :lang="lang" :fullscreen="false" message=" "/>
                <component v-if="!isSystemScreen && modalComponent" :is="modalComponent" v-bind="modalProps"/>
              </template>
            </div>
            <div class="device-indicator"/>
          </div>
        </div>

        <div v-if="showDesktop" class="desktop">
          <div class="desktop-chrome">
            <div class="dots"><span/><span/><span/></div>
            <div class="url">minipoly.game · Desktop preview</div>
            <div :style="{ width: '48px' }"/>
          </div>
          <div :style="{ flex: 1, position: 'relative', display: 'flex', alignItems: 'stretch' }">
            <div :style="{
              width: '220px',
              background: '#2a1d10',
              color: '#c9b88e',
              display: 'flex',
              flexDirection: 'column',
              padding: '18px 14px',
              borderRight: '1px solid #1a110a',
              gap: '4px',
              flexShrink: 0,
            }">
              <div :style="{ fontFamily: 'var(--font-title)', fontSize: '16px', letterSpacing: '0.18em', color: '#d4a84a', marginBottom: '16px' }">
                MINI · POLY
              </div>
              <button v-for="it in desktopNav" :key="it.id" @click="go(it.id)" :style="{
                background: screen === it.id ? 'rgba(212, 168, 74, 0.15)' : 'transparent',
                color: screen === it.id ? '#d4a84a' : '#c9b88e',
                border: 'none',
                borderLeft: screen === it.id ? '2px solid #d4a84a' : '2px solid transparent',
                padding: '10px 12px',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }">
                <Icon :name="it.i" :size="15" :color="screen === it.id ? '#d4a84a' : '#8a7152'"/>
                {{ it.l }}
              </button>
              <div :style="{ flex: 1 }"/>
              <div :style="{ fontSize: '10px', color: '#6a5838', letterSpacing: '0.1em', textTransform: 'uppercase' }">
                Anno MMXXVI
              </div>
            </div>
            <div :style="{ flex: 1, position: 'relative', overflow: 'hidden' }">
              <div class="app parchment is-desktop" :style="isSystemScreen ? { padding: 0 } : { padding: 'var(--csat, 50px) 0 var(--csab, 20px)' }">
                <LoadingScreen v-if="showBoot" :variant="loadingVariant" :lang="lang"/>
                <template v-else>
                  <component :is="screenComponent" v-bind="screenProps"/>
                  <TabBar v-if="showGameTabs && screen !== 'game' && !isSystemScreen" :active="screen" :on-change="go"/>
                  <LoadingScreen v-if="transitioning && false" :variant="loadingVariant" :lang="lang" :fullscreen="false" message=" "/>
                  <component v-if="!isSystemScreen && modalComponent" :is="modalComponent" v-bind="modalProps"/>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="tweaksOn" class="tweaks-panel">
        <div class="tweaks-title">⚜ TWEAKS</div>

        <label>Screen</label>
        <select :value="screen" @change="setScreen($event.target.value)">
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

        <div class="sep"/>
        <label>Error kind</label>
        <select :value="errorKind" @change="setErrorKind($event.target.value)">
          <option value="generic">Generic (#418)</option>
          <option value="server">Server (#503)</option>
          <option value="offline">Connection lost</option>
        </select>

        <div class="sep"/>
        <label>Modal</label>
        <select :value="modal || 'none'" @change="setModal($event.target.value)">
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

        <div class="sep"/>
        <label>Players (Game screen)</label>
        <select :value="playerCount" @change="setPlayerCount($event.target.value)">
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
        </select>

        <div class="sep"/>
        <label>Language</label>
        <select :value="lang" @change="setLang($event.target.value)">
          <option value="EN">English</option>
          <option value="RU">Русский</option>
        </select>

        <div class="sep"/>
        <label>Safe area (top / bottom, px)</label>
        <div :style="{ display: 'flex', gap: '8px' }">
          <input type="number" :value="safeTop" @input="setSafeTop($event.target.value)"
            :style="{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }"/>
          <input type="number" :value="safeBottom" @input="setSafeBottom($event.target.value)"
            :style="{ flex: 1, background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }"/>
        </div>

        <div class="sep"/>
        <label>Loading variant</label>
        <select :value="loadingVariant" @change="setLoadingVariant($event.target.value)">
          <option value="sigil">Sigil (crest + crown)</option>
          <option value="dice">Tumbling dice</option>
          <option value="scroll">Unrolling scroll</option>
          <option value="coins">Stacking coins</option>
        </select>

        <div class="sep"/>
        <label>
          <input type="checkbox" :checked="showBoot" @change="setShowBoot($event.target.checked)"/>
          &nbsp;Show boot loader
        </label>

        <div class="sep"/>
        <label>
          <input type="checkbox" :checked="showDesktop" @change="setShowDesktop($event.target.checked)"/>
          &nbsp;Show desktop preview
        </label>
      </div>
    `,
  };

  const app = createApp(App);

  // Register all components collected from other files
  const registry = (window.MPV && window.MPV.components) || {};
  for (const [name, def] of Object.entries(registry)) {
    app.component(name, def);
  }

  app.mount('#root');
})();
