/**
 * ✋ HAND EVALUATOR — POKER HAND RANKING ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Fast evaluation of Texas Hold'em hands.
 * Finds best 5-card hand from 7 cards (2 hole + 5 community).
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { Card, HandRank, EvaluatedHand, Suit, Rank } from '../types/poker';
import { rankValue } from './deck';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 HAND RANK VALUES
// ═══════════════════════════════════════════════════════════════════════════

const HAND_RANK_VALUES: Record<HandRank, number> = {
    HIGH_CARD: 1,
    PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9,
    ROYAL_FLUSH: 10,
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 EVALUATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate the best 5-card hand from any number of cards
 */
export function evaluateHand(cards: Card[]): EvaluatedHand {
    if (cards.length < 5) {
        throw new Error('Need at least 5 cards to evaluate a hand');
    }

    // Get all 5-card combinations
    const combinations = getCombinations(cards, 5);

    let bestHand: EvaluatedHand | null = null;

    for (const combo of combinations) {
        const evaluated = evaluateFiveCardHand(combo);
        if (!bestHand || compareHands(evaluated, bestHand) > 0) {
            bestHand = evaluated;
        }
    }

    return bestHand!;
}

/**
 * Evaluate Omaha Hand (High)
 * Must use exactly 2 hole cards and 3 community cards
 */
export function evaluateOmahaHand(holeCards: Card[], communityCards: Card[]): EvaluatedHand {
    if (holeCards.length < 2 || communityCards.length < 3) {
        throw new Error('Omaha requires at least 2 hole cards and 3 community cards');
    }

    const holeCombos = getCombinations(holeCards, 2);
    const boardCombos = getCombinations(communityCards, 3);

    let bestHand: EvaluatedHand | null = null;

    for (const h of holeCombos) {
        for (const b of boardCombos) {
            const hand = [...h, ...b];
            const evaluated = evaluateFiveCardHand(hand);
            if (!bestHand || compareHands(evaluated, bestHand) > 0) {
                bestHand = evaluated;
            }
        }
    }

    return bestHand!;
}

/**
 * Evaluate Omaha Low Hand (8-or-better)
 * Ace is low (1). Straights/Flushes ignored. Unpaired only.
 * Returns null if no qualifying low hand.
 */
export function evaluateOmahaLowHand(holeCards: Card[], communityCards: Card[]): EvaluatedHand | null {
    if (holeCards.length < 2 || communityCards.length < 3) return null;

    const holeCombos = getCombinations(holeCards, 2);
    const boardCombos = getCombinations(communityCards, 3);

    let bestLow: EvaluatedHand | null = null;
    let bestLowValue = Infinity; // Lower is better for Low hands

    for (const h of holeCombos) {
        for (const b of boardCombos) {
            const hand = [...h, ...b];

            // Check for pairs - if any pair, disqualified for Low 8ob
            const ranks = hand.map(c => c.rank === 'A' ? 1 : rankValue(c.rank));
            const uniqueRanks = new Set(ranks);

            if (uniqueRanks.size !== 5) continue; // Has pairs

            // Check 8-or-better condition
            const maxRank = Math.max(...ranks);
            if (maxRank > 8) continue; // Not 8-or-better

            // Calculate Low Value (Treat as base-14 digits for comparison, lower appears stronger)
            // e.g. 7-5-4-3-2 = 75432. 
            // 5-4-3-2-A = 54321 (Winner).
            // Sort Descending: 5,4,3,2,1
            const sorted = ranks.sort((x, y) => y - x); // Desc [5, 4, 3, 2, 1]

            // Create a comparable integer value: e.g. 87654
            const value = sorted.reduce((acc, r) => acc * 15 + r, 0);

            if (value < bestLowValue) {
                bestLowValue = value;
                bestLow = {
                    rank: 'HIGH_CARD', // Placeholder, not used for low comparison logic usually
                    rankValue: -value, // Negative to reuse standard compare > logic if needed, or store value
                    kickers: sorted,
                    description: `${sorted.join('-')} Low`,
                    cards: hand // Original cards (with suits) corresponding to these ranks? 
                        // Wait, ranks array lost card ref. Need to map back or sort hand.
                        // Actually evaluateFiveCardHand returns sorted cards. 
                        // But here we need specific low sort (A is low).
                        // Let's just store the hand array for now, sorted by low rank.
                        .map(r => hand.find(c => (c.rank === 'A' ? 1 : rankValue(c.rank)) === r)!)
                };
            }
        }
    }

    return bestLow;
}

/**
 * Evaluate exactly 5 cards
 */
