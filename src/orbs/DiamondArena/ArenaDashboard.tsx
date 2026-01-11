/**
 * 🏆 ARENA DASHBOARD — ORB #03: DIAMOND ARENA
 * Real-time leaderboard UI for Diamond Arena winners.
 * 
 * @target Orb 03 - Diamond Arena
 * @features Live rankings, payout projections, cinematic animations
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Entrant, PrizePool, PayoutResult, PoolStatus, PayoutTier } from './PrizePoolLogic';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 STYLING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const STYLES = {
    colors: {
        gold: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
        silver: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 50%, #909090 100%)',
        bronze: 'linear-gradient(135deg, #CD7F32 0%, #B87333 50%, #A0522D 100%)',
        diamond: 'linear-gradient(135deg, #00D4FF 0%, #0099FF 50%, #0066CC 100%)',
        elite: 'linear-gradient(135deg, #9400D3 0%, #8B00FF 50%, #7B00E0 100%)',
        dark: '#0A0A0F',
        surface: '#14141F',
        surfaceLight: '#1E1E2E',
        text: '#FFFFFF',
        textMuted: '#A0A0B0',
        accent: '#00D4FF',
        success: '#00FF88',
        warning: '#FFB800',
        error: '#FF4444',
    },
    glows: {
        gold: '0 0 30px rgba(255, 215, 0, 0.5)',
        diamond: '0 0 30px rgba(0, 212, 255, 0.5)',
        pulse: 'animate-pulse',
    },
};

const TIER_ICONS: Record<PayoutTier, { icon: string; color: string }> = {
    ELITE_1: { icon: '👑', color: STYLES.colors.gold },
    TOP_5: { icon: '🥇', color: STYLES.colors.gold },
    TOP_10: { icon: '🥈', color: STYLES.colors.silver },
    TOP_25: { icon: '🥉', color: STYLES.colors.bronze },
    TOP_50: { icon: '💎', color: STYLES.colors.diamond },
    PARTICIPANTS: { icon: '🎮', color: STYLES.colors.surfaceLight },
};

const STATUS_CONFIG: Record<PoolStatus, { label: string; color: string; pulse: boolean }> = {
    REGISTERING: { label: 'Registration Open', color: STYLES.colors.success, pulse: true },
    ACTIVE: { label: 'Live', color: STYLES.colors.warning, pulse: true },
    CALCULATING: { label: 'Calculating Results...', color: STYLES.colors.accent, pulse: true },
    DISTRIBUTING: { label: 'Distributing Prizes', color: STYLES.colors.diamond, pulse: true },
    SETTLED: { label: 'Completed', color: STYLES.colors.textMuted, pulse: false },
    CANCELLED: { label: 'Cancelled', color: STYLES.colors.error, pulse: false },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

interface ArenaDashboardProps {
    pool: PrizePool;
    standings: Entrant[];
    projectedPayouts: PayoutResult[];
    currentUserId?: string;
    onRefresh?: () => void;
    onEnterPool?: () => void;
    isLoading?: boolean;
    refreshInterval?: number;
}

interface LeaderboardRowProps {
    entrant: Entrant;
    payout?: PayoutResult;
    isCurrentUser: boolean;
    animationDelay: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 LEADERBOARD ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ entrant, payout, isCurrentUser, animationDelay }) => {
    const isTopThree = entrant.rank <= 3;
    const tierConfig = payout ? TIER_ICONS[payout.payoutTier] : null;

    const rankStyle = useMemo(() => {
        if (entrant.rank === 1) return { background: STYLES.colors.gold, boxShadow: STYLES.glows.gold };
        if (entrant.rank === 2) return { background: STYLES.colors.silver };
        if (entrant.rank === 3) return { background: STYLES.colors.bronze };
        return { background: STYLES.colors.surfaceLight };
    }, [entrant.rank]);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                background: isCurrentUser ? 'rgba(0, 212, 255, 0.1)' : STYLES.colors.surface,
                borderRadius: '12px',
                marginBottom: '8px',
                border: isCurrentUser ? `2px solid ${STYLES.colors.accent}` : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.3s ease',
                animation: `slideIn 0.4s ease-out ${animationDelay}ms both`,
                transform: 'translateX(0)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(8px) scale(1.01)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0) scale(1)'; }}
        >
            {/* Rank Badge */}
            <div
                style={{
                    width: isTopThree ? '48px' : '40px',
                    height: isTopThree ? '48px' : '40px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: isTopThree ? '18px' : '14px',
                    color: '#000',
                    marginRight: '16px',
                    ...rankStyle,
                }}
            >
                {isTopThree ? ['🥇', '🥈', '🥉'][entrant.rank - 1] : `#${entrant.rank}`}
            </div>

            {/* Player Info */}
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: STYLES.colors.text, fontWeight: 600, fontSize: '16px' }}>
                        {entrant.username}
                    </span>
                    {isCurrentUser && (
                        <span style={{ background: STYLES.colors.accent, color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            YOU
                        </span>
                    )}
                </div>
                <div style={{ color: STYLES.colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
                    Top {entrant.percentile}% • {entrant.latencyMs ? `${entrant.latencyMs}ms avg` : 'N/A'}
                </div>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'right', marginRight: '24px' }}>
                <div style={{ color: STYLES.colors.text, fontWeight: 'bold', fontSize: '20px' }}>
                    {entrant.score.toLocaleString()}
                </div>
                <div style={{ color: STYLES.colors.textMuted, fontSize: '11px' }}>SCORE</div>
            </div>

            {/* Projected Payout */}
            {payout && (
                <div style={{ textAlign: 'right', minWidth: '100px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <span style={{ fontSize: '18px' }}>{tierConfig?.icon}</span>
                        <span style={{ color: STYLES.colors.success, fontWeight: 'bold', fontSize: '18px' }}>
                            +{payout.payoutAmount.toLocaleString()} 💎
                        </span>
                    </div>
                    <div style={{ color: STYLES.colors.textMuted, fontSize: '11px' }}>{payout.poolShare}</div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 POOL STATS HEADER
// ═══════════════════════════════════════════════════════════════════════════

const PoolStatsHeader: React.FC<{ pool: PrizePool }> = ({ pool }) => {
    const statusConfig = STATUS_CONFIG[pool.status];

    return (
        <div style={{
            background: `linear-gradient(135deg, ${STYLES.colors.surface} 0%, ${STYLES.colors.surfaceLight} 100%)`,
            borderRadius: '20px',
            padding: '28px',
            marginBottom: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
        }}>
            {/* Title & Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ color: STYLES.colors.text, fontSize: '28px', fontWeight: 'bold', margin: 0 }}>
                        {pool.name}
                    </h1>
                    <p style={{ color: STYLES.colors.textMuted, margin: '4px 0 0 0', fontSize: '14px' }}>
                        {pool.poolType.replace('_', ' ')} • Entry: {pool.entryFee} 💎
                    </p>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    background: `${statusConfig.color}20`,
                    border: `1px solid ${statusConfig.color}`,
                }}>
                    {statusConfig.pulse && (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusConfig.color, animation: 'pulse 2s infinite' }} />
                    )}
                    <span style={{ color: statusConfig.color, fontWeight: 600, fontSize: '13px' }}>
                        {statusConfig.label}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <StatCard label="PRIZE POOL" value={`${pool.prizePool.toLocaleString()} 💎`} highlight accent={STYLES.colors.success} />
                <StatCard label="ENTRANTS" value={`${pool.entrantCount} / ${pool.maxEntrants}`} />
                <StatCard label="BURNED" value={`🔥 ${pool.totalBurned.toLocaleString()}`} accent={STYLES.colors.warning} />
                <StatCard label="HOUSE CUT" value={`${pool.houseCut.toLocaleString()} 💎`} />
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: string; highlight?: boolean; accent?: string }> = ({ label, value, highlight, accent }) => (
    <div style={{
        background: highlight ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        padding: '16px',
        border: highlight ? `1px solid ${accent || STYLES.colors.success}` : '1px solid rgba(255,255,255,0.05)',
    }}>
        <div style={{ color: STYLES.colors.textMuted, fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px' }}>
            {label}
        </div>
        <div style={{ color: accent || STYLES.colors.text, fontSize: '20px', fontWeight: 'bold' }}>
            {value}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 MAIN ARENA DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ArenaDashboard: React.FC<ArenaDashboardProps> = ({
    pool,
    standings,
    projectedPayouts,
    currentUserId,
    onRefresh,
    onEnterPool,
    isLoading = false,
    refreshInterval = 10000,
}) => {
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(true);

    // Auto-refresh logic
    useEffect(() => {
        if (!isAutoRefreshing || pool.status === 'SETTLED' || pool.status === 'CANCELLED') return;

        const interval = setInterval(() => {
            onRefresh?.();
            setLastUpdate(new Date());
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [isAutoRefreshing, pool.status, onRefresh, refreshInterval]);

    // Find current user's position
    const currentUserEntry = useMemo(
        () => standings.find(s => s.userId === currentUserId),
        [standings, currentUserId]
    );

    const currentUserPayout = useMemo(
        () => projectedPayouts.find(p => p.userId === currentUserId),
        [projectedPayouts, currentUserId]
    );

    // Get payout for entrant
    const getPayoutForEntrant = useCallback(
        (userId: string) => projectedPayouts.find(p => p.userId === userId),
        [projectedPayouts]
    );

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(180deg, ${STYLES.colors.dark} 0%, #05050A 100%)`,
            padding: '32px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
            {/* Inject Keyframe Animations */}
            <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.6); }
        }
      `}</style>

            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Pool Stats Header */}
                <PoolStatsHeader pool={pool} />

                {/* Controls Bar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    padding: '12px 20px',
                    background: STYLES.colors.surface,
                    borderRadius: '12px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ color: STYLES.colors.textMuted, fontSize: '13px' }}>
                            Last updated: {lastUpdate.toLocaleTimeString()}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isAutoRefreshing}
                                onChange={(e) => setIsAutoRefreshing(e.target.checked)}
                                style={{ accentColor: STYLES.colors.accent }}
                            />
                            <span style={{ color: STYLES.colors.text, fontSize: '13px' }}>Auto-refresh</span>
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                disabled={isLoading}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: STYLES.colors.surfaceLight,
                                    color: STYLES.colors.text,
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
                            </button>
                        )}
                        {onEnterPool && pool.status === 'REGISTERING' && (
                            <button
                                onClick={onEnterPool}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: STYLES.colors.diamond,
                                    color: '#000',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    animation: 'glow 2s infinite',
                                }}
                            >
                                ⚡ Enter Pool ({pool.entryFee} 💎)
                            </button>
                        )}
                    </div>
                </div>

                {/* Current User Highlight (if participating) */}
                {currentUserEntry && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 102, 204, 0.15) 100%)',
                        borderRadius: '16px',
                        padding: '20px 24px',
                        marginBottom: '24px',
                        border: `2px solid ${STYLES.colors.accent}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <div>
                            <div style={{ color: STYLES.colors.textMuted, fontSize: '12px', marginBottom: '4px' }}>YOUR POSITION</div>
                            <div style={{ color: STYLES.colors.text, fontSize: '24px', fontWeight: 'bold' }}>
                                Rank #{currentUserEntry.rank} • Top {currentUserEntry.percentile}%
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: STYLES.colors.textMuted, fontSize: '12px', marginBottom: '4px' }}>PROJECTED PAYOUT</div>
                            <div style={{ color: STYLES.colors.success, fontSize: '24px', fontWeight: 'bold' }}>
                                {currentUserPayout ? `+${currentUserPayout.payoutAmount.toLocaleString()} 💎` : 'Keep playing!'}
                            </div>
                        </div>
                    </div>
                )}

                {/* Leaderboard */}
                <div style={{
                    background: STYLES.colors.surface,
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid rgba(255,255,255,0.05)',
                }}>
                    <h2 style={{ color: STYLES.colors.text, fontSize: '20px', fontWeight: 'bold', marginTop: 0, marginBottom: '20px' }}>
                        🏆 Leaderboard
                    </h2>

                    {standings.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: STYLES.colors.textMuted }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
                            <div style={{ fontSize: '18px' }}>No entries yet. Be the first to compete!</div>
                        </div>
                    ) : (
                        standings.map((entrant, index) => (
                            <LeaderboardRow
                                key={entrant.userId}
                                entrant={entrant}
                                payout={getPayoutForEntrant(entrant.userId)}
                                isCurrentUser={entrant.userId === currentUserId}
                                animationDelay={index * 50}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArenaDashboard;
