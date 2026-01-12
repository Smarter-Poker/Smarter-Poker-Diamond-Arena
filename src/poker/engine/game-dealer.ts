/**
 * 🎰 GAME DEALER SERVICE — MULTIPLAYER GAME HOST
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Server-side (or host-client) game orchestrator that:
 * 1. Manages game state via PokerTableEngine
 * 2. Broadcasts state changes via Supabase Realtime
 * 3. Handles turn timers and auto-fold
 * 4. Syncs player actions from multiple clients
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { PokerTableEngine } from './table-engine';
import type { TableConfig, ActionType, Player, TableState } from '../types/poker';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 GAME DEALER SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class GameDealerService {
    private engine: PokerTableEngine;
    private channel: RealtimeChannel | null = null;
    private turnTimer: NodeJS.Timeout | null = null;
    private tableId: string;
    private turnTimeLimit: number;
    private isRunning: boolean = false;

    // Callbacks for state changes
    private onStateChange?: (state: TableState) => void;

    constructor(config: TableConfig) {
        this.engine = new PokerTableEngine(config);
        this.tableId = config.id;
        this.turnTimeLimit = config.timeLimit * 1000; // Convert to ms

        // Subscribe to engine events
        this.engine.on('PLAYER_ACTION', () => this.broadcastState());
        this.engine.on('STREET_CHANGED', () => this.broadcastState());
        this.engine.on('HAND_COMPLETE', () => this.handleHandComplete());
        this.engine.on('PLAYER_TURN', () => this.handleTurnChange());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔌 CONNECTION & LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Start the dealer service and connect to Supabase for multiplayer
     */
    async start(): Promise<void> {
        if (!isSupabaseConfigured()) {
            console.log('🎰 [Dealer] Running in local-only mode (no Supabase)');
            this.isRunning = true;
            return;
        }

        // Create broadcast channel for game actions
        this.channel = supabase.channel(`game:${this.tableId}`, {
            config: {
                broadcast: { ack: true },
            },
        });

        // Listen for player actions from clients
        this.channel.on('broadcast', { event: 'player_action' }, (payload) => {
            const { seatNumber, action, amount, userId } = payload.payload;
            this.handleRemoteAction(seatNumber, action, amount, userId);
        });

        // Listen for seat requests
        this.channel.on('broadcast', { event: 'seat_request' }, (payload) => {
            const { player, seatNumber } = payload.payload;
            this.handleSeatRequest(player, seatNumber);
        });

        await this.channel.subscribe();
        this.isRunning = true;
        console.log(`🎰 [Dealer] Started for table ${this.tableId}`);
    }

    /**
     * Stop the dealer service
     */
    stop(): void {
        this.isRunning = false;
        this.clearTurnTimer();

        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }

        console.log(`🎰 [Dealer] Stopped for table ${this.tableId}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎴 GAME FLOW CONTROL
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Check if conditions are met to start a new hand
     */
    canStartHand(): boolean {
        const activePlayers = this.engine.getSeatedPlayers().filter(
            p => p.status !== 'SITTING_OUT' && p.chipStack > 0
        );
        return activePlayers.length >= 2;
    }

    /**
     * Start a new hand if conditions are met
     */
    startHandIfReady(): boolean {
        if (!this.canStartHand()) {
            console.log('🎰 [Dealer] Not enough players to start hand');
            return false;
        }

        const state = this.engine.getState();
        if (state.street !== 'WAITING') {
            console.log('🎰 [Dealer] Hand already in progress');
            return false;
        }

        this.engine.startNewHand();
        this.broadcastState();
        this.startTurnTimer();

        console.log(`🎰 [Dealer] Started hand #${this.engine.getState().handNumber}`);
        return true;
    }

    /**
     * Process a player action
     */
    processAction(seatNumber: number, action: ActionType, amount?: number): boolean {
        const success = this.engine.processAction(seatNumber, action, amount);

        if (success) {
            this.broadcastState();

            // Check if we need to set new turn timer
            const state = this.engine.getState();
            if (state.activePlayerSeat !== null && state.street !== 'SHOWDOWN') {
                this.startTurnTimer();
            }
        }

        return success;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ⏱️ TURN TIMER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    private startTurnTimer(): void {
        this.clearTurnTimer();

        const state = this.engine.getState();
        const activePlayer = state.activePlayerSeat !== null
            ? state.seats[state.activePlayerSeat - 1]
            : null;

        if (!activePlayer) return;

        console.log(`⏱️ [Timer] ${activePlayer.username} has ${this.turnTimeLimit / 1000}s to act`);

        this.turnTimer = setTimeout(() => {
            this.handleTimeout();
        }, this.turnTimeLimit);
    }

    private clearTurnTimer(): void {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
    }

    private handleTimeout(): void {
        const state = this.engine.getState();
        const activeSeat = state.activePlayerSeat;

        if (activeSeat === null) return;

        const player = state.seats[activeSeat - 1];
        if (!player) return;

        console.log(`⏱️ [Timer] ${player.username} timed out - auto-folding`);

        // Auto-fold (or check if possible)
        const toCall = state.currentBet - player.currentBet;
        if (toCall === 0) {
            this.processAction(activeSeat, 'CHECK');
        } else {
            this.processAction(activeSeat, 'FOLD');
        }
    }

    private handleTurnChange(): void {
        // This is called by the engine when turn changes
        const state = this.engine.getState();
        if (state.activePlayerSeat !== null && state.street !== 'SHOWDOWN') {
            this.startTurnTimer();
        } else {
            this.clearTurnTimer();
        }
    }

    private handleHandComplete(): void {
        this.clearTurnTimer();
        console.log('🎰 [Dealer] Hand complete, broadcasting results');
        this.broadcastState();

        // Auto-start next hand after delay
        setTimeout(() => {
            this.startHandIfReady();
        }, 3000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📡 MULTIPLAYER SYNC
    // ═══════════════════════════════════════════════════════════════════════

    private handleRemoteAction(
        seatNumber: number,
        action: ActionType,
        amount: number | undefined,
        userId: string
    ): void {
        // Verify the action is from the correct player
        const state = this.engine.getState();
        const player = state.seats[seatNumber - 1];

        if (!player || player.id !== userId) {
            console.warn('🎰 [Dealer] Invalid action - seat/user mismatch');
            return;
        }

        this.processAction(seatNumber, action, amount);
    }

    private handleSeatRequest(player: Omit<Player, 'seatNumber'>, seatNumber: number): void {
        const success = this.engine.seatPlayer(player, seatNumber);

        if (success) {
            this.broadcastState();

            // Try to start hand if we have enough players
            setTimeout(() => {
                this.startHandIfReady();
            }, 1000);
        }
    }

    private async broadcastState(): Promise<void> {
        const state = this.engine.getState();

        // Notify local callback
        if (this.onStateChange) {
            this.onStateChange(state);
        }

        // Broadcast to remote clients
        if (this.channel) {
            await this.channel.send({
                type: 'broadcast',
                event: 'state_update',
                payload: {
                    state: this.sanitizeStateForBroadcast(state),
                    timestamp: Date.now(),
                },
            });
        }

        // Also persist critical state to database
        await this.persistTableState(state);
    }

    /**
     * Remove private info (hole cards of other players) before broadcast
     */
    private sanitizeStateForBroadcast(state: TableState): TableState {
        // In showdown, all cards are visible
        if (state.street === 'SHOWDOWN') {
            return state;
        }

        // Otherwise, hide hole cards (each client reveals their own)
        return {
            ...state,
            seats: state.seats.map(seat => {
                if (!seat) return null;
                return {
                    ...seat,
                    holeCards: null, // Client will inject their own cards
                };
            }),
        };
    }

    private async persistTableState(state: TableState): Promise<void> {
        if (!isSupabaseConfigured()) return;

        try {
            await supabase
                .from('poker_tables')
                .update({
                    hand_number: state.handNumber,
                    current_street: state.street,
                    current_bet: state.currentBet,
                    min_raise: state.minRaise,
                    pot_total: state.pots.reduce((s, p) => s + p.amount, 0),
                    community_cards: state.communityCards,
                    dealer_seat: state.dealerSeat,
                    active_seat: state.activePlayerSeat,
                })
                .eq('id', this.tableId);
        } catch (err) {
            console.error('🎰 [Dealer] Failed to persist state:', err);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════

    getState(): TableState {
        return this.engine.getState();
    }

    getPlayerState(playerId: string): ReturnType<PokerTableEngine['getPlayerState']> {
        return this.engine.getPlayerState(playerId);
    }

    seatPlayer(player: Omit<Player, 'seatNumber'>, seatNumber: number): boolean {
        return this.engine.seatPlayer(player, seatNumber);
    }

    removePlayer(seatNumber: number): Player | null {
        return this.engine.removePlayer(seatNumber);
    }

    setOnStateChange(callback: (state: TableState) => void): void {
        this.onStateChange = callback;
    }

    getEngine(): PokerTableEngine {
        return this.engine;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function createGameDealer(config: TableConfig): GameDealerService {
    return new GameDealerService(config);
}

export default GameDealerService;
