/**
 * 🏟️ TOURNAMENT INFO PANEL — Tournament Status Display
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Displays tournament details, blind levels, payouts, and player standings.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 🏟️ TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface BlindLevel {
    level: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    duration: number; // minutes
}

interface PayoutStructure {
    place: number;
    percentage: number;
    amount: number;
}

interface TournamentPlayer {
    userId: string;
    username: string;
    chipCount: number;
    tableNumber: number;
    seatNumber: number;
    isEliminated: boolean;
    finishPosition?: number;
}

interface TournamentInfo {
    id: string;
    name: string;
    buyIn: number;
    prizePool: number;
    startingChips: number;
    playersRegistered: number;
    playersRemaining: number;
    currentLevel: number;
    currentBlindLevel: BlindLevel;
    nextBlindLevel?: BlindLevel;
    timeUntilNextLevel: number; // seconds
    blindLevels: BlindLevel[];
    payouts: PayoutStructure[];
    averageStack: number;
    status: 'REGISTERING' | 'RUNNING' | 'FINAL_TABLE' | 'COMPLETED';
    inTheMoney: boolean;
    bubblePosition?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏟️ TOURNAMENT INFO PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface TournamentInfoPanelProps {
    tournament: TournamentInfo;
    currentPlayer?: TournamentPlayer;
    isOpen: boolean;
    onClose: () => void;
}

export const TournamentInfoPanel: React.FC<TournamentInfoPanelProps> = ({
    tournament,
    currentPlayer,
    isOpen,
    onClose,
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'blinds' | 'payouts' | 'players'>('overview');

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getPlayerRank = (): number | null => {
        if (!currentPlayer) return null;
        // Approximate rank based on chip count vs average
        const ratio = currentPlayer.chipCount / tournament.averageStack;
        if (ratio >= 2) return Math.ceil(tournament.playersRemaining * 0.1);
        if (ratio >= 1) return Math.ceil(tournament.playersRemaining * 0.3);
        return Math.ceil(tournament.playersRemaining * 0.6);
    };

    const tabs = [
        { id: 'overview', label: '📊 Overview' },
        { id: 'blinds', label: '⏱️ Blinds' },
        { id: 'payouts', label: '💰 Payouts' },
    ] as const;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                    backdropFilter: 'blur(8px)',
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
                        borderRadius: 20,
                        border: '1px solid rgba(255,184,0,0.4)',
                        width: 560,
                        maxWidth: '95vw',
                        maxHeight: '85vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: 'linear-gradient(180deg, rgba(255,184,0,0.1) 0%, transparent 100%)',
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                        }}>
                            <div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginBottom: 4,
                                }}>
                                    <span style={{ fontSize: 20 }}>🏆</span>
                                    <h2 style={{
                                        color: '#FFB800',
                                        fontSize: 18,
                                        fontWeight: 700,
                                        margin: 0,
                                    }}>
                                        {tournament.name}
                                    </h2>
                                </div>
                                <p style={{
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: 12,
                                }}>
                                    Buy-in: 💎 {tournament.buyIn.toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'transparent',
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: 18,
                                    cursor: 'pointer',
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Status Bar */}
                        <div style={{
                            marginTop: 16,
                            display: 'flex',
                            gap: 24,
                        }}>
                            <StatusItem
                                label="Prize Pool"
                                value={`💎 ${tournament.prizePool.toLocaleString()}`}
                                color="#FFB800"
                            />
                            <StatusItem
                                label="Players"
                                value={`${tournament.playersRemaining}/${tournament.playersRegistered}`}
                                color="#00E0FF"
                            />
                            <StatusItem
                                label="Level"
                                value={`${tournament.currentLevel}`}
                                color="#00FF88"
                            />
                            <StatusItem
                                label="Avg Stack"
                                value={tournament.averageStack.toLocaleString()}
                                color="rgba(255,255,255,0.7)"
                            />
                        </div>
                    </div>

                    {/* Blind Timer */}
                    <div style={{
                        padding: '12px 24px',
                        background: 'rgba(0,224,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div>
                            <div style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 10,
                                marginBottom: 2,
                            }}>
                                CURRENT BLINDS
                            </div>
                            <div style={{
                                color: '#FFF',
                                fontSize: 16,
                                fontWeight: 700,
                            }}>
                                💎 {tournament.currentBlindLevel.smallBlind} / {tournament.currentBlindLevel.bigBlind}
                                {tournament.currentBlindLevel.ante > 0 && (
                                    <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
                                        (Ante: {tournament.currentBlindLevel.ante})
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 10,
                                marginBottom: 2,
                            }}>
                                NEXT LEVEL IN
                            </div>
                            <motion.div
                                style={{
                                    color: tournament.timeUntilNextLevel < 60 ? '#FF4444' : '#00E0FF',
                                    fontSize: 20,
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-mono)',
                                }}
                            >
                                {formatTime(tournament.timeUntilNextLevel)}
                            </motion.div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        padding: '8px 24px',
                        gap: 8,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: activeTab === tab.id
                                        ? 'rgba(255,184,0,0.2)'
                                        : 'transparent',
                                    color: activeTab === tab.id
                                        ? '#FFB800'
                                        : 'rgba(255,255,255,0.5)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: 24,
                    }}>
                        {/* Overview Tab */}
                        {activeTab === 'overview' && currentPlayer && (
                            <div>
                                <h3 style={{
                                    color: '#FFF',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    marginBottom: 16,
                                }}>
                                    Your Status
                                </h3>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: 16,
                                }}>
                                    <InfoCard
                                        label="Your Stack"
                                        value={`💎 ${currentPlayer.chipCount.toLocaleString()}`}
                                        subtext={`${(currentPlayer.chipCount / tournament.averageStack * 100).toFixed(0)}% of average`}
                                        highlight
                                    />
                                    <InfoCard
                                        label="Estimated Rank"
                                        value={`#${getPlayerRank()}`}
                                        subtext={`of ${tournament.playersRemaining}`}
                                    />
                                    <InfoCard
                                        label="Big Blinds"
                                        value={(currentPlayer.chipCount / tournament.currentBlindLevel.bigBlind).toFixed(1)}
                                        subtext="BB remaining"
                                    />
                                    <InfoCard
                                        label="Table"
                                        value={`${currentPlayer.tableNumber}`}
                                        subtext={`Seat ${currentPlayer.seatNumber}`}
                                    />
                                </div>

                                {/* ITM Status */}
                                {tournament.bubblePosition && (
                                    <div style={{
                                        marginTop: 20,
                                        padding: 16,
                                        borderRadius: 12,
                                        background: tournament.inTheMoney
                                            ? 'rgba(0,255,136,0.1)'
                                            : 'rgba(255,184,0,0.1)',
                                        border: `1px solid ${tournament.inTheMoney ? '#00FF8830' : '#FFB80030'}`,
                                    }}>
                                        {tournament.inTheMoney ? (
                                            <div style={{ color: '#00FF88', fontSize: 14, fontWeight: 600 }}>
                                                ✓ In The Money! You're guaranteed a payout.
                                            </div>
                                        ) : (
                                            <div style={{ color: '#FFB800', fontSize: 14, fontWeight: 600 }}>
                                                🫧 Bubble: {tournament.playersRemaining - tournament.bubblePosition} players until ITM
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Blinds Tab */}
                        {activeTab === 'blinds' && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                            }}>
                                {tournament.blindLevels.map(level => (
                                    <div
                                        key={level.level}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '10px 16px',
                                            borderRadius: 8,
                                            background: level.level === tournament.currentLevel
                                                ? 'rgba(0,224,255,0.15)'
                                                : 'rgba(255,255,255,0.03)',
                                            border: level.level === tournament.currentLevel
                                                ? '1px solid rgba(0,224,255,0.4)'
                                                : '1px solid transparent',
                                        }}
                                    >
                                        <div style={{
                                            width: 40,
                                            color: level.level === tournament.currentLevel
                                                ? '#00E0FF'
                                                : 'rgba(255,255,255,0.4)',
                                            fontSize: 12,
                                            fontWeight: 600,
                                        }}>
                                            L{level.level}
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            color: '#FFF',
                                            fontSize: 14,
                                        }}>
                                            {level.smallBlind} / {level.bigBlind}
                                            {level.ante > 0 && (
                                                <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
                                                    (Ante: {level.ante})
                                                </span>
                                            )}
                                        </div>
                                        <div style={{
                                            color: 'rgba(255,255,255,0.4)',
                                            fontSize: 11,
                                        }}>
                                            {level.duration} min
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Payouts Tab */}
                        {activeTab === 'payouts' && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                            }}>
                                {tournament.payouts.map(payout => (
                                    <div
                                        key={payout.place}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            borderRadius: 8,
                                            background: payout.place <= 3
                                                ? 'rgba(255,184,0,0.1)'
                                                : 'rgba(255,255,255,0.03)',
                                        }}
                                    >
                                        <div style={{
                                            width: 40,
                                            fontSize: 18,
                                        }}>
                                            {payout.place === 1 ? '🥇' :
                                                payout.place === 2 ? '🥈' :
                                                    payout.place === 3 ? '🥉' :
                                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                                                            #{payout.place}
                                                        </span>}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                color: '#FFB800',
                                                fontSize: 16,
                                                fontWeight: 700,
                                            }}>
                                                💎 {payout.amount.toLocaleString()}
                                            </div>
                                        </div>
                                        <div style={{
                                            color: 'rgba(255,255,255,0.4)',
                                            fontSize: 12,
                                        }}>
                                            {payout.percentage}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🏟️ HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const StatusItem: React.FC<{
    label: string;
    value: string;
    color: string;
}> = ({ label, value, color }) => (
    <div>
        <div style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            marginBottom: 2,
        }}>
            {label}
        </div>
        <div style={{
            color,
            fontSize: 14,
            fontWeight: 700,
        }}>
            {value}
        </div>
    </div>
);

const InfoCard: React.FC<{
    label: string;
    value: string;
    subtext?: string;
    highlight?: boolean;
}> = ({ label, value, subtext, highlight }) => (
    <div style={{
        padding: 16,
        borderRadius: 12,
        background: highlight ? 'rgba(0,224,255,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${highlight ? 'rgba(0,224,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
    }}>
        <div style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11,
            marginBottom: 4,
        }}>
            {label}
        </div>
        <div style={{
            color: highlight ? '#00E0FF' : '#FFF',
            fontSize: 18,
            fontWeight: 700,
        }}>
            {value}
        </div>
        {subtext && (
            <div style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 11,
                marginTop: 2,
            }}>
                {subtext}
            </div>
        )}
    </div>
);

export default TournamentInfoPanel;
