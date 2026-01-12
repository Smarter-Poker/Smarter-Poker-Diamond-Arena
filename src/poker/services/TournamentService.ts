/**
 * 🏆 TOURNAMENT SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Handles tournament listings, registration, and status updates.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Tournament, TournamentDetails } from '../types/poker';

export interface TournamentRow {
    id: string;
    name: string;
    game_type: 'NLH' | 'PLO' | 'PLO8' | 'PLO5' | 'PLO6';
    status: 'ANNOUNCED' | 'REGISTERING' | 'RUNNING' | 'FINISHED' | 'CANCELLED';
    buy_in_amount: number;
    buy_in_fee: number;
    guaranteed_prize: number;
    start_time: string;
    min_players: number;
    max_players: number;
    current_players: number;
    late_reg_mins: number;
    starting_chips: number;
    blind_structure_id: string;
    created_at: string;
}

export class TournamentService {
    /**
     * Fetch all active tournaments
     */
    async fetchTournaments(): Promise<Tournament[]> {
        if (!isSupabaseConfigured()) {
            return this.getMockTournaments();
        }

        const { data, error } = await supabase
            .from('poker_tournaments')
            .select('*')
            .in('status', ['ANNOUNCED', 'REGISTERING', 'RUNNING'])
            .order('start_time', { ascending: true });

        if (error) {
            console.error('❌ Failed to fetch tournaments:', error);
            return this.getMockTournaments();
        }

        return data.map(this.mapRowToTournament);
    }

    /**
     * Get details for a specific tournament
     */
    async getTournamentDetails(tournamentId: string): Promise<TournamentDetails | null> {
        if (!isSupabaseConfigured()) {
            const mock = this.getMockTournaments().find(t => t.id === tournamentId);
            return mock ? {
                ...mock,
                description: 'A high-stakes flexible tournament.',
                blindStructure: 'Turbo (5 min)',
                payoutStructure: 'Top 15%',
                registeredPlayers: []
            } : null;
        }

        const { data, error } = await supabase
            .from('poker_tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (error || !data) {
            return null;
        }

        // Fetch registered players count
        const { count } = await supabase
            .from('tournament_registrations')
            .select('user_id', { count: 'exact', head: true })
            .eq('tournament_id', tournamentId);

        return {
            ...this.mapRowToTournament(data),
            description: 'Tournament',
            blindStructure: 'Standard',
            payoutStructure: 'Standard',
            playerCount: count || data.current_players || 0,
            registeredPlayers: [] // Would fetch separately if needed
        };
    }

    /**
     * Register for a tournament
     */
    async register(tournamentId: string, userId: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: true };
        }

        // Using RPC for atomic balance check + registration
        const { data, error } = await supabase.rpc('fn_register_tournament', {
            p_tournament_id: tournamentId,
            p_user_id: userId
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return data as { success: boolean; error?: string };
    }

    /**
     * Unregister from a tournament
     */
    async unregister(tournamentId: string, userId: string): Promise<{ success: boolean; error?: string }> {
        if (!isSupabaseConfigured()) {
            return { success: true };
        }

        const { data, error } = await supabase.rpc('fn_unregister_tournament', {
            p_tournament_id: tournamentId,
            p_user_id: userId
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return data as { success: boolean; error?: string };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // private helpers
    // ═══════════════════════════════════════════════════════════════════════

    private mapRowToTournament(row: TournamentRow): Tournament {
        return {
            id: row.id,
            name: row.name,
            variant: row.game_type,
            buyIn: row.buy_in_amount,
            fee: row.buy_in_fee,
            prizePool: row.guaranteed_prize, // dynamic pool if running
            guaranteedPool: row.guaranteed_prize,
            startTime: new Date(row.start_time),
            status: row.status as any,
            entryCount: row.current_players,
            maxEntries: row.max_players,
            tableSize: 9, // fallback or from row
            blindsUp: 10, // fallback
            startingChips: row.startingChips || 10000,
            isReentry: true, // fallback
            lateRegLevel: row.late_reg_mins / 10 // estimate levels
        };
    }

    private getMockTournaments(): Tournament[] {
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

        return [
            {
                id: 'tourney-1',
                name: '15K GTD✨WEEKNIGHT✨',
                gameType: 'NLH',
                buyIn: 65,
                prizePool: 15000,
                playerCount: 13,
                maxPlayers: 500,
                startTime: new Date(now.getTime() + 3 * 60 * 60 * 1000 + 59 * 60 * 1000), // ~4h
                status: 'REGISTERING',
            },
            {
                id: 'tourney-2',
                name: '5K GTD PLO Bounty',
                gameType: 'PLO',
                buyIn: 22,
                prizePool: 5000,
                playerCount: 45,
                maxPlayers: 300,
                startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000 + 59 * 60 * 1000), // ~2h
                status: 'REGISTERING',
            },
            {
                id: 'tourney-3',
                name: 'Daily Freeroll',
                gameType: 'NLH',
                buyIn: 0,
                prizePool: 100,
                playerCount: 89,
                maxPlayers: 1000,
                startTime: new Date(now.getTime() - 15 * 60 * 1000), // Started 15m ago
                status: 'LATE_REG',
            },
        ];
    }
}

export const tournamentService = new TournamentService();
