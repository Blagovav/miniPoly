export type Locale = "en" | "ru";

export type I18nText = { en: string; ru: string };

export type ColorGroup =
  | "brown"
  | "lightBlue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkBlue";

export type TileKind =
  | "go"
  | "street"
  | "railroad"
  | "utility"
  | "tax"
  | "chance"
  | "chest"
  | "jail"
  | "goToJail"
  | "freeParking";

export interface StreetTile {
  kind: "street";
  index: number;
  name: I18nText;
  group: ColorGroup;
  price: number;
  rent: [number, number, number, number, number, number];
  houseCost: number;
  mortgage: number;
}

export interface RailroadTile {
  kind: "railroad";
  index: number;
  name: I18nText;
  price: number;
  mortgage: number;
}

export interface UtilityTile {
  kind: "utility";
  index: number;
  name: I18nText;
  price: number;
  mortgage: number;
}

export interface TaxTile {
  kind: "tax";
  index: number;
  name: I18nText;
  amount: number;
}

export interface ChanceTile {
  kind: "chance";
  index: number;
  name: I18nText;
}

export interface ChestTile {
  kind: "chest";
  index: number;
  name: I18nText;
}

export interface SimpleTile {
  kind: "go" | "jail" | "goToJail" | "freeParking";
  index: number;
  name: I18nText;
}

export type Tile =
  | StreetTile
  | RailroadTile
  | UtilityTile
  | TaxTile
  | ChanceTile
  | ChestTile
  | SimpleTile;

export type PropertyTile = StreetTile | RailroadTile | UtilityTile;

export interface Player {
  id: string;
  tgUserId: number;
  name: string;
  avatar?: string;
  color: string;
  token: string; // id из SHOP_ITEMS (token-car, token-dog и т.д.) или "" для дефолта
  position: number;
  cash: number;
  inJail: boolean;
  jailTurns: number;
  getOutCards: number;
  bankrupt: boolean;
  ready: boolean;
  connected: boolean;
}

export interface OwnedProperty {
  tileIndex: number;
  ownerId: string;
  houses: number;
  hotel: boolean;
  mortgaged: boolean;
}

export type GamePhase =
  | "lobby"
  | "rolling"
  | "moving"
  | "action"
  | "buyPrompt"
  | "triplesPick"
  | "auction"
  | "ended";

export interface GameLogEntry {
  id: string;
  ts: number;
  text: I18nText;
}

export type SpeedDieFace = 1 | 2 | 3 | "bus" | "monopoly";

export interface DrawnCard {
  by: string; // playerId
  deck: "chance" | "chest";
  cardId: string;
  text: I18nText;
  ts: number;
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  tileIndex: number;
  cash: number;
  ts: number;
}

export interface AuctionState {
  tileIndex: number;
  highBid: number;
  highBidderId: string | null;
  passedIds: string[];
  startedAt: number;
}

export interface RoomState {
  id: string;
  hostId: string;
  isPublic: boolean;
  maxPlayers: number;
  players: Player[];
  currentTurn: number;
  phase: GamePhase;
  dice: [number, number] | null;
  speedDie: SpeedDieFace | null;
  doublesInARow: number;
  properties: Record<number, OwnedProperty>;
  log: GameLogEntry[];
  lastCard: DrawnCard | null;
  cardHistory: DrawnCard[];
  auction: AuctionState | null;
  pendingTrade: TradeOffer | null;
  winnerId: string | null;
  createdAt: number;
  startedAt: number | null;
}

export interface PublicRoomSummary {
  id: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

export interface ShopItem {
  id: string;
  kind: "token" | "theme" | "emote";
  name: I18nText;
  price: number; // цена в монетах (0 = бесплатно, если за Stars)
  starsPrice?: number; // если указано — можно купить за Telegram Stars
  icon: string;
  preview?: string;
}

// ---------- Client → Server messages ----------
export type ClientMessage =
  | { type: "join"; roomId: string; tgInitData: string; name: string }
  | { type: "create"; tgInitData: string; name: string; isPublic?: boolean; maxPlayers?: number }
  | { type: "ready" }
  | { type: "start" }
  | { type: "roll" }
  | { type: "buy" }
  | { type: "skipBuy" }
  | { type: "endTurn" }
  | { type: "payJail" }
  | { type: "useJailCard" }
  | { type: "chat"; text: string }
  | { type: "selectToken"; tokenId: string }
  | { type: "leave" }
  | { type: "destroyRoom" }
  | { type: "buildHouse"; tileIndex: number }
  | { type: "sellHouse"; tileIndex: number }
  | { type: "proposeTrade"; tileIndex: number; cash: number }
  | { type: "respondTrade"; accept: boolean }
  | { type: "mortgage"; tileIndex: number }
  | { type: "unmortgage"; tileIndex: number }
  | { type: "pickTripleTile"; tileIndex: number }
  | { type: "placeBid"; amount: number }
  | { type: "passAuction" }
  | { type: "voiceJoin" }
  | { type: "voiceLeave" }
  | { type: "voiceSignal"; toId: string; payload: VoiceSignalPayload };

// Payload for WebRTC signaling relayed via WS between two peers in the same room.
export type VoiceSignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

// ---------- Server → Client messages ----------
export type ServerMessage =
  | { type: "state"; room: RoomState }
  | { type: "error"; message: string }
  | { type: "joined"; roomId: string; playerId: string }
  | {
      type: "diceRolled";
      by: string;
      dice: [number, number];
      speedDie: SpeedDieFace | null;
      from: number;
      to: number;
    }
  | { type: "chat"; from: string; fromId: string; text: string; ts: number }
  | { type: "voicePeers"; peerIds: string[] }
  | { type: "voicePeerJoined"; peerId: string }
  | { type: "voicePeerLeft"; peerId: string }
  | { type: "voiceSignal"; fromId: string; payload: VoiceSignalPayload };
