/**
 * 🃏 DIAMOND ARENA — POKER TYPE DEFINITIONS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Complete type system for Texas Hold'em poker engine.
 * All monetary values are in Diamonds (💎)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🃏 CARD SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
    rank: Rank;
    suit: Suit;
}

export type HandRank =
    | 'HIGH_CARD'
    | 'PAIR'
    | 'TWO_PAIR'
    | 'THREE_OF_A_KIND'
    | 'STRAIGHT'
    | 'FLUSH'
    | 'FULL_HOUSE'
    | 'FOUR_OF_A_KIND'
    | 'STRAIGHT_FLUSH'
    | 'ROYAL_FLUSH';

export interface EvaluatedHand {
    rank: HandRank;
    rankValue: number;      // 1-10 for comparison
    kickers: number[];      // For tie-breaking
    description: string;    // "Pair of Aces"
    cards: Card[];          // Best 5 cards
}

// ═══════════════════════════════════════════════════════════════════════════
// 👤 PLAYER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export type PlayerStatus =
    | 'WAITING'     // At table, not in hand
    | 'SITTING_OUT' // Away from table
    | 'ACTIVE'      // In current hand
    | 'FOLDED'      // Folded this hand
    | 'ALL_IN'      // All chips committed
    | 'DISCONNECTED'; // Lost connection

export interface Player {
    id: string;
    username: string;
    avatarUrl?: string;
    seatNumber: number;     // 1-9 for 9-max tables
    chipStack: number;      // Current diamonds at table
    currentBet: number;     // Amount bet this round
    totalBetThisHand: number;
    holeCards: Card[] | null;  // Only visible to player/showdown
    status: PlayerStatus;
    isDealer: boolean;
    isTurn: boolean;
    timeBank: number;       // Seconds remaining in time bank
    lastAction?: PlayerAction;
    isHero?: boolean;       // Current user's perspective
}

export type ActionType =
    | 'FOLD'
    | 'CHECK'
    | 'CALL'
    | 'BET'
    | 'RAISE'
    | 'ALL_IN';

export interface PlayerAction {
    type: ActionType;
    amount?: number;        // For bet/raise
    timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 TABLE & GAME STATE
// ═══════════════════════════════════════════════════════════════════════════

export type GameType = 'CASH' | 'SIT_N_GO' | 'TOURNAMENT';
export type TableSize = 2 | 6 | 9;  // Heads-up, 6-max, 9-max
export type BettingStructure = 'NO_LIMIT' | 'POT_LIMIT' | 'FIXED_LIMIT';

export type Street =
    | 'WAITING'     // No hand in progress
    | 'PREFLOP'
    | 'FLOP'
    | 'TURN'
    | 'RIVER'
    | 'SHOWDOWN';

export interface TableConfig {
    id: string;
    name: string;
    gameType: GameType;
    tableSize: TableSize;
    bettingStructure: BettingStructure;
    smallBlind: number;     // In diamonds
    bigBlind: number;
    minBuyIn: number;       // Minimum to sit
    maxBuyIn: number;       // Maximum to sit
    ante?: number;          // Optional ante
    timeLimit: number;      // Seconds per action
    isPrivate: boolean;
    createdAt: Date;
    variant?: 'NLH' | 'PLO' | 'PLO5' | 'PLO6' | 'PLO8';
}

export type PokerVariant = 'NLH' | 'PLO' | 'PLO5' | 'PLO6' | 'PLO8';

export interface Pot {
    amount: number;
    eligiblePlayers: string[];  // Player IDs
    isMainPot: boolean;
    isClosed: boolean;
}

export interface TableState {
    config: TableConfig;

    // Seats
    seats: (Player | null)[];   // Index = seat number - 1

    // Game State
    handNumber: number;
    street: Street;
    dealerSeat: number;
    smallBlindSeat: number;
    bigBlindSeat: number;

    // Cards
    communityCards: Card[];
    deck: Card[];               // Remaining deck (server only)

    // Betting
    pots: Pot[];
    currentBet: number;         // Amount to call
    minRaise: number;           // Minimum raise amount

    // Turn Management
    activePlayerSeat: number | null;
    lastAggressorSeat: number | null;
    actionTimeout: Date | null;

    // History
    handHistory: HandHistoryEntry[];

    // Meta
    isRunning: boolean;
    isPaused: boolean;
    spectatorCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📜 HAND HISTORY
// ═══════════════════════════════════════════════════════════════════════════

export interface HandHistoryEntry {
    handId: string;
    timestamp: Date;
    type: 'ACTION' | 'CARD_DEALT' | 'STREET_CHANGE' | 'WINNER' | 'SYSTEM';
    playerId?: string;
    action?: ActionType;
    amount?: number;
    cards?: Card[];
    street?: Street;
    message?: string;
}

export interface CompletedHand {
    handId: string;
    tableId: string;
    handNumber: number;
    startedAt: Date;
    endedAt: Date;
    players: {
        id: string;
        username: string;
        seat: number;
        startingStack: number;
        endingStack: number;
        holeCards?: Card[];
        profit: number;
    }[];
    communityCards: Card[];
    pots: {
        amount: number;
        winners: string[];
    }[];
    history: HandHistoryEntry[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏠 LOBBY TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TableListItem {
    id: string;
    name: string;
    gameType: GameType;
    variant?: PokerVariant; // e.g. NLH, PLO
    tableSize: TableSize;
    stakes: string;             // "10/20" format
    playerCount: number;
    waitlistCount: number;
    averagePot: number;
    handsPerHour: number;
    isPrivate: boolean;
    minBuyIn: number;
    maxBuyIn: number;
}

export interface Tournament {
    id: string;
    name: string;
    variant: PokerVariant;
    buyIn: number;
    fee: number;
    prizePool: number;
    guaranteedPool: number;
    startTime: Date;
    status: 'REGISTERING' | 'LATE_REG' | 'RUNNING' | 'COMPLETED' | 'ANNOUNCED' | 'CANCELLED';
    entryCount: number;
    maxEntries: number;
    tableSize: number;
    blindsUp: number; // minutes or level duration
    startingChips: number;
    isReentry: boolean;
    lateRegLevel: number;
}

export interface TournamentDetails extends Tournament {
    description: string;
    blindStructure: string; // e.g., "Turbo (5 min)"
    payoutStructure: string; // e.g., "Top 15%"
    registeredPlayers: {
        userId: string;
        username: string;
        avatarUrl?: string;
    }[];
}

export interface LobbyFilters {
    gameType?: GameType;
    stakes?: 'MICRO' | 'LOW' | 'MEDIUM' | 'HIGH';
    tableSize?: TableSize;
    hideEmpty?: boolean;
    hideFull?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 ACTION REQUESTS
// ═══════════════════════════════════════════════════════════════════════════

export interface ActionRequest {
    tableId: string;
    playerId: string;
    action: ActionType;
    amount?: number;
}

export interface SeatRequest {
    tableId: string;
    playerId: string;
    seatNumber: number;
    buyInAmount: number;
}

export interface LeaveTableRequest {
    tableId: string;
    playerId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📡 REAL-TIME EVENTS
// ═══════════════════════════════════════════════════════════════════════════

export type TableEventType =
    | 'PLAYER_JOINED'
    | 'PLAYER_LEFT'
    | 'PLAYER_ACTION'
    | 'CARDS_DEALT'
    | 'STREET_CHANGED'
    | 'POT_UPDATED'
    | 'HAND_COMPLETE'
    | 'PLAYER_TURN'
    | 'PLAYER_TIMEOUT'
    | 'CHAT_MESSAGE'
    | 'TABLE_PAUSED'
    | 'TABLE_RESUMED';

export interface TableEvent {
    type: TableEventType;
    tableId: string;
    handNumber: number;
    timestamp: Date;
    data: unknown;
}
