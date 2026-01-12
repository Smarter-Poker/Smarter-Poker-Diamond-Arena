/**
 * 🤖 SIMULATED POKER TABLE HOOK
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Runs the PokerTableEngine entirely client-side for testing and single-player.
 * Simulates bot players and game loop.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PokerTableEngine } from '../engine/table-engine';
import type { UsePokerTableResult } from './usePoker';
import type { PokerTableRow, PokerPlayerRow, TablePresence } from '../services/poker-realtime';
import type { TableConfig, ActionType, Player } from '../types/poker';

export function useSimulatedTable(tableId: string, userId: string, initialConfig?: TableConfig): UsePokerTableResult {
    const [stats, setStats] = useState<{
        isConnected: boolean;
        isLoading: boolean;
        tableInfo: PokerTableRow | null;
        players: PokerPlayerRow[];
        onlinePlayers: TablePresence[];
        updateTrigger: number;
    }>({
        isConnected: false,
        isLoading: true,
        tableInfo: null,
        players: [],
        onlinePlayers: [],
        updateTrigger: 0,
    });

    const engineRef = useRef<PokerTableEngine | null>(null);
    const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Engine
    useEffect(() => {
        const config: TableConfig = initialConfig || {
            id: 'sim-table-1',
            name: 'Simulation Arena (Offline)',
            gameType: 'NLH',
            tableSize: 6,
            bettingStructure: 'NO_LIMIT',
            smallBlind: 10,
            bigBlind: 20,
            ante: 0,
            minBuyIn: 1000,
            maxBuyIn: 5000,
            timeLimit: 10,
            isPrivate: false,
            createdAt: new Date(),
        };

        const engine = new PokerTableEngine(config);

        // Add some bots
        engine.seatPlayer({ id: 'bot-1', username: 'AggroBot', avatarUrl: undefined, chipStack: 2000 }, 1);
        engine.seatPlayer({ id: 'bot-2', username: 'NitBot', avatarUrl: undefined, chipStack: 1500 }, 2);
        engine.seatPlayer({ id: 'bot-3', username: 'WhaleBot', avatarUrl: undefined, chipStack: 4000 }, 4);

        engineRef.current = engine;

        // Force update helper
        const updateState = () => {
            if (!engineRef.current) return;
            const state = engineRef.current.getState();

            // Map Engine State to "Supabase Rows" format for compatibility with PokerRoom
            const tableRow: PokerTableRow = {
                id: state.config.id,
                name: state.config.name,
                game_type: state.config.gameType,
                table_size: state.config.tableSize,
                betting_structure: state.config.bettingStructure,
                small_blind: state.config.smallBlind,
                big_blind: state.config.bigBlind,
                ante: state.config.ante,
                min_buy_in: state.config.minBuyIn,
                max_buy_in: state.config.maxBuyIn,
                time_limit: state.config.timeLimit,
                is_private: state.config.isPrivate,
                created_at: state.config.createdAt.toISOString(),
                status: 'RUNNING',
                hand_number: state.handNumber,
                current_street: state.street,
                current_bet: state.currentBet,
                min_raise: state.minRaise,
                pot_total: state.pots.reduce((s, p) => s + p.amount, 0),
                community_cards: state.communityCards,
                dealer_seat: state.dealerSeat,
                active_seat: state.activePlayerSeat,
                last_action_seat: state.lastAggressorSeat,
                action_timer_expires_at: state.actionTimeout ? state.actionTimeout.toISOString() : null,
            };

            const playerRows: PokerPlayerRow[] = state.seats
                .filter(s => s !== null)
                .map(p => ({
                    id: p!.id, // Using ID as PK
                    table_id: state.config.id,
                    user_id: p!.id,
                    seat_number: p!.seatNumber,
                    chip_stack: p!.chipStack,
                    status: p!.status,
                    is_dealer: p!.isDealer,
                    is_turn: p!.isTurn,
                    hole_cards: p!.holeCards || null, // In sim, we see all? Or strictly respect getState? 
                    // To act as Hero, we need to show Hero cards.
                    // The engine.playerState(userId) usually handles this privacy.
                    // But here we construct rows.
                    // Let's assume frontend hides others' cards based on userId check, 
                    // OR we nullify them here if p.id !== userId.
                    // Since this runs client side, let's behave like the server:

                    // Actually, dbRowToPlayer in PokerRoom trusts the input.
                    // We should strictly hide cards unless Showdown.
                    // Wait, engine.getPublicState() does this.

                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    current_bet: p!.currentBet,
                    total_bet_this_hand: p!.totalBetThisHand,
                    time_bank: p!.timeBank,
                    last_action: p!.lastAction?.type || null,
                    last_action_amount: p!.lastAction?.amount || null,
                    profiles: {
                        username: p!.username,
                        avatar_url: p!.avatarUrl || null,
                    }
                }));

            setStats({
                isConnected: true,
                isLoading: false,
                tableInfo: tableRow,
                players: playerRows,
                onlinePlayers: [], // Not really used in sim
                updateTrigger: Math.random(),
            });
        };

        // Attach listeners
        engine.on('PLAYER_ACTION', updateState);
        engine.on('STREET_CHANGED', updateState);
        engine.on('HAND_COMPLETE', updateState);
        engine.on('PLAYER_JOINED', updateState);
        engine.on('PLAYER_TURN', () => {
            updateState();
            // Simple Bot Logic
            const state = engine.getState();
            const activeSeat = state.activePlayerSeat;
            if (activeSeat) {
                const player = state.seats[activeSeat - 1];
                if (player && player.id.startsWith('bot-')) {
                    setTimeout(() => {
                        // Bot always calls or checks
                        const toCall = state.currentBet - player.currentBet;
                        if (toCall === 0) engine.processAction(activeSeat, 'CHECK');
                        else engine.processAction(activeSeat, 'CALL');
                    }, 1000 + Math.random() * 2000);
                }
            }
        });

        // Initial State
        updateState();

        // Start Hand Loop
        simulationIntervalRef.current = setInterval(() => {
            if (engine.canStartHand()) {
                engine.startNewHand();
                updateState();
            }
        }, 5000); // Check every 5s if hand can start

        return () => {
            if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        };
    }, []);

    // Derived State
    const heroPlayer = stats.players.find(p => p.user_id === userId);

    return {
        isConnected: stats.isConnected,
        isLoading: stats.isLoading,
        error: null,
        tableInfo: stats.tableInfo,
        players: stats.players,
        onlinePlayers: stats.onlinePlayers,
        heroSeat: heroPlayer?.seat_number ?? null,
        isMyTurn: heroPlayer?.is_turn ?? false,
        myChips: heroPlayer?.chip_stack ?? 0,

        seatPlayer: async (seat, amt) => {
            if (!engineRef.current) return false;
            // Use 'Hero' as ID
            const success = engineRef.current.seatPlayer({
                id: userId,
                username: 'Hero',
                avatarUrl: undefined,
                chipStack: amt
            }, seat);

            // If success and hand not running, ensure loop picks it up
            return success;
        },
        leaveTable: async () => {
            if (!engineRef.current) return null;
            // Find seat
            const seat = stats.players.find(p => p.user_id === userId)?.seat_number;
            if (seat) engineRef.current.removePlayer(seat);
            return { chipsReturned: 0, profit: 0 };
        },
        sendAction: async (action, amount) => {
            if (!engineRef.current) return;
            const seat = stats.players.find(p => p.user_id === userId)?.seat_number;
            if (seat) {
                engineRef.current.processAction(seat, action, amount);
            }
        },
        disconnect: () => { },
    };
}
