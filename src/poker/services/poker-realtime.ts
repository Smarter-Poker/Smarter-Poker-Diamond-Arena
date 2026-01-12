/**
 * 🔌 POKER REALTIME SERVICE — SUPABASE MULTIPLAYER
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Live multiplayer poker using Supabase Realtime channels.
 * Handles table subscriptions, player presence, and action broadcasting.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import type {
    TableState,
    TableConfig,
    Player,
    ActionType,
    TableListItem,
    Card,
} from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 📡 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PokerTableRow {
    id: string;
    name: string;
    game_type: 'CASH' | 'SIT_N_GO' | 'TOURNAMENT';
    table_size: 2 | 6 | 9;
    betting_structure: 'NO_LIMIT' | 'POT_LIMIT' | 'FIXED_LIMIT';
    small_blind: number;
    big_blind: number;
    ante: number;
    min_buy_in: number;
    max_buy_in: number;
    time_limit: number;
    is_private: boolean;
    status: 'WAITING' | 'RUNNING' | 'PAUSED' | 'CLOSED';
    hand_number: number;
    current_street: string;
    dealer_seat: number | null;
    active_seat: number | null;
    community_cards: Card[];
    pot_total: number;
    current_bet: number;
    min_raise: number | null;
    hands_played: number;
    average_pot: number;
    created_by: string | null;
    created_at: string;
}

export interface PokerPlayerRow {
    id: string;
    table_id: string;
    user_id: string;
    seat_number: number;
    chip_stack: number;
    buy_in_amount: number;
    current_bet: number;
    total_bet_this_hand: number;
    hole_cards: Card[] | null;
    status: 'WAITING' | 'SITTING_OUT' | 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'DISCONNECTED';
    is_dealer: boolean;
    is_turn: boolean;
    time_bank: number;
    last_action: string | null;
    last_action_amount: number | null;
    profiles?: {
        username: string;
        avatar_url: string | null;
    };
}

export interface TablePresence {
    odiserId: string;
    odiserName: string;
    onlineAt: string;
}

export type TableEventHandler = (event: {
    type: 'TABLE_UPDATE' | 'PLAYER_UPDATE' | 'PRESENCE_CHANGE' | 'ACTION';
    data: unknown;
}) => void;

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 POKER REALTIME SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class PokerRealtimeService {
    private tableChannel: RealtimeChannel | null = null;
    private presenceChannel: RealtimeChannel | null = null;
    private currentTableId: string | null = null;
    private eventHandlers: Set<TableEventHandler> = new Set();
    private presence: Map<string, TablePresence> = new Map();

    // ═══════════════════════════════════════════════════════════════════════
    // 🏠 LOBBY OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Fetch all available poker tables
     */
    async fetchTables(): Promise<TableListItem[]> {
        if (!isSupabaseConfigured()) {
            return this.getMockTables();
        }

        const { data: tables, error } = await supabase
            .from('poker_tables')
            .select(`
                id,
                name,
                game_type,
                table_size,
                small_blind,
                big_blind,
                is_private,
                status,
                hands_played,
                average_pot
            `)
            .in('status', ['WAITING', 'RUNNING'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Failed to fetch tables:', error);
            return this.getMockTables();
        }

        // Get player counts for each table
        const tableIds = tables.map(t => t.id);
        const { data: playerCounts } = await supabase
            .from('poker_players')
            .select('table_id')
            .in('table_id', tableIds);

        const countMap = new Map<string, number>();
        playerCounts?.forEach(p => {
            countMap.set(p.table_id, (countMap.get(p.table_id) || 0) + 1);
        });

        return tables.map(table => ({
            id: table.id,
            name: table.name,
            gameType: table.game_type,
            tableSize: table.table_size,
            stakes: `${table.small_blind}/${table.big_blind}`,
            playerCount: countMap.get(table.id) || 0,
            waitlistCount: 0,
            averagePot: table.average_pot || 0,
            handsPerHour: 60,
            isPrivate: table.is_private,
        }));
    }

    private getMockTables(): TableListItem[] {
        return [
            { id: 'mock-1', name: 'Diamond Ring #1', gameType: 'CASH', tableSize: 9, stakes: '10/20', playerCount: 5, waitlistCount: 0, averagePot: 450, handsPerHour: 65, isPrivate: false },
            { id: 'mock-2', name: 'Diamond Ring #2', gameType: 'CASH', tableSize: 9, stakes: '10/20', playerCount: 8, waitlistCount: 2, averagePot: 520, handsPerHour: 58, isPrivate: false },
            { id: 'mock-3', name: 'High Roller', gameType: 'CASH', tableSize: 6, stakes: '100/200', playerCount: 4, waitlistCount: 0, averagePot: 4200, handsPerHour: 72, isPrivate: false },
            { id: 'mock-4', name: 'Micro Grind', gameType: 'CASH', tableSize: 6, stakes: '1/2', playerCount: 6, waitlistCount: 0, averagePot: 35, handsPerHour: 80, isPrivate: false },
        ];
    }

    /**
     * Create a new poker table
     */
    async createTable(config: Partial<TableConfig>): Promise<{ success: boolean; tableId?: string; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: true, tableId: 'mock-' + Date.now() };
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'Must be logged in to create a table' };
        }

        const { data, error } = await supabase
            .from('poker_tables')
            .insert({
                name: config.name || 'New Table',
                game_type: config.gameType || 'CASH',
                table_size: config.tableSize || 9,
                betting_structure: config.bettingStructure || 'NO_LIMIT',
                small_blind: config.smallBlind || 10,
                big_blind: config.bigBlind || 20,
                min_buy_in: config.minBuyIn || 400,
                max_buy_in: config.maxBuyIn || 2000,
                time_limit: config.timeLimit || 30,
                is_private: config.isPrivate || false,
                created_by: user.id,
            })
            .select('id')
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, tableId: data.id };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎰 TABLE OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Join a poker table and subscribe to real-time updates
     */
    async joinTable(tableId: string, userId: string): Promise<{
        success: boolean;
        tableState?: PokerTableRow;
        players?: PokerPlayerRow[];
        error?: string;
    }> {
        if (!isSupabaseConfigured()) {
            return { success: true, tableState: this.getMockTableState(tableId), players: [] };
        }

        // Fetch table data
        const { data: tableData, error: tableError } = await supabase
            .from('poker_tables')
            .select('*')
            .eq('id', tableId)
            .single();

        if (tableError || !tableData) {
            return { success: false, error: 'Table not found' };
        }

        // Fetch seated players with profiles
        const { data: players, error: playersError } = await supabase
            .from('poker_players')
            .select(`
                *,
                profiles:user_id (
                    username,
                    avatar_url
                )
            `)
            .eq('table_id', tableId);

        if (playersError) {
            console.error('❌ Failed to fetch players:', playersError);
        }

        // Subscribe to table updates
        this.subscribeToTable(tableId, userId);

        return {
            success: true,
            tableState: tableData as PokerTableRow,
            players: (players || []) as PokerPlayerRow[],
        };
    }

    private getMockTableState(tableId: string): PokerTableRow {
        return {
            id: tableId,
            name: 'Diamond Ring #1',
            game_type: 'CASH',
            table_size: 9,
            betting_structure: 'NO_LIMIT',
            small_blind: 10,
            big_blind: 20,
            ante: 0,
            min_buy_in: 400,
            max_buy_in: 2000,
            time_limit: 30,
            is_private: false,
            status: 'WAITING',
            hand_number: 0,
            current_street: 'WAITING',
            dealer_seat: null,
            active_seat: null,
            community_cards: [],
            pot_total: 0,
            current_bet: 0,
            min_raise: null,
            hands_played: 0,
            average_pot: 0,
            created_by: null,
            created_at: new Date().toISOString(),
        };
    }

    /**
     * Subscribe to real-time table updates
     */
    private subscribeToTable(tableId: string, odiserId: string): void {
        this.currentTableId = tableId;

        // Clean up existing subscriptions
        this.unsubscribe();

        // Subscribe to table changes
        this.tableChannel = supabase
            .channel(`table:${tableId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'poker_tables',
                    filter: `id=eq.${tableId}`,
                },
                (payload) => {
                    this.emit({ type: 'TABLE_UPDATE', data: payload.new });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'poker_players',
                    filter: `table_id=eq.${tableId}`,
                },
                (payload) => {
                    this.emit({ type: 'PLAYER_UPDATE', data: payload });
                }
            )
            .on('broadcast', { event: 'action' }, (payload) => {
                this.emit({ type: 'ACTION', data: payload });
            })
            .subscribe();

        // Subscribe to presence (who's watching)
        this.presenceChannel = supabase
            .channel(`presence:${tableId}`)
            .on('presence', { event: 'sync' }, () => {
                const state = this.presenceChannel?.presenceState() || {};
                this.updatePresence(state);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('👤 Player joined:', newPresences);
                this.emit({ type: 'PRESENCE_CHANGE', data: { event: 'join', players: newPresences } });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('👤 Player left:', leftPresences);
                this.emit({ type: 'PRESENCE_CHANGE', data: { event: 'leave', players: leftPresences } });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await this.presenceChannel?.track({
                        odiserId,
                        onlineAt: new Date().toISOString(),
                    });
                }
            });
    }

    private updatePresence(state: RealtimePresenceState): void {
        this.presence.clear();
        Object.values(state).forEach((presences) => {
            presences.forEach((p: any) => {
                this.presence.set(p.odiserId, p as TablePresence);
            });
        });
        this.emit({ type: 'PRESENCE_CHANGE', data: { event: 'sync', players: Array.from(this.presence.values()) } });
    }

    /**
     * Seat at table (buy-in)
     */
    async seatPlayer(tableId: string, seatNumber: number, buyInAmount: number): Promise<{
        success: boolean;
        error?: string;
    }> {
        if (!isSupabaseConfigured()) {
            return { success: true };
        }

        const { data, error } = await supabase.rpc('fn_seat_player', {
            p_table_id: tableId,
            p_seat_number: seatNumber,
            p_buy_in_amount: buyInAmount,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return data as { success: boolean; error?: string };
    }

    /**
     * Leave table (cash out)
     */
    async leaveTable(tableId: string): Promise<{
        success: boolean;
        chipsReturned?: number;
        profit?: number;
        error?: string;
    }> {
        if (!isSupabaseConfigured()) {
            return { success: true, chipsReturned: 1000, profit: 0 };
        }

        const { data, error } = await supabase.rpc('fn_leave_table', {
            p_table_id: tableId,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return data as { success: boolean; chipsReturned?: number; profit?: number; error?: string };
    }

    /**
     * Broadcast a player action to all table subscribers
     */
    async broadcastAction(action: ActionType, amount?: number): Promise<void> {
        if (!this.tableChannel || !this.currentTableId) return;

        await this.tableChannel.send({
            type: 'broadcast',
            event: 'action',
            payload: {
                tableId: this.currentTableId,
                action,
                amount,
                timestamp: new Date().toISOString(),
            },
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📡 EVENT HANDLING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Subscribe to table events
     */
    onTableEvent(handler: TableEventHandler): () => void {
        this.eventHandlers.add(handler);
        return () => this.eventHandlers.delete(handler);
    }

    private emit(event: Parameters<TableEventHandler>[0]): void {
        this.eventHandlers.forEach(handler => handler(event));
    }

    /**
     * Unsubscribe from all channels
     */
    unsubscribe(): void {
        if (this.tableChannel) {
            supabase.removeChannel(this.tableChannel);
            this.tableChannel = null;
        }
        if (this.presenceChannel) {
            supabase.removeChannel(this.presenceChannel);
            this.presenceChannel = null;
        }
        this.currentTableId = null;
        this.presence.clear();
    }

    /**
     * Get current online players at table
     */
    getOnlinePlayers(): TablePresence[] {
        return Array.from(this.presence.values());
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const pokerService = new PokerRealtimeService();

export default pokerService;
