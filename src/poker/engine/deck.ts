/**
 * 🎴 DECK ENGINE — CARD MANAGEMENT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Cryptographically secure deck shuffling and dealing.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { Card, Suit, Rank } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 DECK CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class Deck {
    private cards: Card[] = [];
    private dealtCards: Card[] = [];

    constructor() {
        this.reset();
    }

    /**
     * Reset deck to full 52 cards
     */
    reset(): void {
        this.cards = [];
        this.dealtCards = [];

        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push({ rank, suit });
            }
        }
    }

    /**
     * Fisher-Yates shuffle with crypto random
     */
    shuffle(): void {
        const array = this.cards;

        for (let i = array.length - 1; i > 0; i--) {
            // Use crypto for true randomness if available
            const randomValue = typeof crypto !== 'undefined' && crypto.getRandomValues
                ? crypto.getRandomValues(new Uint32Array(1))[0] / (0xFFFFFFFF + 1)
                : Math.random();

            const j = Math.floor(randomValue * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Deal one card from the deck
     */
    deal(): Card | null {
        const card = this.cards.pop();
        if (card) {
            this.dealtCards.push(card);
        }
        return card ?? null;
    }

    /**
     * Deal multiple cards
     */
    dealMultiple(count: number): Card[] {
        const cards: Card[] = [];
        for (let i = 0; i < count; i++) {
            const card = this.deal();
            if (card) cards.push(card);
        }
        return cards;
    }

    /**
     * Burn a card (discard face-down)
     */
    burn(): Card | null {
        return this.deal();
    }

    /**
     * Get remaining card count
     */
    remaining(): number {
        return this.cards.length;
    }

    /**
     * Check if deck has cards
     */
    hasCards(): boolean {
        return this.cards.length > 0;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 CARD UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert card to string notation (e.g., "Ah" for Ace of hearts)
 */
export function cardToString(card: Card): string {
    const suitMap: Record<Suit, string> = {
        hearts: 'h',
        diamonds: 'd',
        clubs: 'c',
        spades: 's',
    };
    return `${card.rank}${suitMap[card.suit]}`;
}

/**
 * Parse string notation to card
 */
export function stringToCard(str: string): Card | null {
    if (str.length !== 2) return null;

    const rank = str[0].toUpperCase() as Rank;
    const suitChar = str[1].toLowerCase();

    const suitMap: Record<string, Suit> = {
        h: 'hearts',
        d: 'diamonds',
        c: 'clubs',
        s: 'spades',
    };

    const suit = suitMap[suitChar];
    if (!suit || !RANKS.includes(rank)) return null;

    return { rank, suit };
}

/**
 * Get numeric value of a rank (2-14, Ace high)
 */
export function rankValue(rank: Rank): number {
    const values: Record<Rank, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
    };
    return values[rank];
}

/**
 * Get suit symbol for display
 */
export function suitSymbol(suit: Suit): string {
    const symbols: Record<Suit, string> = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠',
    };
    return symbols[suit];
}

/**
 * Get suit color
 */
export function suitColor(suit: Suit): 'red' | 'black' {
    return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

/**
 * Format card for display (e.g., "A♠")
 */
export function formatCard(card: Card): string {
    return `${card.rank}${suitSymbol(card.suit)}`;
}

/**
 * Compare cards by rank
 */
export function compareCards(a: Card, b: Card): number {
    return rankValue(b.rank) - rankValue(a.rank);
}

export default Deck;
