/**
 * 🎣 USE POKER HOOK — REAL-TIME TABLE CONNECTION
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * React hook for connecting to live poker tables via Supabase Realtime.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { pokerService, type PokerTableRow, type PokerPlayerRow, type TablePresence } from '../services/poker-realtime';
import type { TableListItem, ActionType, Player, TableState, TableConfig } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 🏠 USE POKER LOBBY HOOK
// ═══════════════════════════════════════════════════════════════════════════

export interface UsePokerLobbyResult {
    tables: TableListItem[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createTable: (config: Partial<TableConfig>) => Promise<{ success: boolean; tableId?: string; error?: string }>;
}

export function usePokerLobby(): UsePokerLobbyResult {
    const [tables, setTables] = useState<TableListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTables = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await pokerService.fetchTables();
            setTables(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch tables');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTables();

        // Refresh every 10 seconds
        const interval = setInterval(fetchTables, 10000);
        return () => clearInterval(interval);
    }, [fetchTables]);

    const createTable = useCallback(async (config: Partial<TableConfig>) => {
        const result = await pokerService.createTable(config);
        if (result.success) {
            await fetchTables(); // Refresh after creation
        }
        return result;
    }, [fetchTables]);

    return {
        tables,
        isLoading,
        error,
        refresh: fetchTables,
        createTable,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 USE POKER TABLE HOOK
// ═══════════════════════════════════════════════════════════════════════════

export interface UsePokerTableResult {
    // Connection State
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;

    // Table State
    tableInfo: PokerTableRow | null;
    players: PokerPlayerRow[];
    onlinePlayers: TablePresence[];

    // Hero State
    heroSeat: number | null;
    isMyTurn: boolean;
    myChips: number;

    // Actions
    seatPlayer: (seatNumber: number, buyInAmount: number) => Promise<boolean>;
    leaveTable: () => Promise<{ chipsReturned: number; profit: number } | null>;
    sendAction: (action: ActionType, amount?: number) => Promise<void>;
    disconnect: () => void;
}

export function usePokerTable(tableId: string, userId: string): UsePokerTableResult {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [tableInfo, setTableInfo] = useState<PokerTableRow | null>(null);
    const [players, setPlayers] = useState<PokerPlayerRow[]>([]);
    const [onlinePlayers, setOnlinePlayers] = useState<TablePresence[]>([]);

    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Derived state
    const heroPlayer = players.find(p => p.user_id === userId);
    const heroSeat = heroPlayer?.seat_number ?? null;
    const isMyTurn = heroPlayer?.is_turn ?? false;
    const myChips = heroPlayer?.chip_stack ?? 0;

    // Connect to table
    useEffect(() => {
        let mounted = true;

        const connect = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const result = await pokerService.joinTable(tableId, userId);

                if (!mounted) return;

                if (result.success && result.tableState) {
                    setTableInfo(result.tableState);
                    setPlayers(result.players || []);
                    setIsConnected(true);

                    // Subscribe to events
                    unsubscribeRef.current = pokerService.onTableEvent((event) => {
                        if (!mounted) return;

                        switch (event.type) {
                            case 'TABLE_UPDATE':
                                setTableInfo(event.data as PokerTableRow);
                                break;

                            case 'PLAYER_UPDATE':
                                const payload = event.data as any;
                                if (payload.eventType === 'INSERT') {
                                    setPlayers(prev => [...prev, payload.new as PokerPlayerRow]);
                                } else if (payload.eventType === 'UPDATE') {
                                    setPlayers(prev =>
                                        prev.map(p => p.id === payload.new.id ? payload.new : p)
                                    );
                                } else if (payload.eventType === 'DELETE') {
                                    setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
                                }
                                break;

                            case 'PRESENCE_CHANGE':
                                const presenceData = event.data as any;
                                if (presenceData.event === 'sync') {
                                    setOnlinePlayers(presenceData.players);
                                }
                                break;

                            case 'ACTION':
                                console.log('🎯 Action received:', event.data);
                                break;
                        }
                    });
                } else {
                    setError(result.error || 'Failed to join table');
                }
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : 'Connection failed');
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        connect();

        return () => {
            mounted = false;
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
            pokerService.unsubscribe();
        };
    }, [tableId, userId]);

    // Seat at table
    const seatPlayer = useCallback(async (seatNumber: number, buyInAmount: number): Promise<boolean> => {
        const result = await pokerService.seatPlayer(tableId, seatNumber, buyInAmount);
        if (!result.success) {
            setError(result.error || 'Failed to seat');
        }
        return result.success;
    }, [tableId]);

    // Leave table
    const leaveTable = useCallback(async (): Promise<{ chipsReturned: number; profit: number } | null> => {
        const result = await pokerService.leaveTable(tableId);
        if (result.success) {
            return {
                chipsReturned: result.chipsReturned || 0,
                profit: result.profit || 0,
            };
        }
        setError(result.error || 'Failed to leave table');
        return null;
    }, [tableId]);

    // Send action
    const sendAction = useCallback(async (action: ActionType, amount?: number): Promise<void> => {
        await pokerService.broadcastAction(action, amount);
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }
        pokerService.unsubscribe();
        setIsConnected(false);
    }, []);

    return {
        isConnected,
        isLoading,
        error,
        tableInfo,
        players,
        onlinePlayers,
        heroSeat,
        isMyTurn,
        myChips,
        seatPlayer,
        leaveTable,
        sendAction,
        disconnect,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 HELPER: CONVERT DB ROW TO CLIENT STATE
// ═══════════════════════════════════════════════════════════════════════════

export function dbRowToPlayer(row: PokerPlayerRow, heroId: string): Player {
    return {
        id: row.user_id,
        username: row.profiles?.username || 'Player',
        avatarUrl: row.profiles?.avatar_url || undefined,
        seatNumber: row.seat_number,
        chipStack: row.chip_stack,
        currentBet: row.current_bet,
        totalBetThisHand: row.total_bet_this_hand,
        holeCards: row.hole_cards,
        status: row.status,
        isDealer: row.is_dealer,
        isTurn: row.is_turn,
        timeBank: row.time_bank,
        lastAction: row.last_action ? {
            type: row.last_action as ActionType,
            amount: row.last_action_amount || undefined,
            timestamp: new Date(),
        } : undefined,
        isHero: row.user_id === heroId,
    };
}

export function dbRowToTableConfig(row: PokerTableRow): TableConfig {
    return {
        id: row.id,
        name: row.name,
        gameType: row.game_type,
        tableSize: row.table_size,
        bettingStructure: row.betting_structure,
        smallBlind: row.small_blind,
        bigBlind: row.big_blind,
        ante: row.ante,
        minBuyIn: row.min_buy_in,
        maxBuyIn: row.max_buy_in,
        timeLimit: row.time_limit,
        isPrivate: row.is_private,
        createdAt: new Date(row.created_at),
    };
}

export default { usePokerLobby, usePokerTable };
