/**
 * 🎯 HAND STRENGTH CALCULATOR — Live Hand Analysis
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Real-time hand strength estimation with outs counting and equity approximation.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { Card, Rank, Suit, HandRank } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface HandStrength {
    rank: HandRank;
    name: string;
    description: string;
    strength: number; // 0-100 relative strength
    outs: number; // Cards that improve hand
    potentialHands: PotentialHand[];
}

export interface PotentialHand {
    rank: HandRank;
    name: string;
    outs: number;
    probability: number; // 0-1
}

export interface DrawAnalysis {
    isFlushDraw: boolean;
    isStraightDraw: boolean;
    isOpenEnded: boolean;
    isGutshot: boolean;
    flushOuts: number;
    straightOuts: number;
    totalOuts: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const RANK_VALUES: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const HAND_RANK_NAMES: Record<HandRank, string> = {
    'ROYAL_FLUSH': 'Royal Flush',
    'STRAIGHT_FLUSH': 'Straight Flush',
    'FOUR_OF_A_KIND': 'Four of a Kind',
    'FULL_HOUSE': 'Full House',
    'FLUSH': 'Flush',
    'STRAIGHT': 'Straight',
    'THREE_OF_A_KIND': 'Three of a Kind',
    'TWO_PAIR': 'Two Pair',
    'PAIR': 'One Pair',
    'HIGH_CARD': 'High Card',
};

const HAND_STRENGTH_BASE: Record<HandRank, number> = {
    'ROYAL_FLUSH': 100,
    'STRAIGHT_FLUSH': 95,
    'FOUR_OF_A_KIND': 90,
    'FULL_HOUSE': 82,
    'FLUSH': 75,
    'STRAIGHT': 68,
    'THREE_OF_A_KIND': 55,
    'TWO_PAIR': 45,
    'PAIR': 25,
    'HIGH_CARD': 10,
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 HAND ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze current hand strength and drawing potential
 */
export function analyzeHandStrength(
    holeCards: Card[],
    communityCards: Card[]
): HandStrength {
    const allCards = [...holeCards, ...communityCards];

    // Get current hand rank
    const currentRank = evaluateCurrentHand(allCards);
    const drawAnalysis = analyzeDraws(holeCards, communityCards);

    // Calculate base strength
    let strength = HAND_STRENGTH_BASE[currentRank];

    // Adjust for draws if not made hand
    if (currentRank === 'HIGH_CARD' || currentRank === 'PAIR') {
        if (drawAnalysis.isFlushDraw) strength += 10;
        if (drawAnalysis.isOpenEnded) strength += 8;
        if (drawAnalysis.isGutshot) strength += 4;
    }

    // Get potential hands
    const potentialHands = calculatePotentialHands(drawAnalysis, communityCards.length);

    return {
        rank: currentRank,
        name: HAND_RANK_NAMES[currentRank],
        description: getHandDescription(currentRank, allCards),
        strength: Math.min(100, Math.max(0, strength)),
        outs: drawAnalysis.totalOuts,
        potentialHands,
    };
}

/**
 * Analyze drawing possibilities
 */
export function analyzeDraws(
    holeCards: Card[],
    communityCards: Card[]
): DrawAnalysis {
    const allCards = [...holeCards, ...communityCards];

    // Count suits
    const suitCounts: Record<Suit, number> = {
        'SPADES': 0, 'HEARTS': 0, 'DIAMONDS': 0, 'CLUBS': 0
    };
    allCards.forEach(card => suitCounts[card.suit]++);

    // Check for flush draw (4 of same suit)
    const flushSuit = Object.entries(suitCounts).find(([_, count]) => count === 4);
    const isFlushDraw = !!flushSuit;
    const flushOuts = isFlushDraw ? 9 : 0; // 13 - 4 = 9 remaining of that suit

    // Get rank values and sort
    const rankValues = allCards.map(c => RANK_VALUES[c.rank]).sort((a, b) => a - b);
    const uniqueRanks = [...new Set(rankValues)];

    // Check for straight draws
    const { isOpenEnded, isGutshot, straightOuts } = analyzeStraightDraw(uniqueRanks);

    // Calculate total outs (adjust for overlap)
    let totalOuts = 0;
    if (isFlushDraw && (isOpenEnded || isGutshot)) {
        // Flush draw + straight draw - overlapping flush cards that complete straight
        totalOuts = flushOuts + straightOuts - 2;
    } else {
        totalOuts = flushOuts + straightOuts;
    }

    return {
        isFlushDraw,
        isStraightDraw: isOpenEnded || isGutshot,
        isOpenEnded,
        isGutshot,
        flushOuts,
        straightOuts,
        totalOuts: Math.max(0, totalOuts),
    };
}

