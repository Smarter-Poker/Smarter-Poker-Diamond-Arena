/**
 * 📜 HAND HISTORY SERVICE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Handles fetching and parsing hand histories for the Replayer.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { HandReplayData, HandReplayPlayer, HandReplayAction } from '../components/replay/HandReplayPage';

export class HandHistoryService {
    /**
     * Fetch recent hands for a user
     */
    async fetchRecentHands(userId: string, limit = 20): Promise<{ id: string; summary: string; timestamp: Date; winAmount: number }[]> {
        if (!isSupabaseConfigured()) {
            return this.getMockHistory();
        }

        const { data, error } = await supabase
            .from('poker_hand_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('❌ Failed to fetch hand history:', error);
            return this.getMockHistory();
        }

        return data.map((row: any) => ({
            id: row.hand_id,
            summary: `${row.variant} - ${row.table_name}`,
            timestamp: new Date(row.created_at),
            winAmount: row.net_change
        }));
    }

    /**
     * Fetch full replay data for a specific hand
     */
    async getHandReplay(handId: string): Promise<HandReplayData | null> {
        if (handId === 'demo' || !isSupabaseConfigured()) {
            return this.getMockReplay(handId);
        }

        // Fetch Hand Summary
        const { data: hand, error: handError } = await supabase
            .from('poker_hands')
            .select('*')
            .eq('id', handId)
            .single();

        if (handError || !hand) return null;

        // Fetch Actions
        const { data: actions } = await supabase
            .from('poker_hand_actions')
            .select('*')
            .eq('hand_id', handId)
            .order('sequence', { ascending: true });

        // Fetch Players/Results (Snapshot)
        const { data: players } = await supabase
            .from('poker_hand_players')
            .select('*')
            .eq('hand_id', handId);

        return {
            handId: hand.id,
            serialNumber: hand.hand_number.toString(),
            timestamp: new Date(hand.created_at),
            variant: hand.variant || 'NLH',
            tableId: hand.table_id,
            tableName: hand.table_name,
            blinds: `${hand.sb_amount}/${hand.bb_amount}`,
            handNumber: hand.hand_number,
            totalHands: 0, // context dependent
            mainPot: hand.total_pot,
            sidePots: [], // Logic to parse parsing actions would go here
            communityCards: hand.community_cards || [],
            players: (players || []).map((p: any) => ({
                seatNumber: p.seat_number,
                playerId: p.user_id,
                username: p.username,
                avatarUrl: p.avatar_url,
                position: p.position,
                holeCards: p.hole_cards || [],
                finalHand: p.hand_rank,
                result: p.net_change,
                potContribution: p.total_bet
            })),
            actions: (actions || []).map((a: any) => ({
                street: a.street.toLowerCase(),
                seatNumber: a.seat_number,
                action: a.action_type,
                amount: a.amount,
                timestamp: new Date(a.created_at).getTime()
            })),
            winnerId: hand.winner_id,
            winnerSeat: hand.winner_seat
        };
    }

    private getMockHistory() {
        return [
            { id: 'h1', summary: 'Diamond Ring - NLH', timestamp: new Date(), winAmount: 450 },
            { id: 'h2', summary: 'Diamond Ring - NLH', timestamp: new Date(Date.now() - 600000), winAmount: -200 },
            { id: 'h3', summary: 'PLO Action - PLO', timestamp: new Date(Date.now() - 1200000), winAmount: 1200 },
            { id: 'h4', summary: 'Low Stakes - NLH', timestamp: new Date(Date.now() - 3600000), winAmount: 0 },
            { id: 'h5', summary: 'PLO Action - PLO', timestamp: new Date(Date.now() - 7200000), winAmount: -500 },
        ];
    }

    private getMockReplay(handId: string): HandReplayData {
        // Return existing demo data structure
        // This mirrors the one in main.tsx or similar
        return {
            handId: handId,
            serialNumber: '2049883074',
            timestamp: new Date(),
            variant: 'NLH',
            tableId: 'table-1',
            tableName: 'Diamond Ring',
            blinds: '10/20',
            handNumber: 5,
            totalHands: 10,
            mainPot: 2265,
            sidePots: [],
            communityCards: [
                { rank: 'A', suit: 'spades' },
                { rank: '5', suit: 'spades' },
                { rank: '9', suit: 'diamonds' },
                { rank: '5', suit: 'hearts' },
                { rank: '2', suit: 'hearts' },
            ],
            players: [
                { seatNumber: 1, playerId: 'p1', username: '-KingFish-', avatarUrl: null, position: 'UTG', holeCards: [{ rank: 'Q', suit: 'spades' }, { rank: '4', suit: 'clubs' }], finalHand: null, result: -10, potContribution: 10 },
                { seatNumber: 2, playerId: 'p2', username: 'soul king', avatarUrl: null, position: 'BTN', holeCards: [{ rank: 'A', suit: 'diamonds' }, { rank: 'K', suit: 'spades' }], finalHand: null, result: 0, potContribution: 0 },
                { seatNumber: 3, playerId: 'p3', username: 'cubby2426', avatarUrl: null, position: 'SB', holeCards: [{ rank: 'J', suit: 'hearts' }, { rank: '9', suit: 'hearts' }], finalHand: null, result: -5, potContribution: 5 },
                { seatNumber: 4, playerId: 'p4', username: 'BigStack', avatarUrl: null, position: 'BB', holeCards: [{ rank: 'K', suit: 'diamonds' }, { rank: '3', suit: 'spades' }], finalHand: 'One Pair', result: -1125, potContribution: 1125 },
                { seatNumber: 5, playerId: 'p5', username: 'Wizurd', avatarUrl: null, position: 'MP', holeCards: [{ rank: '7', suit: 'clubs' }, { rank: '7', suit: 'diamonds' }], finalHand: null, result: 0, potContribution: 0 },
                { seatNumber: 6, playerId: 'p6', username: 'monkey88', avatarUrl: null, position: 'CO', holeCards: [{ rank: 'T', suit: 'diamonds' }, { rank: 'T', suit: 'spades' }], finalHand: 'Two Pair', result: 1137.73, potContribution: 100 },
            ],
            actions: [
                { street: 'preflop', seatNumber: 1, action: 'CALL', amount: 20, timestamp: 1 },
                { street: 'preflop', seatNumber: 6, action: 'RAISE', amount: 60, timestamp: 2 },
                { street: 'flop', seatNumber: 4, action: 'CHECK', timestamp: 3 },
            ],
            winnerId: 'p6',
            winnerSeat: 6,
        };
    }
}

export const handHistoryService = new HandHistoryService();
