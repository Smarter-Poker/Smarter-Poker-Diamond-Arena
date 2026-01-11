/**
 * 📊 SESSION SUMMARY — POST-TRAINING RESULTS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Displays training session results, XP/Diamond earnings,
 * leaks detected, and mastery gate status.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import { motion } from 'framer-motion';
import { MASTERY_GATE_THRESHOLD } from '../../types/arena-contract';
import type { SessionStats, LeakData } from '../../hooks/useTrainingSession';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionSummaryProps {
    stats: SessionStats;
    masteryRate: number;
    canAdvance: boolean;
    leaks: LeakData[];
    xpEarned: number;
    diamondsEarned: number;
    levelName: string;
    levelNumber: number;
    onContinue: () => void;
    onRetry: () => void;
    onStudyLeaks: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface StatCardProps {
    label: string;
    value: string | number;
    icon: string;
    color: string;
    subtext?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, subtext }) => (
    <div style={{
        flex: 1,
        padding: 16,
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderRadius: 12,
        textAlign: 'center',
    }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginTop: 4 }}>
            {label}
        </div>
        {subtext && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {subtext}
            </div>
        )}
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 📊 MAIN SESSION SUMMARY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SessionSummary: React.FC<SessionSummaryProps> = ({
    stats,
    masteryRate,
    canAdvance,
    leaks,
    xpEarned,
    diamondsEarned,
    levelName,
    levelNumber,
    onContinue,
    onRetry,
    onStudyLeaks,
}) => {
    const masteryRequired = MASTERY_GATE_THRESHOLD * 100;
    const passed = masteryRate >= masteryRequired;

    return (
        <div style={{
            background: 'rgba(5, 5, 7, 0.95)',
            border: `2px solid ${passed ? 'rgba(0, 255, 148, 0.3)' : 'rgba(255, 62, 62, 0.3)'}`,
            borderRadius: 24,
            padding: 32,
            maxWidth: 600,
            width: '100%',
        }}>
            {/* Header */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ textAlign: 'center', marginBottom: 24 }}
            >
                <motion.div
                    animate={passed ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 0.5, repeat: passed ? 3 : 0 }}
                    style={{ fontSize: 64, marginBottom: 16 }}
                >
                    {passed ? '🏆' : '📚'}
                </motion.div>

                <h2 style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: passed ? '#00FF94' : '#FFB800',
                    margin: 0,
                    textShadow: passed ? '0 0 30px rgba(0, 255, 148, 0.5)' : 'none',
                }}>
                    {passed ? 'MASTERY ACHIEVED!' : 'KEEP TRAINING'}
                </h2>

                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
                    Level {levelNumber}: {levelName}
                </p>
            </motion.div>

            {/* Mastery Progress */}
            <div style={{
                padding: 20,
                background: passed ? 'rgba(0, 255, 148, 0.05)' : 'rgba(255, 184, 0, 0.05)',
                border: `1px solid ${passed ? 'rgba(0, 255, 148, 0.2)' : 'rgba(255, 184, 0, 0.2)'}`,
                borderRadius: 16,
                marginBottom: 24,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>
                        MASTERY SCORE
                    </span>
                    <span style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: passed ? '#00FF94' : masteryRate >= 70 ? '#FFB800' : '#FF3E3E',
                    }}>
                        {masteryRate.toFixed(1)}%
                    </span>
                </div>

                <div style={{ height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    {/* Threshold marker */}
                    <div style={{
                        position: 'absolute',
                        left: `${masteryRequired}%`,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: '#FFB800',
                        zIndex: 2,
                    }} />

                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, masteryRate)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        style={{
                            height: '100%',
                            background: passed
                                ? 'linear-gradient(90deg, #00FF94, #00CC76)'
                                : masteryRate >= 70
                                    ? 'linear-gradient(90deg, #FFB800, #FF8C00)'
                                    : 'linear-gradient(90deg, #FF3E3E, #CC3232)',
                            borderRadius: 6,
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>0%</span>
                    <span style={{ fontSize: 11, color: '#FFB800' }}>Required: {masteryRequired}%</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>100%</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <StatCard
                    label="CORRECT"
                    value={stats.correctAnswers}
                    icon="✅"
                    color="#00FF94"
                    subtext={`of ${stats.totalQuestions}`}
                />
                <StatCard
                    label="BEST STREAK"
                    value={stats.bestStreak}
                    icon="🔥"
                    color="#FFB800"
                />
                <StatCard
                    label="AVG TIME"
                    value={`${(stats.avgResponseTime / 1000).toFixed(1)}s`}
                    icon="⏱️"
                    color="#00E0FF"
                />
            </div>

            {/* Rewards */}
            <div style={{
                display: 'flex',
                gap: 16,
                marginBottom: 24,
                padding: 16,
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 12,
            }}>
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    style={{ flex: 1, textAlign: 'center' }}
                >
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>XP EARNED</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#00FF94' }}>
                        +{xpEarned} ⚡
                    </div>
                </motion.div>

                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />

                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: 'spring' }}
                    style={{ flex: 1, textAlign: 'center' }}
                >
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>DIAMONDS</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#00E0FF' }}>
                        +{diamondsEarned} 💎
                    </div>
                </motion.div>
            </div>

            {/* Leaks Detected */}
            {leaks.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        padding: 16,
                        background: 'rgba(255, 62, 62, 0.1)',
                        border: '1px solid rgba(255, 62, 62, 0.3)',
                        borderRadius: 12,
                        marginBottom: 24,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 16 }}>⚠️</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#FF3E3E', letterSpacing: '0.1em' }}>
                            LEAKS DETECTED ({leaks.length})
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {leaks.slice(0, 5).map((leak) => (
                            <div
                                key={leak.hand}
                                style={{
                                    padding: '6px 12px',
                                    background: 'rgba(255, 62, 62, 0.2)',
                                    borderRadius: 6,
                                    fontSize: 13,
                                }}
                            >
                                <span style={{ fontWeight: 700, color: '#FFB800' }}>{leak.hand}</span>
                                <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
                                    {leak.mistakeCount}x missed
                                </span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={onStudyLeaks}
                        style={{
                            marginTop: 12,
                            padding: '10px 16px',
                            background: 'transparent',
                            border: '1px solid rgba(255, 62, 62, 0.4)',
                            borderRadius: 8,
                            color: '#FF3E3E',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                        }}
                    >
                        📊 Study These Hands
                    </button>
                </motion.div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
                {canAdvance ? (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onContinue}
                        style={{
                            flex: 1,
                            padding: 16,
                            background: '#00FF94',
                            border: 'none',
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#000',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            boxShadow: '0 0 30px rgba(0, 255, 148, 0.4)',
                        }}
                    >
                        Continue to Next Level →
                    </motion.button>
                ) : (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onRetry}
                            style={{
                                flex: 1,
                                padding: 16,
                                background: '#FFB800',
                                border: 'none',
                                borderRadius: 12,
                                fontSize: 14,
                                fontWeight: 700,
                                color: '#000',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                            }}
                        >
                            Retry Level
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onStudyLeaks}
                            style={{
                                flex: 1,
                                padding: 16,
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: 12,
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#FFFFFF',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                            }}
                        >
                            Study Charts
                        </motion.button>
                    </>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default SessionSummary;
