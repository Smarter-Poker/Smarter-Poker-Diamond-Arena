/**
 * 🎰 POKER TABLE COMPONENT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Full poker table with felt, community cards, pot, and player seats.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TableState, Player, Card } from '../types/poker';
import { PlayerSeat } from './PlayerSeat';
import { PlayingCard } from './PlayingCard';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 SEAT POSITIONS (9-max table layout)
// ═══════════════════════════════════════════════════════════════════════════

const SEAT_POSITIONS_9 = [
    { x: 50, y: 95 },   // Seat 1 - Bottom center
    { x: 18, y: 85 },   // Seat 2 - Bottom left
    { x: 5, y: 60 },    // Seat 3 - Left
    { x: 5, y: 35 },    // Seat 4 - Top left
    { x: 25, y: 12 },   // Seat 5 - Top left-center
    { x: 50, y: 5 },    // Seat 6 - Top center
    { x: 75, y: 12 },   // Seat 7 - Top right-center
    { x: 95, y: 35 },   // Seat 8 - Top right
    { x: 95, y: 60 },   // Seat 9 - Right
];

const SEAT_POSITIONS_6 = [
    { x: 50, y: 92 },   // Seat 1 - Bottom center
    { x: 10, y: 70 },   // Seat 2 - Left bottom
    { x: 10, y: 30 },   // Seat 3 - Left top
    { x: 50, y: 8 },    // Seat 4 - Top center
    { x: 90, y: 30 },   // Seat 5 - Right top
    { x: 90, y: 70 },   // Seat 6 - Right bottom
];

const SEAT_POSITIONS_2 = [
    { x: 50, y: 85 },   // Seat 1 - Bottom
    { x: 50, y: 15 },   // Seat 2 - Top
];

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 TABLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PokerTableProps {
    state: TableState;
    heroId?: string;
    onSeatClick?: (seatNumber: number) => void;
    width?: number;
    height?: number;
    fourColorDeck?: boolean;
}

export const PokerTable: React.FC<PokerTableProps> = ({
    state,
    heroId,
    onSeatClick,
    width = 900,
    height = 600,
    fourColorDeck = false,
}) => {
    const seatPositions = state.config.tableSize === 9
        ? SEAT_POSITIONS_9
        : state.config.tableSize === 6
            ? SEAT_POSITIONS_6
            : SEAT_POSITIONS_2;

    const totalPot = state.pots.reduce((sum, pot) => sum + pot.amount, 0);

    return (
        <div
            style={{
                position: 'relative',
                width,
                height,
                margin: '0 auto',
            }}
        >
            {/* Table Felt */}
            <svg
                viewBox="0 0 100 66"
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                }}
            >
                {/* Outer Rail */}
                <ellipse
                    cx="50"
                    cy="33"
                    rx="48"
                    ry="30"
                    fill="#1A0F0A"
                    stroke="#3D2817"
                    strokeWidth="0.5"
                />

                {/* Inner Felt */}
                <ellipse
                    cx="50"
                    cy="33"
                    rx="44"
                    ry="26"
                    fill="url(#feltGradient)"
                    stroke="#1A4A1A"
                    strokeWidth="0.3"
                />

                {/* Felt Pattern Lines */}
                <ellipse
                    cx="50"
                    cy="33"
                    rx="30"
                    ry="16"
                    fill="none"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="0.2"
                    strokeDasharray="2 2"
                />

                {/* Gradients */}
                <defs>
                    <radialGradient id="feltGradient" cx="50%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#1B5E20" />
                        <stop offset="70%" stopColor="#0D3D0D" />
                        <stop offset="100%" stopColor="#0A2A0A" />
                    </radialGradient>
                </defs>
            </svg>

            {/* Table Info Badge */}
            <div
                style={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '6px 16px',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: 20,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.6)',
                }}
            >
                <span>{state.config.name}</span>
                <span style={{ color: '#FFB800' }}>
                    💎 {state.config.smallBlind}/{state.config.bigBlind}
                </span>
                <span>No Limit Hold'em</span>
            </div>

            {/* Community Cards Area */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                }}
            >
                {/* Community Cards */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {Array.from({ length: 5 }).map((_, index) => {
                        const card = state.communityCards[index];
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{
                                    opacity: card ? 1 : 0.2,
                                    y: 0,
                                }}
                                transition={{ delay: index * 0.15 }}
                            >
                                {card ? (
                                    <PlayingCard
                                        card={card}
                                        size="medium"
                                        delay={index * 0.1}
                                        fourColorDeck={fourColorDeck}
                                    />
                                ) : (
                                    <div
                                        style={{
                                            width: 64,
                                            height: 90,
                                            borderRadius: 8,
                                            border: '2px dashed rgba(255,255,255,0.1)',
                                        }}
                                    />
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Pot Display */}
                <AnimatePresence>
                    {totalPot > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 20px',
                                background: 'rgba(0,0,0,0.7)',
                                borderRadius: 24,
                                border: '1px solid rgba(255,184,0,0.3)',
                            }}
                        >
                            <span style={{ fontSize: 18 }}>💎</span>
                            <span style={{
                                color: '#FFB800',
                                fontSize: 20,
                                fontWeight: 700,
                            }}>
                                {totalPot.toLocaleString()}
                            </span>
                            <span style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 12,
                                marginLeft: 4,
                            }}>
                                POT
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Street Indicator */}
                {state.street !== 'WAITING' && (
                    <div style={{
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                    }}>
                        {state.street}
                    </div>
                )}
            </div>

            {/* Player Seats */}
            {seatPositions.slice(0, state.config.tableSize).map((pos, index) => {
                const seatNumber = index + 1;
                const player = state.seats[index];
                const isHero = player?.id === heroId;

                return (
                    <PlayerSeat
                        key={seatNumber}
                        player={player}
                        position={{
                            x: (pos.x / 100) * width,
                            y: (pos.y / 100) * height,
                        }}
                        isHero={isHero}
                        showCards={state.street === 'SHOWDOWN' || isHero}
                    />
                );
            })}

            {/* Hand Number */}
            {state.handNumber > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 11,
                    }}
                >
                    Hand #{state.handNumber}
                </div>
            )}
        </div>
    );
};

export default PokerTable;
