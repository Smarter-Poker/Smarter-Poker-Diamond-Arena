/**
 * 🃏 PLAYING CARD COMPONENT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * High-fidelity playing card with flip animation and suit colors.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { Card, Suit } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 SUIT STYLING
// ═══════════════════════════════════════════════════════════════════════════

const SUIT_SYMBOLS: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
};

const SUIT_COLORS: Record<Suit, string> = {
    hearts: '#FF4444',
    diamonds: '#FF4444',
    clubs: '#1A1A2E',
    spades: '#1A1A2E',
};

// Four Color Deck Mode
const FOUR_COLOR_SUITS: Record<Suit, string> = {
    hearts: '#FF4444',   // Red
    diamonds: '#2D8CFF', // Blue
    clubs: '#2ECC71',    // Green
    spades: '#1A1A2E',   // Black
};

// ═══════════════════════════════════════════════════════════════════════════
// 🃏 CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PlayingCardProps {
    card?: Card | null;
    faceDown?: boolean;
    size?: 'xs' | 'small' | 'medium' | 'large';
    highlighted?: boolean;
    folded?: boolean;
    delay?: number;
    fourColorDeck?: boolean;
}

const SIZES = {
    xs: { width: 32, height: 45, fontSize: 10 },
    small: { width: 48, height: 68, fontSize: 14 },
    medium: { width: 64, height: 90, fontSize: 18 },
    large: { width: 80, height: 112, fontSize: 22 },
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
    card,
    faceDown = false,
    size = 'medium',
    highlighted = false,
    folded = false,
    delay = 0,
    fourColorDeck = false,
}) => {
    const dimensions = SIZES[size];
    const showBack = faceDown || !card;
    const colors = fourColorDeck ? FOUR_COLOR_SUITS : SUIT_COLORS;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, rotateY: 180 }}
            animate={{
                opacity: folded ? 0.4 : 1,
                y: 0,
                rotateY: showBack ? 180 : 0,
                scale: highlighted ? 1.05 : 1,
            }}
            transition={{
                duration: 0.4,
                delay,
                ease: [0.16, 1, 0.3, 1],
            }}
            style={{
                width: dimensions.width,
                height: dimensions.height,
                perspective: 1000,
                position: 'relative',
            }}
        >
            {/* Card Container */}
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: highlighted
                        ? '0 0 20px rgba(0, 255, 148, 0.5), 0 4px 20px rgba(0,0,0,0.4)'
                        : '0 4px 20px rgba(0,0,0,0.4)',
                    transformStyle: 'preserve-3d',
                }}
            >
                {/* Card Face */}
                {!showBack && card && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(145deg, #FFFFFF 0%, #F5F5F5 100%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            backfaceVisibility: 'hidden',
                        }}
                    >
                        {/* Top Corner */}
                        <div style={{
                            alignSelf: 'flex-start',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            lineHeight: 1,
                        }}>
                            <span style={{
                                color: colors[card.suit],
                                fontSize: dimensions.fontSize,
                                fontWeight: 700,
                                fontFamily: "'Georgia', serif",
                            }}>
                                {card.rank}
                            </span>
                            <span style={{
                                color: colors[card.suit],
                                fontSize: dimensions.fontSize * 0.8,
                            }}>
                                {SUIT_SYMBOLS[card.suit]}
                            </span>
                        </div>

                        {/* Center Suit */}
                        <span style={{
                            color: colors[card.suit],
                            fontSize: dimensions.fontSize * 1.8,
                        }}>
                            {SUIT_SYMBOLS[card.suit]}
                        </span>

                        {/* Bottom Corner (inverted) */}
                        <div style={{
                            alignSelf: 'flex-end',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            lineHeight: 1,
                            transform: 'rotate(180deg)',
                        }}>
                            <span style={{
                                color: colors[card.suit],
                                fontSize: dimensions.fontSize,
                                fontWeight: 700,
                                fontFamily: "'Georgia', serif",
                            }}>
                                {card.rank}
                            </span>
                            <span style={{
                                color: colors[card.suit],
                                fontSize: dimensions.fontSize * 0.8,
                            }}>
                                {SUIT_SYMBOLS[card.suit]}
                            </span>
                        </div>
                    </div>
                )}

                {/* Card Back */}
                {showBack && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(145deg, #2D5A27 0%, #1A3518 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                        }}
                    >
                        {/* Diamond Pattern */}
                        <div style={{
                            position: 'absolute',
                            inset: 4,
                            border: '2px solid rgba(255,255,255,0.2)',
                            borderRadius: 4,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gridTemplateRows: 'repeat(6, 1fr)',
                            gap: 2,
                            padding: 4,
                        }}>
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        borderRadius: 1,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Center Logo */}
                        <div style={{
                            fontSize: size === 'large' ? 24 : size === 'medium' ? 18 : 14,
                            color: 'rgba(255,255,255,0.3)',
                        }}>
                            💎
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📚 CARD GROUP
// ═══════════════════════════════════════════════════════════════════════════

interface CardGroupProps {
    cards: (Card | null)[];
    faceDown?: boolean;
    size?: 'small' | 'medium' | 'large';
    overlap?: number;
    highlighted?: number[];
    fourColorDeck?: boolean;
}

export const CardGroup: React.FC<CardGroupProps> = ({
    cards,
    faceDown = false,
    size = 'medium',
    overlap = 0.4,
    highlighted = [],
    fourColorDeck = false,
}) => {
    const dimensions = SIZES[size];
    const cardOffset = dimensions.width * (1 - overlap);

    return (
        <div style={{
            display: 'flex',
            position: 'relative',
            width: dimensions.width + cardOffset * (cards.length - 1),
            height: dimensions.height,
        }}>
            {cards.map((card, index) => (
                <div
                    key={index}
                    style={{
                        position: 'absolute',
                        left: index * cardOffset,
                        zIndex: index,
                    }}
                >
                    <PlayingCard
                        card={card}
                        faceDown={faceDown}
                        size={size}
                        highlighted={highlighted.includes(index)}
                        delay={index * 0.1}
                        fourColorDeck={fourColorDeck}
                    />
                </div>
            ))}
        </div>
    );
};

export default PlayingCard;
