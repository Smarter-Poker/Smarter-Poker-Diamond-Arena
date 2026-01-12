/**
 * 🎰 POKERBROS-STYLE PREMIUM TABLE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * High-fidelity poker table inspired by PokerBros mobile app.
 * Features: Oval table with gold rim, premium avatar seats, action timer.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TableState, Player, Card, PokerVariant } from '../types/poker';
import { PlayingCard } from './PlayingCard';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 6-MAX SEAT POSITIONS (PokerBros style - vertical oval)
// ═══════════════════════════════════════════════════════════════════════════

const SEAT_POSITIONS_6 = [
    { x: 50, y: 88, angle: 0 },    // Seat 1 - Bottom center (Hero)
    { x: 12, y: 68, angle: -30 },  // Seat 2 - Left bottom
    { x: 12, y: 32, angle: -30 },  // Seat 3 - Left top
    { x: 50, y: 12, angle: 0 },    // Seat 4 - Top center
    { x: 88, y: 32, angle: 30 },   // Seat 5 - Right top
    { x: 88, y: 68, angle: 30 },   // Seat 6 - Right bottom
];

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PREMIUM PLAYER SEAT
// ═══════════════════════════════════════════════════════════════════════════

interface PremiumSeatProps {
    player: Player | null;
    seatNumber: number;
    x: number;
    y: number;
    isHero: boolean;
    isDealer: boolean;
    isSmallBlind: boolean;
    isBigBlind: boolean;
    isTurn: boolean;
    timerProgress?: number;
    onSitDown?: () => void;
    fourColorDeck?: boolean;
    variant?: PokerVariant;
}

const PremiumSeat: React.FC<PremiumSeatProps> = ({
    player,
    seatNumber,
    x,
    y,
    isHero,
    isDealer,
    isSmallBlind,
    isBigBlind,
    isTurn,
    timerProgress = 100,
    onSitDown,
    fourColorDeck,
    variant,
}) => {
    const avatarSize = isHero ? 70 : 56;

    // Empty seat
    if (!player) {
        return (
            <motion.div
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
            >
                <button
                    onClick={onSitDown}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)',
                        border: '2px solid rgba(255,255,255,0.2)',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 24,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    +
                </button>
            </motion.div>
        );
    }

    // Calculate chip count to display
    const displayChips = player.chipStack >= 1000
        ? `${(player.chipStack / 1000).toFixed(1)}k`
        : player.chipStack.toLocaleString();

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isHero ? 50 : 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
            }}
        >
            {/* Dealer Button */}
            {isDealer && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FFD700, #B8860B)',
                        border: '2px solid #FFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#000',
                        zIndex: 30,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                >
                    D
                </motion.div>
            )}

            {/* SB/BB Badge */}
            {(isSmallBlind || isBigBlind) && (
                <div
                    style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isSmallBlind ? '#00AAFF' : '#FF6600',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#FFF',
                        zIndex: 30,
                    }}
                >
                    {isSmallBlind ? 'SB' : 'BB'}
                </div>
            )}

            {/* Avatar Container with Timer Ring */}
            <div style={{ position: 'relative' }}>
                {/* Timer Ring (when it's player's turn) */}
                {isTurn && (
                    <svg
                        width={avatarSize + 8}
                        height={avatarSize + 8}
                        style={{
                            position: 'absolute',
                            top: -4,
                            left: -4,
                        }}
                    >
                        <circle
                            cx={(avatarSize + 8) / 2}
                            cy={(avatarSize + 8) / 2}
                            r={(avatarSize + 4) / 2}
                            fill="none"
                            stroke="rgba(255,200,0,0.3)"
                            strokeWidth="3"
                        />
                        <motion.circle
                            cx={(avatarSize + 8) / 2}
                            cy={(avatarSize + 8) / 2}
                            r={(avatarSize + 4) / 2}
                            fill="none"
                            stroke="#FFD700"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={Math.PI * (avatarSize + 4)}
                            strokeDashoffset={Math.PI * (avatarSize + 4) * (1 - timerProgress / 100)}
                            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                        />
                    </svg>
                )}

                {/* Avatar */}
                <div
                    style={{
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: '50%',
                        background: player.avatarUrl
                            ? `url(${player.avatarUrl}) center/cover`
                            : 'linear-gradient(135deg, #4A90D9, #2C5282)',
                        border: isHero
                            ? '3px solid #FFD700'
                            : isTurn
                                ? '3px solid #FFD700'
                                : '2px solid rgba(255,255,255,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: avatarSize * 0.5,
                        boxShadow: isTurn
                            ? '0 0 20px rgba(255,215,0,0.5)'
                            : '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                >
                    {!player.avatarUrl && player.username.charAt(0).toUpperCase()}
                </div>

                {/* "New" Badge */}
                {player.status === 'WAITING' && (
                    <div
                        style={{
                            position: 'absolute',
                            top: -4,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '2px 8px',
                            background: '#00DD77',
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#FFF',
                        }}
                    >
                        New
                    </div>
                )}
            </div>

            {/* Player Info Box */}
            <div
                style={{
                    background: isHero
                        ? 'linear-gradient(135deg, rgba(255,215,0,0.9), rgba(184,134,11,0.9))'
                        : 'rgba(0,0,0,0.8)',
                    padding: '4px 12px',
                    borderRadius: 6,
                    textAlign: 'center',
                    border: isHero ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.15)',
                    minWidth: 70,
                }}
            >
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isHero ? '#000' : '#FFF',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 80,
                    }}
                >
                    {player.username}
                </div>
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isHero
                            ? '#000'
                            : player.chipStack > 0
                                ? '#00FF88'
                                : '#FF4444',
                    }}
                >
                    {displayChips}
                </div>
            </div>

            {/* Current Bet (if any) */}
            {player.currentBet > 0 && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: x < 50 ? '120%' : x > 50 ? '-20%' : '50%',
                        transform: x === 50 ? 'translateX(-50%)' : 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    }}
                >
                    {/* Chip Stack Visual */}
                    <div
                        style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #FFD700, #B8860B)',
                            border: '2px solid #FFF',
                        }}
                    />
                    <span style={{
                        color: '#FFF',
                        fontSize: 12,
                        fontWeight: 700,
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}>
                        {player.currentBet}
                    </span>
                </motion.div>
            )}

