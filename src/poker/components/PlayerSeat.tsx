/**
 * 👤 PLAYER SEAT COMPONENT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Individual player seat with avatar, chips, cards, and action indicator.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player, ActionType } from '../types/poker';
import { PlayingCard, CardGroup } from './PlayingCard';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 STYLING
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_COLORS: Record<ActionType | 'DEALER', string> = {
    FOLD: '#666666',
    CHECK: '#00FF94',
    CALL: '#00E0FF',
    BET: '#FFB800',
    RAISE: '#FF6B00',
    ALL_IN: '#FF3E3E',
    DEALER: '#FFB800',
};

// ═══════════════════════════════════════════════════════════════════════════
// 👤 SEAT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PlayerSeatProps {
    player: Player | null;
    position: { x: number; y: number };
    isHero?: boolean;
    showCards?: boolean;
    timeRemaining?: number;
    maxTime?: number;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
    player,
    position,
    isHero = false,
    showCards = false,
    timeRemaining,
    maxTime = 30,
}) => {
    if (!player) {
        // Empty seat
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    transform: 'translate(-50%, -50%)',
                    width: 120,
                    height: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <button
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        border: '2px dashed rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.02)',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }}
                >
                    SIT HERE
                </button>
            </motion.div>
        );
    }

    const isFolded = player.status === 'FOLDED';
    const isAllIn = player.status === 'ALL_IN';
    const isActive = player.isTurn;
    const timerProgress = timeRemaining !== undefined ? timeRemaining / maxTime : 1;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                zIndex: isActive ? 100 : 10,
            }}
        >
            {/* Hole Cards */}
            <AnimatePresence>
                {player.holeCards && (showCards || isHero) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: isFolded ? 0.4 : 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{ marginBottom: -8 }}
                    >
                        <CardGroup
                            cards={player.holeCards}
                            size="small"
                            overlap={0.5}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Player Avatar & Info */}
            <motion.div
                animate={{
                    boxShadow: isActive
                        ? '0 0 30px rgba(0, 255, 148, 0.6)'
                        : '0 4px 20px rgba(0,0,0,0.3)',
                }}
                style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: isHero
                        ? 'linear-gradient(135deg, rgba(0,224,255,0.2) 0%, rgba(0,100,150,0.1) 100%)'
                        : 'rgba(20,20,30,0.9)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    border: isActive
                        ? '2px solid #00FF94'
                        : isHero
                            ? '1px solid rgba(0,224,255,0.3)'
                            : '1px solid rgba(255,255,255,0.1)',
                    minWidth: 100,
                    opacity: isFolded ? 0.5 : 1,
                }}
            >
                {/* Timer Ring */}
                {isActive && timeRemaining !== undefined && (
                    <svg
                        style={{
                            position: 'absolute',
                            inset: -4,
                            width: 'calc(100% + 8px)',
                            height: 'calc(100% + 8px)',
                            transform: 'rotate(-90deg)',
                        }}
                    >
                        <rect
                            x="2"
                            y="2"
                            width="calc(100% - 4px)"
                            height="calc(100% - 4px)"
                            rx="14"
                            ry="14"
                            fill="none"
                            stroke={timerProgress < 0.25 ? '#FF3E3E' : '#00FF94'}
                            strokeWidth="2"
                            strokeDasharray={`${timerProgress * 100} 100`}
                            strokeLinecap="round"
                        />
                    </svg>
                )}

                {/* Dealer Button */}
                {player.isDealer && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                            position: 'absolute',
                            top: -12,
                            right: -12,
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#FFB800',
                            color: '#000',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(255,184,0,0.5)',
                        }}
                    >
                        D
                    </motion.div>
                )}

                {/* Avatar */}
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: player.avatarUrl
                            ? `url(${player.avatarUrl}) center/cover`
                            : 'linear-gradient(135deg, #1A1A2E 0%, #2D2D44 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        marginBottom: 4,
                    }}
                >
                    {!player.avatarUrl && '👤'}
                </div>

                {/* Username */}
                <div style={{
                    color: isHero ? '#00E0FF' : '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 90,
                }}>
                    {player.username}
                </div>

                {/* Chip Stack */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: isAllIn ? '#FF3E3E' : '#FFB800',
                    fontSize: 14,
                    fontWeight: 700,
                }}>
                    <span style={{ fontSize: 12 }}>💎</span>
                    {isAllIn ? 'ALL IN' : player.chipStack.toLocaleString()}
                </div>

                {/* Last Action Badge */}
                <AnimatePresence>
                    {player.lastAction && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                                marginTop: 4,
                                padding: '3px 10px',
                                borderRadius: 4,
                                background: ACTION_COLORS[player.lastAction.type],
                                color: player.lastAction.type === 'FOLD' ? '#FFF' : '#000',
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                            }}
                        >
                            {player.lastAction.type}
                            {player.lastAction.amount && ` ${player.lastAction.amount}`}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Current Bet */}
            <AnimatePresence>
                {player.currentBet > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            background: 'rgba(0,0,0,0.6)',
                            borderRadius: 16,
                            marginTop: -4,
                        }}
                    >
                        <span style={{ fontSize: 12 }}>💎</span>
                        <span style={{ color: '#FFB800', fontWeight: 600, fontSize: 13 }}>
                            {player.currentBet.toLocaleString()}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default PlayerSeat;
