/**
 * 🏆 LEADERBOARD PANEL — Player Rankings
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Displays top players ranked by various metrics.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    avatarUrl?: string;
    diamondsWon: number;
    handsPlayed: number;
    winRate: number; // Percentage
    biggestPot: number;
    isOnline: boolean;
}

type LeaderboardPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL_TIME';
type LeaderboardMetric = 'DIAMONDS' | 'WIN_RATE' | 'HANDS' | 'BIGGEST_POT';

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 LEADERBOARD PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface LeaderboardPanelProps {
    entries: LeaderboardEntry[];
    currentUserId: string;
    isOpen: boolean;
    onClose: () => void;
    isLoading?: boolean;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
    entries,
    currentUserId,
    isOpen,
    onClose,
    isLoading = false,
}) => {
    const [period, setPeriod] = useState<LeaderboardPeriod>('WEEK');
    const [metric, setMetric] = useState<LeaderboardMetric>('DIAMONDS');

    // Sort based on selected metric
    const sortedEntries = [...entries].sort((a, b) => {
        switch (metric) {
            case 'DIAMONDS': return b.diamondsWon - a.diamondsWon;
            case 'WIN_RATE': return b.winRate - a.winRate;
            case 'HANDS': return b.handsPlayed - a.handsPlayed;
            case 'BIGGEST_POT': return b.biggestPot - a.biggestPot;
            default: return 0;
        }
    }).map((entry, index) => ({ ...entry, rank: index + 1 }));

    // Find current user's rank
    const userEntry = sortedEntries.find(e => e.userId === currentUserId);
    const userRank = userEntry?.rank || null;

    const getRankBadge = (rank: number) => {
        if (rank === 1) return { emoji: '🥇', color: '#FFD700' };
        if (rank === 2) return { emoji: '🥈', color: '#C0C0C0' };
        if (rank === 3) return { emoji: '🥉', color: '#CD7F32' };
        return { emoji: null, color: 'rgba(255,255,255,0.5)' };
    };

    const getMetricValue = (entry: LeaderboardEntry) => {
        switch (metric) {
            case 'DIAMONDS': return `💎 ${entry.diamondsWon.toLocaleString()}`;
            case 'WIN_RATE': return `${entry.winRate.toFixed(1)}%`;
            case 'HANDS': return entry.handsPlayed.toLocaleString();
            case 'BIGGEST_POT': return `💎 ${entry.biggestPot.toLocaleString()}`;
            default: return '';
        }
    };

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
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
                        borderRadius: 20,
                        border: '1px solid rgba(255,184,0,0.3)',
                        width: 600,
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
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <div>
                            <h2 style={{
                                color: '#FFB800',
                                fontSize: 20,
                                fontWeight: 700,
                                margin: 0,
                            }}>
                                🏆 Leaderboard
                            </h2>
                            {userRank && (
                                <p style={{
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: 12,
                                    marginTop: 4,
                                }}>
                                    Your rank: #{userRank}
                                </p>
                            )}
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

                    {/* Filters */}
                    <div style={{
                        padding: '12px 24px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 16,
                    }}>
                        {/* Period */}
                        <div style={{ display: 'flex', gap: 6 }}>
                            {(['TODAY', 'WEEK', 'MONTH', 'ALL_TIME'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 6,
                                        border: 'none',
                                        background: period === p ? 'rgba(255,184,0,0.2)' : 'rgba(255,255,255,0.05)',
                                        color: period === p ? '#FFB800' : 'rgba(255,255,255,0.5)',
                                        fontSize: 11,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {p === 'ALL_TIME' ? 'All Time' : p.charAt(0) + p.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>

                        {/* Metric */}
                        <div style={{ display: 'flex', gap: 6 }}>
                            {([
                                { id: 'DIAMONDS', label: '💎 Diamonds' },
                                { id: 'WIN_RATE', label: '📈 Win Rate' },
                                { id: 'HANDS', label: '🃏 Hands' },
                            ] as const).map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setMetric(m.id)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 6,
                                        border: 'none',
                                        background: metric === m.id ? 'rgba(0,224,255,0.2)' : 'rgba(255,255,255,0.05)',
                                        color: metric === m.id ? '#00E0FF' : 'rgba(255,255,255,0.5)',
                                        fontSize: 11,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px 0',
                    }}>
                        {isLoading ? (
                            <div style={{
                                padding: 48,
                                textAlign: 'center',
                                color: 'rgba(255,255,255,0.4)',
                            }}>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    style={{ fontSize: 32, marginBottom: 12 }}
                                >
                                    🏆
                                </motion.div>
                                Loading rankings...
                            </div>
                        ) : sortedEntries.length === 0 ? (
                            <div style={{
                                padding: 48,
                                textAlign: 'center',
                                color: 'rgba(255,255,255,0.4)',
                            }}>
                                No players ranked yet
                            </div>
                        ) : (
                            sortedEntries.slice(0, 50).map((entry, index) => {
                                const badge = getRankBadge(entry.rank);
                                const isCurrentUser = entry.userId === currentUserId;

                                return (
                                    <motion.div
                                        key={entry.userId}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                        style={{
                                            padding: '12px 24px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 16,
                                            background: isCurrentUser ? 'rgba(0,224,255,0.05)' : 'transparent',
                                            borderLeft: isCurrentUser ? '3px solid #00E0FF' : '3px solid transparent',
                                        }}
                                    >
                                        {/* Rank */}
                                        <div style={{
                                            minWidth: 40,
                                            textAlign: 'center',
                                        }}>
                                            {badge.emoji ? (
                                                <span style={{ fontSize: 24 }}>{badge.emoji}</span>
                                            ) : (
                                                <span style={{
                                                    color: badge.color,
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                }}>
                                                    #{entry.rank}
                                                </span>
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <div style={{
                                            position: 'relative',
                                            width: 40,
                                            height: 40,
                                        }}>
                                            <div style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: '50%',
                                                background: entry.avatarUrl
                                                    ? `url(${entry.avatarUrl}) center/cover`
                                                    : 'linear-gradient(135deg, #00E0FF 0%, #00A8CC 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: '#FFF',
                                            }}>
                                                {!entry.avatarUrl && entry.username.slice(0, 2).toUpperCase()}
                                            </div>
                                            {entry.isOnline && (
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    right: 0,
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    background: '#00FF88',
                                                    border: '2px solid #08080A',
                                                }} />
                                            )}
                                        </div>

                                        {/* Username */}
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                color: isCurrentUser ? '#00E0FF' : '#FFF',
                                                fontSize: 14,
                                                fontWeight: 600,
                                            }}>
                                                {entry.username}
                                                {isCurrentUser && (
                                                    <span style={{
                                                        marginLeft: 8,
                                                        fontSize: 10,
                                                        color: 'rgba(0,224,255,0.7)',
                                                    }}>
                                                        (You)
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{
                                                color: 'rgba(255,255,255,0.4)',
                                                fontSize: 11,
                                            }}>
                                                {entry.handsPlayed.toLocaleString()} hands
                                            </div>
                                        </div>

                                        {/* Metric Value */}
                                        <div style={{
                                            color: metric === 'DIAMONDS' || metric === 'BIGGEST_POT'
                                                ? '#FFB800'
                                                : '#00FF88',
                                            fontSize: 16,
                                            fontWeight: 700,
                                            fontFamily: 'var(--font-mono)',
                                        }}>
                                            {getMetricValue(entry)}
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    {userEntry && userEntry.rank > 10 && (
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            background: 'rgba(0,224,255,0.05)',
                        }}>
                            <div style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 13,
                            }}>
                                Your Position:
                            </div>
                            <div style={{
                                color: '#00E0FF',
                                fontSize: 18,
                                fontWeight: 700,
                            }}>
                                #{userEntry.rank}
                            </div>
                            <div style={{
                                color: '#FFB800',
                                fontSize: 14,
                                fontWeight: 600,
                            }}>
                                {getMetricValue(userEntry)}
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default LeaderboardPanel;