// Removed card rendering from PremiumSeat
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 PREMIUM TABLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PokerTablePremiumProps {
    state: TableState;
    heroId?: string;
    onSeatClick?: (seatNumber: number) => void;
    fourColorDeck?: boolean;
    timerProgress?: number;
}

export const PokerTablePremium: React.FC<PokerTablePremiumProps> = ({
    state,
    heroId,
    onSeatClick,
    fourColorDeck = false,
    timerProgress = 100,
}) => {
    const totalPot = state.pots.reduce((sum, pot) => sum + pot.amount, 0);
    const variant = state.config.variant || 'NLH';
    const blinds = `${state.config.smallBlind}/${state.config.bigBlind}`;

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                maxWidth: 500,
                aspectRatio: '9/16',
                margin: '0 auto',
                background: '#0A1628',
                borderRadius: 16,
                overflow: 'hidden',
            }}
        >
            {/* Background Diamond Pattern */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                        repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 20px,
                            rgba(0,50,100,0.03) 20px,
                            rgba(0,50,100,0.03) 40px
                        )
                    `,
                    pointerEvents: 'none',
                }}
            />

            {/* Table SVG */}
            <svg
                viewBox="0 0 100 160"
                style={{
                    position: 'absolute',
                    top: '10%',
                    left: '10%',
                    width: '80%',
                    height: '70%',
                }}
            >
                {/* Outer Glow */}
                <defs>
                    <filter id="tableGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFD700" />
                        <stop offset="50%" stopColor="#B8860B" />
                        <stop offset="100%" stopColor="#FFD700" />
                    </linearGradient>
                    <radialGradient id="feltGradient" cx="50%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#1A3A3A" />
                        <stop offset="60%" stopColor="#0D2828" />
                        <stop offset="100%" stopColor="#081818" />
                    </radialGradient>
                </defs>

                {/* Table Rail (outer) */}
                <ellipse
                    cx="50"
                    cy="80"
                    rx="46"
                    ry="72"
                    fill="#1A1A1A"
                    stroke="url(#goldRim)"
                    strokeWidth="1.5"
                    filter="url(#tableGlow)"
                />

                {/* Table Felt (inner) */}
                <ellipse
                    cx="50"
                    cy="80"
                    rx="42"
                    ry="66"
                    fill="url(#feltGradient)"
                    stroke="#0A1A1A"
                    strokeWidth="0.5"
                />

                {/* Diamond Pattern on Felt */}
                <pattern id="diamondPattern" patternUnits="userSpaceOnUse" width="10" height="10">
                    <path
                        d="M5,0 L10,5 L5,10 L0,5 Z"
                        fill="none"
                        stroke="rgba(255,255,255,0.02)"
                        strokeWidth="0.3"
                    />
                </pattern>
                <ellipse
                    cx="50"
                    cy="80"
                    rx="40"
                    ry="64"
                    fill="url(#diamondPattern)"
                />
            </svg>

            {/* POT Display */}
            <div
                style={{
                    position: 'absolute',
                    top: '38%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    zIndex: 30,
                }}
            >
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#FFD700',
                        letterSpacing: '0.1em',
                        marginBottom: 4,
                    }}
                >
                    POT
                </div>
                <div
                    style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: '#FFF',
                        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    }}
                >
                    {totalPot.toLocaleString()}
                </div>
            </div>

            {/* Community Cards */}
            {state.communityCards.length > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: '45%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        gap: 4,
                        zIndex: 25,
                    }}
                >
                    {state.communityCards.map((card, i) => (
                        <motion.div
                            key={i}
                            initial={{ y: -20, opacity: 0, rotateY: 180 }}
                            animate={{ y: 0, opacity: 1, rotateY: 0 }}
                            transition={{ delay: i * 0.15 }}
                        >
                            <PlayingCard
                                card={card}
                                size="medium"
                                fourColorDeck={fourColorDeck}
                            />
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Game Info Banner */}
            <div
                style={{
                    position: 'absolute',
                    top: '55%',
                    left: '50%',
                    transform: 'translate(-50%, 0)',
                    textAlign: 'center',
                    zIndex: 20,
                }}
            >
                <div
                    style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: '#FFF',
                        letterSpacing: '0.05em',
                    }}
                >
                    {variant}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.5)',
                    }}
                >
                    💎 {state.config.gameType === 'CASH' ? 'CLASSIC' : 'TOURNAMENT'} 💎 ({state.config.tableSize})
                </div>
                <div
                    style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.4)',
                        marginTop: 2,
                    }}
                >
                    Blinds: {blinds}
                </div>
            </div>

            {/* Player Seats */}
            {SEAT_POSITIONS_6.map((pos, index) => {
                const seatNumber = index + 1;
                const player = state.seats[index];
                const isHero = player?.id === heroId;

                return (
                    <PremiumSeat
                        key={`seat-${seatNumber}`}
                        player={player}
                        seatNumber={seatNumber}
                        x={pos.x}
                        y={pos.y}
                        isHero={isHero}
                        isDealer={state.dealerSeat === seatNumber}
                        isSmallBlind={state.smallBlindSeat === seatNumber}
                        isBigBlind={state.bigBlindSeat === seatNumber}
                        isTurn={state.activePlayerSeat === seatNumber}
                        timerProgress={isHero ? timerProgress : 100}
                        onSitDown={() => onSeatClick?.(seatNumber)}
                        fourColorDeck={fourColorDeck}
                        variant={variant}
                    />
                );
            })}

            {/* Card Layer (Renders cards with dealing animation) */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
                <AnimatePresence>
                    {state.seats.map((player, index) => {
                        if (!player || !player.holeCards || player.holeCards.length === 0) return null;

                        const pos = SEAT_POSITIONS_6[index];
                        const isHero = player.id === heroId;
                        const seatNumber = index + 1;

                        // Dealing origin (center of table approx)
                        const dealOriginX = 50;
                        const dealOriginY = 45;

                        // Calculate offset from center to seat
                        // (We animate FROM center TO seat position)
                        // xDelta and yDelta are the travel distance in %
                        const initialX = `${dealOriginX - pos.x}%`;
                        const initialY = `${dealOriginY - pos.y}%`;

                        return (
                            <div
                                key={`cards-${seatNumber}`}
                                style={{
                                    position: 'absolute',
                                    left: `${pos.x}%`,
                                    top: `${pos.y}%`,
                                    // Adjust positioning wrapper
                                    transform: 'translate(-50%, -50%)',
                                    width: 0, height: 0, // Wrapper has no size, cards spill out
                                    visible: 'visible' // ensure visibility
                                }}
                            >
                                <div style={{
                                    position: 'absolute',
                                    // Anchor cards relative to seat center
                                    bottom: isHero ? 60 : undefined,
                                    top: isHero ? undefined : -45,
                                    left: isHero ? 0 : 0,
                                    transform: 'translateX(-50%)',
                                    display: 'flex',
                                    gap: isHero ? 2 : -15, // Tighter overlap for opponents
                                    justifyContent: 'center',
                                    width: 100 // Constraint width
                                }}>
                                    {player.holeCards.map((card, i) => (
                                        <motion.div
                                            key={`card-${seatNumber}-${i}`}
                                            initial={{
                                                x: (dealOriginX - pos.x) * 3, // Approximate pixel scaling for %
                                                y: (dealOriginY - pos.y) * 3, // Roughly convert % to px distance
                                                scale: 0,
                                                opacity: 0
                                            }}
                                            animate={{
                                                x: 0,
                                                y: 0,
                                                scale: 1,
                                                opacity: 1
                                            }}
                                            transition={{
                                                duration: 0.6,
                                                delay: i * 0.1 + index * 0.05, // Stagger deal around table
                                                ease: "backOut"
                                            }}
                                            style={{
                                                transformOrigin: 'center center',
                                                // Hero Fan Rotation
                                                rotate: isHero
                                                    ? (i - (player.holeCards!.length - 1) / 2) * 5
                                                    : 0
                                            }}
                                        >
                                            <PlayingCard
                                                card={card}
                                                size={isHero ? "large" : "small"}
                                                faceDown={!isHero && !card} // Face down for opponents unless revealed
                                                fourColorDeck={fourColorDeck}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Observers Badge */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 16px',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: 20,
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 12,
                }}
            >
                👁️ Observing
            </div>
        </div>
    );
};

export default PokerTablePremium;