function evaluateFiveCardHand(cards: Card[]): EvaluatedHand {
    // Sort cards by rank (high to low)
    const sorted = [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));

    const isFlush = checkFlush(sorted);
    const straightHighCard = checkStraight(sorted);
    const isStraight = straightHighCard !== null;

    const ranks = getRankCounts(sorted);
    const counts = Object.values(ranks).sort((a, b) => b - a);

    // Royal Flush
    if (isFlush && isStraight && straightHighCard === 14) {
        return {
            rank: 'ROYAL_FLUSH',
            rankValue: 10,
            kickers: [14, 13, 12, 11, 10],
            description: 'Royal Flush',
            cards: sorted,
        };
    }

    // Straight Flush
    if (isFlush && isStraight) {
        return {
            rank: 'STRAIGHT_FLUSH',
            rankValue: 9,
            kickers: [straightHighCard],
            description: `Straight Flush, ${rankName(straightHighCard as any)} high`,
            cards: sorted,
        };
    }

    // Four of a Kind
    if (counts[0] === 4) {
        const quadRank = findRankWithCount(ranks, 4);
        const kicker = findRankWithCount(ranks, 1);
        return {
            rank: 'FOUR_OF_A_KIND',
            rankValue: 8,
            kickers: [quadRank, kicker],
            description: `Four of a Kind, ${rankName(quadRank)}s`,
            cards: sorted,
        };
    }

    // Full House
    if (counts[0] === 3 && counts[1] === 2) {
        const tripRank = findRankWithCount(ranks, 3);
        const pairRank = findRankWithCount(ranks, 2);
        return {
            rank: 'FULL_HOUSE',
            rankValue: 7,
            kickers: [tripRank, pairRank],
            description: `Full House, ${rankName(tripRank)}s full of ${rankName(pairRank)}s`,
            cards: sorted,
        };
    }

    // Flush
    if (isFlush) {
        return {
            rank: 'FLUSH',
            rankValue: 6,
            kickers: sorted.map(c => rankValue(c.rank)),
            description: `Flush, ${rankName(sorted[0].rank)} high`,
            cards: sorted,
        };
    }

    // Straight
    if (isStraight) {
        return {
            rank: 'STRAIGHT',
            rankValue: 5,
            kickers: [straightHighCard],
            description: `Straight, ${rankName(straightHighCard as any)} high`,
            cards: sorted,
        };
    }

    // Three of a Kind
    if (counts[0] === 3) {
        const tripRank = findRankWithCount(ranks, 3);
        const kickers = sorted
            .filter(c => rankValue(c.rank) !== tripRank)
            .map(c => rankValue(c.rank))
            .slice(0, 2);
        return {
            rank: 'THREE_OF_A_KIND',
            rankValue: 4,
            kickers: [tripRank, ...kickers],
            description: `Three of a Kind, ${rankName(tripRank)}s`,
            cards: sorted,
        };
    }

    // Two Pair
    if (counts[0] === 2 && counts[1] === 2) {
        const pairs = Object.entries(ranks)
            .filter(([_, count]) => count === 2)
            .map(([rank]) => parseInt(rank))
            .sort((a, b) => b - a);
        const kicker = findRankWithCount(ranks, 1);
        return {
            rank: 'TWO_PAIR',
            rankValue: 3,
            kickers: [...pairs, kicker],
            description: `Two Pair, ${rankName(pairs[0])}s and ${rankName(pairs[1])}s`,
            cards: sorted,
        };
    }

    // One Pair
    if (counts[0] === 2) {
        const pairRank = findRankWithCount(ranks, 2);
        const kickers = sorted
            .filter(c => rankValue(c.rank) !== pairRank)
            .map(c => rankValue(c.rank))
            .slice(0, 3);
        return {
            rank: 'PAIR',
            rankValue: 2,
            kickers: [pairRank, ...kickers],
            description: `Pair of ${rankName(pairRank)}s`,
            cards: sorted,
        };
    }

    // High Card
    return {
        rank: 'HIGH_CARD',
        rankValue: 1,
        kickers: sorted.map(c => rankValue(c.rank)),
        description: `${rankName(sorted[0].rank)} high`,
        cards: sorted,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function checkFlush(cards: Card[]): boolean {
    const suit = cards[0].suit;
    return cards.every(c => c.suit === suit);
}

function checkStraight(cards: Card[]): number | null {
    const values = [...new Set(cards.map(c => rankValue(c.rank)))].sort((a, b) => b - a);

    // Check for A-2-3-4-5 (wheel)
    if (values.includes(14) && values.includes(2) && values.includes(3) &&
        values.includes(4) && values.includes(5)) {
        return 5; // 5-high straight
    }

    // Check for regular straight
    if (values.length === 5) {
        const isConsecutive = values[0] - values[4] === 4;
        if (isConsecutive) {
            return values[0];
        }
    }

    return null;
}

function getRankCounts(cards: Card[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const card of cards) {
        const value = rankValue(card.rank);
        counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
}

function findRankWithCount(counts: Record<number, number>, targetCount: number): number {
    const entries = Object.entries(counts)
        .filter(([_, count]) => count === targetCount)
        .map(([rank]) => parseInt(rank))
        .sort((a, b) => b - a);
    return entries[0];
}

function rankName(value: number): string {
    const names: Record<number, string> = {
        14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten',
        9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five',
        4: 'Four', 3: 'Three', 2: 'Two',
    };
    return names[value] || String(value);
}

function getCombinations<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];

    function combine(start: number, combo: T[]) {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }

        for (let i = start; i < array.length; i++) {
            combo.push(array[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    }

    combine(0, []);
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚖️ COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare two hands. Returns:
 * - Positive if hand1 wins
 * - Negative if hand2 wins
 * - 0 if tie
 */
export function compareHands(hand1: EvaluatedHand, hand2: EvaluatedHand): number {
    // Compare rank first
    if (hand1.rankValue !== hand2.rankValue) {
        return hand1.rankValue - hand2.rankValue;
    }

    // Same rank, compare kickers
    for (let i = 0; i < Math.min(hand1.kickers.length, hand2.kickers.length); i++) {
        if (hand1.kickers[i] !== hand2.kickers[i]) {
            return hand1.kickers[i] - hand2.kickers[i];
        }
    }

    return 0; // Exact tie
}

/**
 * Determine winners from multiple hands
 */
export function determineWinners(
    players: { id: string; hand: EvaluatedHand }[]
): { id: string; hand: EvaluatedHand }[] {
    if (players.length === 0) return [];
    if (players.length === 1) return players;

    let winners = [players[0]];

    for (let i = 1; i < players.length; i++) {
        const comparison = compareHands(players[i].hand, winners[0].hand);

        if (comparison > 0) {
            // New best hand
            winners = [players[i]];
        } else if (comparison === 0) {
            // Tie - add to winners
            winners.push(players[i]);
        }
    }

    return winners;
}

export default { evaluateHand, compareHands, determineWinners };
