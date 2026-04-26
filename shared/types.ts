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
  // Get-Out-of-Jail cards held by the player. Array (not count) so the
  // engine knows which deck to return each card to when it's used or
  // sold — Hasbro keeps the card out of its deck for as long as a
  // player owns it. UI: read `.length` for display / capability checks.
  getOutCards: ("chance" | "chest")[];
  bankrupt: boolean;
  ready: boolean;
  connected: boolean;
  // Host-added AI player. Plays every turn via the server's auto-act
  // logic with a shorter timer than humans. Always ready, never connected
  // (no WS), cannot host. `tgUserId` is synthetic (negative).
  isBot?: boolean;
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
  | "preRoll"
  | "rolling"
  | "moving"
  | "action"
  | "buyPrompt"
  | "auction"
  | "ended";

// Order-determining pre-roll bracket. Each bracket is a set of players still
// tied for a contiguous range of seats; rolling happens head-first (pending[0]
// is up next). When pending empties, the bracket is evaluated: unique rolls
// resolve to final seats; still-tied subsets become new brackets.
export interface PreRollBracket {
  playerIds: string[];
  rolls: Record<string, number>;
  pending: string[];
  // true when this bracket was spawned by a tie — UI uses it to differentiate
  // "first roll" from "re-roll" labels. The initial bracket (all players) is
  // false; any bracket created via resolveBracket() is true.
  isReRoll: boolean;
}

// Structured money-move metadata attached to log entries. The client uses it
// to render transaction toasts (e.g. "-100 → Alex" when you land on a rented
// tile) without brittle string parsing of the human-readable text.
export type TxnKind = "buy" | "rent" | "salary" | "tax" | "jail";
export interface TxnInfo {
  kind: TxnKind;
  amount: number; // always positive; client derives sign from my role
  actorId: string; // who triggered it (landing payer, buyer, taxpayer, ...)
  counterpartyId?: string; // rent owner on rent; undefined otherwise
  tileIndex?: number;
}

export interface GameLogEntry {
  id: string;
  ts: number;
  text: I18nText;
  txn?: TxnInfo;
}

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
  // What the initiator gives to the recipient.
  giveTiles: number[];
  giveCash: number;
  giveJailCards: number;
  // What the initiator wants in return.
  takeTiles: number[];
  takeCash: number;
  takeJailCards: number;
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
  doublesInARow: number;
  properties: Record<number, OwnedProperty>;
  log: GameLogEntry[];
  lastCard: DrawnCard | null;
  cardHistory: DrawnCard[];
  auction: AuctionState | null;
  pendingTrade: TradeOffer | null;
  winnerId: string | null;
  // Finite bank inventory (Hasbro rule). Decrement when a player builds,
  // increment when they sell or when property is cleared on bankruptcy.
  houseBank: number;
  hotelBank: number;
  createdAt: number;
  startedAt: number | null;
  // Pre-roll state: brackets of players rolling for seat order. Active bracket
  // is brackets[0]; order accumulates into `preRollOrder` as seats resolve.
  // `preRollRolls` is the flat "latest roll per player" view for UI.
  preRollBrackets: PreRollBracket[];
  preRollOrder: string[];
  preRollRolls: Record<string, number>;
  // Card decks as queues of indices into CHANCE_CARDS / CHEST_CARDS.
  // Hasbro: cards are drawn from the top of a shuffled deck and placed
  // at the bottom — except "Get Out of Jail Free" which is held by the
  // player until used or sold. Queues are seeded with a Fisher-Yates
  // shuffle in createRoom; engine.drawCard shifts from the front and
  // pushes back to the end (skipping jail cards), reshuffling when
  // empty.
  chanceQueue: number[];
  chestQueue: number[];
  // Tile indices waiting to be auctioned because a bankrupt-to-bank
  // freed them. Hasbro: when a player goes bankrupt to the bank, their
  // unmortgaged properties go to auction one by one. We process the
  // queue sequentially via finishAuction → startNextBankAuction so we
  // never have two auctions running at once.
  pendingBankAuctionTiles: number[];
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
  | {
      type: "proposeTrade";
      toId: string;
      giveTiles: number[];
      giveCash: number;
      giveJailCards: number;
      takeTiles: number[];
      takeCash: number;
      takeJailCards: number;
    }
  | { type: "respondTrade"; accept: boolean }
  | { type: "mortgage"; tileIndex: number }
  | { type: "unmortgage"; tileIndex: number }
  | { type: "placeBid"; amount: number }
  | { type: "passAuction" }
  | { type: "addBot" }
  | { type: "removeBot"; playerId: string }
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
      from: number;
      to: number;
    }
  | { type: "chat"; from: string; fromId: string; text: string; ts: number }
  | { type: "voicePeers"; peerIds: string[] }
  | { type: "voicePeerJoined"; peerId: string }
  | { type: "voicePeerLeft"; peerId: string }
  | { type: "voiceSignal"; fromId: string; payload: VoiceSignalPayload };
