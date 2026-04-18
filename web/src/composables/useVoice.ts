import { onBeforeUnmount, ref, shallowRef } from "vue";
import type { ServerMessage, VoiceSignalPayload } from "../../../shared/types";
import type { WsClient } from "./useWs";

type PeerState = {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  analyser: AnalyserNode | null;
  // Raw buffer reused for level polling to avoid GC pressure.
  // TS 5.7+ typed-array generic makes AnalyserNode's method reject
  // Uint8Array<ArrayBufferLike>, so pin it to ArrayBuffer at the source.
  levelBuf: Uint8Array<ArrayBuffer> | null;
  lastSpokeAt: number;
};

const STUN = "stun:stun.l.google.com:19302";
const SPEAKING_THRESHOLD = 14; // RMS on 0-255 scale
const SPEAKING_HOLD_MS = 300;

function buildIceServers(): RTCIceServer[] {
  const list: RTCIceServer[] = [{ urls: STUN }];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    list.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USER as string | undefined,
      credential: import.meta.env.VITE_TURN_PASS as string | undefined,
    });
  }
  return list;
}

export interface VoiceClient {
  // joined the voice channel (mic acquired, peers signalling)
  isActive: ReturnType<typeof ref<boolean>>;
  // currently transmitting (PTT pressed, local track unmuted)
  isTransmitting: ReturnType<typeof ref<boolean>>;
  // user is acquiring mic / connecting
  isConnecting: ReturnType<typeof ref<boolean>>;
  // last error code, if mic permission denied or similar
  lastError: ReturnType<typeof ref<string | null>>;
  // peerIds who are actively producing audio above threshold
  speakingIds: ReturnType<typeof ref<string[]>>;

  toggle: () => Promise<void>;
  press: () => void;
  release: () => void;
  stop: () => void;
}