/**
 * Analyze straight draw type
 */
function analyzeStraightDraw(
    sortedRanks: number[]
): { isOpenEnded: boolean; isGutshot: boolean; straightOuts: number } {
    // Need at least 4 cards for a draw
    if (sortedRanks.length < 4) {
        return { isOpenEnded: false, isGutshot: false, straightOuts: 0 };
    }

    // Check for 4 consecutive cards (open-ended)
    for (let i = 0; i <= sortedRanks.length - 4; i++) {
        const consecutive = sortedRanks.slice(i, i + 4);
        if (consecutive[3] - consecutive[0] === 3) {
            // Check if open-ended (not A-2-3-4 or J-Q-K-A at edges)
            const isOpenEnded = consecutive[0] > 2 && consecutive[3] < 14;
            return {
                isOpenEnded,
                isGutshot: !isOpenEnded,
                straightOuts: isOpenEnded ? 8 : 4,
            };
        }
    }

    // Check for gutshot (gap in middle)
    for (let i = 0; i <= sortedRanks.length - 4; i++) {
        const span = sortedRanks.slice(i, i + 4);
        if (span[3] - span[0] === 4) {
            // 4 cards spanning 5 values = gutshot
            return { isOpenEnded: false, isGutshot: true, straightOuts: 4 };
        }
    }

    return { isOpenEnded: false, isGutshot: false, straightOuts: 0 };
}

/**
 * Calculate potential hands from draws
 */
function calculatePotentialHands(
    draws: DrawAnalysis,
    boardCards: number
): PotentialHand[] {
    const potentials: PotentialHand[] = [];
    const cardsTocome = boardCards < 3 ? 5 - boardCards : boardCards < 5 ? 5 - boardCards : 0;

    if (cardsTocome === 0) return potentials;

    // Calculate probability using rule of 2 and 4
    const multiplier = cardsTocome === 2 ? 4 : 2;

    if (draws.isFlushDraw) {
        potentials.push({
            rank: 'FLUSH',
            name: 'Flush',
            outs: draws.flushOuts,
            probability: Math.min(0.99, (draws.flushOuts * multiplier) / 100),
        });
    }

    if (draws.isOpenEnded) {
        potentials.push({
            rank: 'STRAIGHT',
            name: 'Straight',
            outs: draws.straightOuts,
            probability: Math.min(0.99, (draws.straightOuts * multiplier) / 100),
        });
    }

    if (draws.isGutshot) {
        potentials.push({
            rank: 'STRAIGHT',
            name: 'Straight (Gutshot)',
            outs: draws.straightOuts,
            probability: Math.min(0.99, (draws.straightOuts * multiplier) / 100),
        });
    }

    return potentials;
}

/**
 * Simple hand evaluation for current strength
 */
