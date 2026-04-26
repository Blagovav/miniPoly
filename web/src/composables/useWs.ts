import { ref, onBeforeUnmount } from "vue";
import type { ClientMessage, ServerMessage } from "../../../shared/types";

const WS_URL = (import.meta.env.VITE_WS_URL as string) || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export interface WsClient {
  connected: ReturnType<typeof ref<boolean>>;
  send: (m: ClientMessage) => void;
  onMessage: (cb: (m: ServerMessage) => void) => () => void;
  close: () => void;
}

// Cap the offline-send queue. Without a cap, a user mashing "Roll"
// or any other action 200× while the server is down would flush all
// 200 messages on reconnect, most of which are stale or invalid in
// the new state. 50 is more than enough for any legitimate burst
// while still bounded.
const MAX_QUEUE = 50;

export function useWs(): WsClient {
  const connected = ref(false);
  const listeners = new Set<(m: ServerMessage) => void>();
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let queue: ClientMessage[] = [];
  let closedByUser = false;

  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      connected.value = true;
      for (const m of queue) ws?.send(JSON.stringify(m));
      queue = [];
    };
    ws.onclose = () => {
      connected.value = false;
      if (!closedByUser) {
        reconnectTimer = setTimeout(connect, 1500);
      }
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data) as ServerMessage;
        listeners.forEach((cb) => cb(m));
      } catch {
        /* noop */
      }
    };
    ws.onerror = () => {
      /* будет close → reconnect */
    };
  }

  connect();

  function send(m: ClientMessage) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    else {
      // Drop the oldest queued message when at cap. Latest intent
      // wins — better to skip the original "Roll" tap than to discard
      // the corrected one the user was about to send.
      queue.push(m);
      if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    }
  }

  function onMessage(cb: (m: ServerMessage) => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function close() {
    closedByUser = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  }

  onBeforeUnmount(close);

  return { connected, send, onMessage, close };
}