// WebRTC mesh over existing WS signalling. Each participant holds an
// RTCPeerConnection to every other participant. Local mic track is shared
// across all PCs; PTT is implemented by toggling `track.enabled`.
export function useVoice(ws: WsClient, getMyPlayerId: () => string | null): VoiceClient {
  const isActive = ref(false);
  const isTransmitting = ref(false);
  const isConnecting = ref(false);
  const lastError = ref<string | null>(null);
  const speakingIds = ref<string[]>([]);

  const peers = new Map<string, PeerState>();
  // Buffered ICE candidates that arrived before we set the remote description.
  const pendingIce = new Map<string, RTCIceCandidateInit[]>();
  const localStream = shallowRef<MediaStream | null>(null);
  let rafHandle: number | null = null;

  function sendSignal(toId: string, payload: VoiceSignalPayload) {
    ws.send({ type: "voiceSignal", toId, payload });
  }

  function ensureLocalTracksMuted(muted: boolean) {
    const s = localStream.value;
    if (!s) return;
    for (const t of s.getAudioTracks()) t.enabled = !muted;
  }

  function createPeer(peerId: string): PeerState {
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    if (localStream.value) {
      for (const t of localStream.value.getAudioTracks()) pc.addTrack(t, localStream.value);
    }
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignal(peerId, { kind: "ice", candidate: ev.candidate.toJSON() });
      }
    };
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.dataset.voicePeer = peerId;
    // Kept out of the layout but attached so iOS doesn't suspend playback.
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);

    const state: PeerState = {
      pc,
      audioEl,
      analyser: null,
      levelBuf: null,
      lastSpokeAt: 0,
    };

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (!stream) return;
      audioEl.srcObject = stream;
      audioEl.play().catch(() => {
        // iOS Telegram WebView sometimes requires a user gesture — PTT press
        // will re-trigger play() below.
      });
      attachAnalyser(state, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        destroyPeer(peerId);
      }
    };

    peers.set(peerId, state);
    return state;
  }

  function attachAnalyser(state: PeerState, stream: MediaStream) {
    try {
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      state.analyser = analyser;
      state.levelBuf = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      /* analyser is best-effort; absence just disables speaking indicator */
    }
  }

  function destroyPeer(peerId: string) {
    const state = peers.get(peerId);
    if (!state) return;
    try { state.pc.close(); } catch {}
    try { state.audioEl.srcObject = null; state.audioEl.remove(); } catch {}
    peers.delete(peerId);
    pendingIce.delete(peerId);
    const idx = speakingIds.value.indexOf(peerId);
    if (idx >= 0) {
      const next = speakingIds.value.slice();
      next.splice(idx, 1);
      speakingIds.value = next;
    }
  }

  async function makeOffer(peerId: string) {
    const state = peers.get(peerId) ?? createPeer(peerId);
    const offer = await state.pc.createOffer({ offerToReceiveAudio: true });
    await state.pc.setLocalDescription(offer);
    sendSignal(peerId, { kind: "offer", sdp: offer.sdp ?? "" });
  }

  async function handleOffer(fromId: string, sdp: string) {
    const state = peers.get(fromId) ?? createPeer(fromId);
    await state.pc.setRemoteDescription({ type: "offer", sdp });
    await flushPendingIce(fromId);
    const answer = await state.pc.createAnswer();
    await state.pc.setLocalDescription(answer);
    sendSignal(fromId, { kind: "answer", sdp: answer.sdp ?? "" });
  }

  async function handleAnswer(fromId: string, sdp: string) {
    const state = peers.get(fromId);
    if (!state) return;
    await state.pc.setRemoteDescription({ type: "answer", sdp });
    await flushPendingIce(fromId);
  }

  async function handleIce(fromId: string, candidate: RTCIceCandidateInit) {
    const state = peers.get(fromId);
    if (!state || !state.pc.remoteDescription) {
      const buf = pendingIce.get(fromId) ?? [];
      buf.push(candidate);
      pendingIce.set(fromId, buf);
      return;
    }
    try { await state.pc.addIceCandidate(candidate); } catch {}
  }

  async function flushPendingIce(peerId: string) {
    const buf = pendingIce.get(peerId);
    if (!buf) return;
    pendingIce.delete(peerId);
    const state = peers.get(peerId);
    if (!state) return;
    for (const c of buf) {
      try { await state.pc.addIceCandidate(c); } catch {}
    }
  }

  function pollLevels() {
    const now = performance.now();
    let changed = false;
    const current = new Set(speakingIds.value);
    for (const [peerId, state] of peers) {
      if (!state.analyser || !state.levelBuf) continue;
      state.analyser.getByteTimeDomainData(state.levelBuf);
      let sum = 0;
      for (let i = 0; i < state.levelBuf.length; i++) {
        const v = state.levelBuf[i] - 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / state.levelBuf.length);
      if (rms > SPEAKING_THRESHOLD) {
        state.lastSpokeAt = now;
        if (!current.has(peerId)) { current.add(peerId); changed = true; }
      } else if (now - state.lastSpokeAt > SPEAKING_HOLD_MS) {
        if (current.has(peerId)) { current.delete(peerId); changed = true; }
      }
    }
    if (changed) speakingIds.value = Array.from(current);
    rafHandle = requestAnimationFrame(pollLevels);
  }

  function startLevelPolling() {
    if (rafHandle != null) return;
    rafHandle = requestAnimationFrame(pollLevels);
  }

  function stopLevelPolling() {
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
    speakingIds.value = [];
  }

  const off = ws.onMessage((m: ServerMessage) => {
    if (!isActive.value) return;
    const myId = getMyPlayerId();
    if (!myId) return;
    switch (m.type) {
      case "voicePeers":
        // I just joined — initiate offers to every pre-existing peer.
        for (const peerId of m.peerIds) {
          if (peerId === myId) continue;
          void makeOffer(peerId);
        }
        break;
      case "voicePeerJoined":
        // A new peer arrived; they will initiate to us (they got voicePeers
        // including our id). Nothing to do here.
        break;
      case "voicePeerLeft":
        destroyPeer(m.peerId);
        break;
      case "voiceSignal": {
        const { fromId, payload } = m;
        if (payload.kind === "offer") void handleOffer(fromId, payload.sdp);
        else if (payload.kind === "answer") void handleAnswer(fromId, payload.sdp);
        else if (payload.kind === "ice") void handleIce(fromId, payload.candidate);
        break;
      }
    }
  });

  async function toggle() {
    if (isActive.value) { stop(); return; }
    lastError.value = null;
    isConnecting.value = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStream.value = stream;
      // Start muted — PTT will enable the track on press.
      ensureLocalTracksMuted(true);
      isActive.value = true;
      isConnecting.value = false;
      startLevelPolling();
      ws.send({ type: "voiceJoin" });
    } catch (err: unknown) {
      isConnecting.value = false;
      const code = (err as { name?: string })?.name ?? "unknown";
      lastError.value =
        code === "NotAllowedError" || code === "PermissionDeniedError"
          ? "permission"
          : code === "NotFoundError"
            ? "no-device"
            : "failed";
      localStream.value = null;
    }
  }

  function stop() {
    if (!isActive.value && !isConnecting.value) return;
    try { ws.send({ type: "voiceLeave" }); } catch {}
    for (const peerId of Array.from(peers.keys())) destroyPeer(peerId);
    if (localStream.value) {
      for (const t of localStream.value.getTracks()) t.stop();
      localStream.value = null;
    }
    stopLevelPolling();
    isActive.value = false;
    isTransmitting.value = false;
    isConnecting.value = false;
  }

  function press() {
    if (!isActive.value || isTransmitting.value) return;
    ensureLocalTracksMuted(false);
    isTransmitting.value = true;
    // Nudge remote <audio> playback in case iOS suspended it before any gesture.
    for (const state of peers.values()) state.audioEl.play().catch(() => {});
  }

  function release() {
    if (!isTransmitting.value) return;
    ensureLocalTracksMuted(true);
    isTransmitting.value = false;
  }

  onBeforeUnmount(() => {
    off();
    stop();
  });

  return {
    isActive,
    isTransmitting,
    isConnecting,
    lastError,
    speakingIds,
    toggle,
    press,
    release,
    stop,
  };
}
