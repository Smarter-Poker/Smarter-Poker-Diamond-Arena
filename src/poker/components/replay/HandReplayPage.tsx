/**
 * 🃏 HAND REPLAY PAGE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Shareable hand replay viewer matching PokerBros "HAND DETAIL" UI.
 * Supports both summary and detail views with step-through playback.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayingCard } from '../PlayingCard';
import type { Card, PokerVariant } from '../../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 📊 HAND REPLAY TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface HandReplayPlayer {
    seatNumber: number;
    playerId: string;
    username: string;
    avatarUrl: string | null;
    position: 'UTG' | 'UTG+1' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
    holeCards: Card[];
    finalHand: string | null; // e.g., "Two Pair", "One Pair"
    result: number; // +/- amount
    potContribution: number;
}

export interface HandReplayAction {
    street: 'preflop' | 'flop' | 'turn' | 'river';
    seatNumber: number;
    action: string; // FOLD, CHECK, CALL, BET, RAISE, ALL_IN
    amount?: number;
    timestamp: number;
}

export interface HandReplayData {
    handId: string;
    serialNumber: string;
    timestamp: Date;
    variant: PokerVariant;
    tableId: string;
    tableName: string;
    blinds: string; // e.g., "1/2"
    handNumber: number;
    totalHands: number;
    mainPot: number;
    sidePots: { amount: number; players: string[] }[];
    communityCards: Card[];
    players: HandReplayPlayer[];
    actions: HandReplayAction[];
    winnerId: string;
    winnerSeat: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🃏 HAND REPLAY PAGE
// ═══════════════════════════════════════════════════════════════════════════

interface HandReplayPageProps {
    handData: HandReplayData;
    onClose?: () => void;
    onShare: () => void;
    onFavorite?: () => void;
    onPlayVideo?: () => void;
}

export const HandReplayPage: React.FC<HandReplayPageProps> = ({
    handData,
    onClose,
    onShare,
    onFavorite,
    onPlayVideo,
}) => {
    const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = handData.actions.length || 1;

    // Sort players by result for display
    const sortedPlayers = useMemo(() => {
        return [...handData.players].sort((a, b) => b.result - a.result);
    }, [handData.players]);

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#0A1628',
                color: '#FFF',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <span style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>HAND DETAIL</span>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {onFavorite && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={onFavorite}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 20,
                                cursor: 'pointer',
                            }}
                        >
                            ☆
                        </motion.button>
                    )}
                    {onPlayVideo && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={onPlayVideo}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'rgba(0,200,150,0.3)',
                                border: '2px solid #00CC88',
                                color: '#00CC88',
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            ▶
                        </motion.button>
                    )}
                </div>
            </header>

            {/* Meta Info */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                    gap: 16,
                }}
            >
                <span>{handData.timestamp.toISOString().slice(0, 16).replace('T', ' ')}</span>
                <span>{handData.handNumber} / {handData.totalHands}</span>
                <span>SN: {handData.serialNumber}</span>
                <div style={{ flex: 1 }} />
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onShare}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'transparent',
                        border: 'none',
                        color: '#00CC88',
                        fontSize: 13,
                        cursor: 'pointer',
                    }}
                >
                    Share <span style={{ background: '#00CC88', color: '#000', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>➜</span>
                </motion.button>
            </div>

            {/* Main Pot */}
            <div
                style={{
                    textAlign: 'right',
                    padding: '8px 16px',
                    fontSize: 15,
                    color: '#FFF',
                }}
            >
                Main Pot : <span style={{ fontWeight: 700 }}>{handData.mainPot.toLocaleString()}</span>
            </div>

            {/* Player List */}
            <div style={{ flex: 1, padding: '0 16px', overflowY: 'auto' }}>
                {sortedPlayers.map(player => (
                    <PlayerRow
                        key={player.seatNumber}
                        player={player}
                        communityCards={handData.communityCards}
                        isWinner={player.playerId === handData.winnerId}
                        variant={handData.variant}
                    />
                ))}
            </div>

            {/* Playback Scrubber */}
            <div
                style={{
                    padding: '16px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                        disabled={currentStep <= 1}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: currentStep > 1 ? '#FFF' : 'rgba(255,255,255,0.3)',
                            fontSize: 18,
                            cursor: currentStep > 1 ? 'pointer' : 'default',
                        }}
                    >
                        ◀
                    </motion.button>

                    <div style={{ flex: 1, position: 'relative' }}>
                        <input
                            type="range"
                            min={1}
                            max={totalSteps}
                            value={currentStep}
                            onChange={(e) => setCurrentStep(parseInt(e.target.value, 10))}
                            style={{
                                width: '100%',
                                height: 4,
                                appearance: 'none',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: 2,
                                cursor: 'pointer',
                            }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                top: -8,
                                left: `${((currentStep - 1) / (totalSteps - 1 || 1)) * 100}%`,
                                transform: 'translateX(-50%)',
                            }}
                        >
                            💎
                        </div>
                    </div>

                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
                        disabled={currentStep >= totalSteps}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: currentStep < totalSteps ? '#FFF' : 'rgba(255,255,255,0.3)',
                            fontSize: 18,
                            cursor: currentStep < totalSteps ? 'pointer' : 'default',
                        }}
                    >
                        ▶
                    </motion.button>
                </div>

                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                    {currentStep}/{totalSteps}
                </div>
            </div>

            {/* View Mode Tabs */}
            <div
                style={{
                    display: 'flex',
                    gap: 0,
                    padding: '0 16px 16px',
                }}
            >
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setViewMode('summary')}
                    style={{
                        flex: 1,
                        padding: '12px 0',
                        borderRadius: '25px 0 0 25px',
                        border: 'none',
                        background: viewMode === 'summary'
                            ? 'linear-gradient(135deg, #FF8800, #FF6600)'
                            : 'rgba(100,100,100,0.3)',
                        color: viewMode === 'summary' ? '#FFF' : 'rgba(255,255,255,0.5)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Hand Summary
                </motion.button>
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setViewMode('detail')}
                    style={{
                        flex: 1,
                        padding: '12px 0',
                        borderRadius: '0 25px 25px 0',
                        border: 'none',
                        background: viewMode === 'detail'
                            ? 'linear-gradient(135deg, #FF8800, #FF6600)'
                            : 'rgba(100,100,100,0.3)',
                        color: viewMode === 'detail' ? '#FFF' : 'rgba(255,255,255,0.5)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Hand Detail
                </motion.button>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 👤 PLAYER ROW
// ═══════════════════════════════════════════════════════════════════════════

interface PlayerRowProps {
    player: HandReplayPlayer;
    communityCards: Card[];
    isWinner: boolean;
    variant: PokerVariant;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ player, communityCards, isWinner, variant }) => {
    const resultColor = player.result > 0 ? '#00FF88' : player.result < 0 ? '#FF4444' : 'rgba(255,255,255,0.5)';
    const resultPrefix = player.result > 0 ? '+' : '';

    const positionColors: Record<string, string> = {
        UTG: '#00AAFF',
        'UTG+1': '#00AAFF',
        MP: '#AA00FF',
        HJ: '#AA00FF',
        CO: '#FFAA00',
        BTN: '#00FF88',
        SB: '#FF8800',
        BB: '#FF4444',
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
        >
            {/* Player Info */}
            <div style={{ minWidth: 80 }}>
                <div style={{ fontSize: 13, color: isWinner ? '#FFB800' : '#FFF', fontWeight: isWinner ? 600 : 400 }}>
                    {isWinner && '-'}{player.username}{isWinner && '-'}
                </div>
                <span
                    style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: positionColors[player.position] || '#888',
                        color: '#FFF',
                        fontSize: 10,
                        fontWeight: 600,
                    }}
                >
                    {player.position}
                </span>
            </div>

            {/* Hole Cards */}
            <div style={{ display: 'flex', gap: 2 }}>
                {player.holeCards.map((card, i) => (
                    <PlayingCard
                        key={i}
                        card={card}
                        size="xs"
                        fourColorDeck={true}
                    />
                ))}
            </div>

            {/* Hand Ranking */}
            <div style={{ minWidth: 70, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                {player.finalHand || ''}
            </div>

            {/* Community Cards */}
            <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                {communityCards.map((card, i) => (
                    <PlayingCard
                        key={i}
                        card={card}
                        size="xs"
                        fourColorDeck={true}
                    />
                ))}
            </div>

            {/* Result */}
            <div style={{ textAlign: 'right', minWidth: 80 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: resultColor }}>
                    {resultPrefix}{player.result.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    Main pot
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔗 SHAREABLE LINK UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function generateShareLink(handId: string): string {
    return `https://s.smarter.poker/h/${handId}`;
}

export function parseShareLink(url: string): string | null {
    const match = url.match(/s\.smarter\.poker\/h\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

export default HandReplayPage;