function evaluateCurrentHand(cards: Card[]): HandRank {
    if (cards.length < 2) return 'HIGH_CARD';

    // Count ranks and suits
    const rankCounts: Record<string, number> = {};
    const suitCounts: Record<string, number> = {};

    cards.forEach(card => {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });

    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const hasFlush = Object.values(suitCounts).some(c => c >= 5);
    const hasStraight = checkStraight(Object.keys(rankCounts).map(r => RANK_VALUES[r as Rank]));

    // Check hand types
    if (hasFlush && hasStraight) {
        const flushSuit = Object.entries(suitCounts).find(([_, c]) => c >= 5)?.[0];
        const flushCards = cards.filter(c => c.suit === flushSuit);
        if (checkStraight(flushCards.map(c => RANK_VALUES[c.rank]))) {
            const maxRank = Math.max(...flushCards.map(c => RANK_VALUES[c.rank]));
            return maxRank === 14 ? 'ROYAL_FLUSH' : 'STRAIGHT_FLUSH';
        }
    }

    if (counts[0] === 4) return 'FOUR_OF_A_KIND';
    if (counts[0] === 3 && counts[1] >= 2) return 'FULL_HOUSE';
    if (hasFlush) return 'FLUSH';
    if (hasStraight) return 'STRAIGHT';
    if (counts[0] === 3) return 'THREE_OF_A_KIND';
    if (counts[0] === 2 && counts[1] === 2) return 'TWO_PAIR';
    if (counts[0] === 2) return 'PAIR';

    return 'HIGH_CARD';
}

/**
 * Check if ranks form a straight
 */
function checkStraight(rankValues: number[]): boolean {
    if (rankValues.length < 5) return false;

    const unique = [...new Set(rankValues)].sort((a, b) => a - b);

    // Check for wheel (A-2-3-4-5)
    if (unique.includes(14)) {
        const wheel = [14, 2, 3, 4, 5];
        if (wheel.every(r => unique.includes(r))) return true;
    }

    // Check for regular straight
    for (let i = 0; i <= unique.length - 5; i++) {
        if (unique[i + 4] - unique[i] === 4) return true;
    }

    return false;
}

/**
 * Get human-readable hand description
 */
function getHandDescription(rank: HandRank, cards: Card[]): string {
    const rankCounts: Record<string, number> = {};
    cards.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);

    const pairs = Object.entries(rankCounts).filter(([_, c]) => c === 2);
    const trips = Object.entries(rankCounts).filter(([_, c]) => c === 3);
    const quads = Object.entries(rankCounts).filter(([_, c]) => c === 4);

    switch (rank) {
        case 'FOUR_OF_A_KIND':
            return `Quad ${quads[0]?.[0]}s`;
        case 'FULL_HOUSE':
            return `${trips[0]?.[0]}s full of ${pairs[0]?.[0]}s`;
        case 'THREE_OF_A_KIND':
            return `Trip ${trips[0]?.[0]}s`;
        case 'TWO_PAIR':
            return `${pairs[0]?.[0]}s and ${pairs[1]?.[0]}s`;
        case 'PAIR':
            return `Pair of ${pairs[0]?.[0]}s`;
        case 'HIGH_CARD':
            const high = cards.reduce((max, c) =>
                RANK_VALUES[c.rank] > RANK_VALUES[max.rank] ? c : max
            );
            return `${high.rank} high`;
        default:
            return HAND_RANK_NAMES[rank];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 EQUITY ESTIMATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estimate equity using rule of 2 and 4
 */
export function estimateEquity(
    outs: number,
    street: 'FLOP' | 'TURN' | 'RIVER'
): number {
    if (street === 'RIVER') return 0; // No more cards to come

    // Rule of 4 on flop (2 cards to come), rule of 2 on turn
    const multiplier = street === 'FLOP' ? 4 : 2;
    return Math.min(99, outs * multiplier);
}

/**
 * Calculate equity against a range (simplified)
 */
export function estimateHandVsRange(
    hand: HandStrength,
    opponentCount: number
): number {
    // Simplified equity estimation based on hand strength
    // More opponents = less equity
    const baseEquity = hand.strength;
    const reduction = (opponentCount - 1) * 8; // ~8% reduction per additional opponent

    return Math.max(5, baseEquity - reduction);
}

export default {
    analyzeHandStrength,
    analyzeDraws,
    estimateEquity,
    estimateHandVsRange,
};
