import { ref, onBeforeUnmount } from "vue";
import type { ClientMessage, ServerMessage } from "../../../shared/types";

const WS_URL = (import.meta.env.VITE_WS_URL as string) || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export interface WsClient {
  connected: ReturnType<typeof ref<boolean>>;
  send: (m: ClientMessage) => void;
  onMessage: (cb: (m: ServerMessage) => void) => () => void;
  close: () => void;
}

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
    else queue.push(m);
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
