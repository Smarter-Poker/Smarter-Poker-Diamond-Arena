/**
 * 🎯 THE LEVEL PROGRESSION — MASTERY GATE UI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Visual level map with locked/unlocked states.
 * Shows 85% mastery gate requirements.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import { motion } from 'framer-motion';
import { MASTERY_GATE_THRESHOLD } from '../../types/arena-contract';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface LevelData {
    id: string;
    number: number;
    name: string;
    description: string;
    isLocked: boolean;
    isCompleted: boolean;
    bestScore: number | null;
    xpReward: number;
    diamondReward: number;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT' | 'MASTER';
}

export interface LevelProgressionProps {
    levels: LevelData[];
    currentLevel: number;
    onLevelSelect: (level: LevelData) => void;
    userMasteryRate?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DIFFICULTY_COLORS: Record<string, { primary: string; glow: string }> = {
    EASY: { primary: '#00FF94', glow: 'rgba(0, 255, 148, 0.3)' },
    MEDIUM: { primary: '#FFB800', glow: 'rgba(255, 184, 0, 0.3)' },
    HARD: { primary: '#FF8C00', glow: 'rgba(255, 140, 0, 0.3)' },
    EXPERT: { primary: '#FF3E3E', glow: 'rgba(255, 62, 62, 0.3)' },
    MASTER: { primary: '#9400D3', glow: 'rgba(148, 0, 211, 0.3)' },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔷 LEVEL NODE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface LevelNodeProps {
    level: LevelData;
    isCurrent: boolean;
    onClick: () => void;
}

const LevelNode: React.FC<LevelNodeProps> = ({ level, isCurrent, onClick }) => {
    const colors = DIFFICULTY_COLORS[level.difficulty];

    const getStatusIcon = () => {
        if (level.isLocked) return '🔒';
        if (level.isCompleted) return '✅';
        if (isCurrent) return '🎮';
        return '⚪';
    };

    const getScoreBadge = () => {
        if (!level.bestScore) return null;
        const passed = level.bestScore >= MASTERY_GATE_THRESHOLD * 100;
        return (
            <div style={{
                position: 'absolute',
                bottom: -8,
                right: -8,
                padding: '2px 6px',
                background: passed ? 'rgba(0, 255, 148, 0.2)' : 'rgba(255, 62, 62, 0.2)',
                border: `1px solid ${passed ? '#00FF94' : '#FF3E3E'}`,
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                color: passed ? '#00FF94' : '#FF3E3E',
            }}>
                {level.bestScore}%
            </div>
        );
    };

    return (
        <motion.div
            whileHover={!level.isLocked ? { scale: 1.05, y: -4 } : {}}
            whileTap={!level.isLocked ? { scale: 0.98 } : {}}
            onClick={() => !level.isLocked && onClick()}
            style={{
                position: 'relative',
                width: 80,
                height: 80,
                borderRadius: 16,
                background: level.isLocked
                    ? 'rgba(100, 100, 100, 0.2)'
                    : isCurrent
                        ? `${colors.primary}20`
                        : level.isCompleted
                            ? 'rgba(0, 255, 148, 0.1)'
                            : 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${level.isLocked
                        ? 'rgba(100, 100, 100, 0.3)'
                        : isCurrent
                            ? colors.primary
                            : level.isCompleted
                                ? '#00FF94'
                                : 'rgba(255, 255, 255, 0.1)'
                    }`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: level.isLocked ? 'not-allowed' : 'pointer',
                opacity: level.isLocked ? 0.5 : 1,
                boxShadow: isCurrent ? `0 0 30px ${colors.glow}` : 'none',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Level Number */}
            <div style={{
                fontSize: 24,
                fontWeight: 800,
                color: level.isLocked ? '#666' : colors.primary,
                lineHeight: 1,
            }}>
                {level.number}
            </div>

            {/* Status Icon */}
            <div style={{ fontSize: 14, marginTop: 4 }}>
                {getStatusIcon()}
            </div>

            {/* Score Badge */}
            {getScoreBadge()}

            {/* Current Indicator */}
            {isCurrent && (
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                        position: 'absolute',
                        inset: -4,
                        borderRadius: 20,
                        border: `2px solid ${colors.primary}`,
                        pointerEvents: 'none',
                    }}
                />
            )}
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔗 CONNECTION LINE
// ═══════════════════════════════════════════════════════════════════════════

const ConnectionLine: React.FC<{ isCompleted: boolean }> = ({ isCompleted }) => (
    <div style={{
        width: 32,
        height: 2,
        background: isCompleted
            ? 'linear-gradient(90deg, #00FF94, #00CC76)'
            : 'rgba(255, 255, 255, 0.1)',
        margin: '0 4px',
    }} />
);

// ═══════════════════════════════════════════════════════════════════════════
// 📊 LEVEL DETAILS PANEL
// ═══════════════════════════════════════════════════════════════════════════

const LevelDetails: React.FC<{ level: LevelData; userMasteryRate?: number }> = ({ level, userMasteryRate }) => {
    const colors = DIFFICULTY_COLORS[level.difficulty];
    const masteryRequired = MASTERY_GATE_THRESHOLD * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
                background: 'rgba(5, 5, 7, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                padding: 24,
                marginTop: 24,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <h3 style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#FFFFFF',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        Level {level.number}: {level.name}
                        {level.isLocked && <span style={{ fontSize: 16 }}>🔒</span>}
                    </h3>
                    <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', margin: '8px 0 0 0' }}>
                        {level.description}
                    </p>
                </div>

                <div style={{
                    padding: '6px 12px',
                    background: `${colors.primary}20`,
                    border: `1px solid ${colors.primary}40`,
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.primary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>
                    {level.difficulty}
                </div>
            </div>

            {/* Mastery Gate */}
            <div style={{
                padding: 16,
                background: 'rgba(255, 184, 0, 0.05)',
                border: '1px solid rgba(255, 184, 0, 0.2)',
                borderRadius: 12,
                marginBottom: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 16 }}>🎯</span>
                    <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#FFB800',
                        letterSpacing: '0.1em',
                    }}>
                        MASTERY GATE (HARD LAW)
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{
                            height: 8,
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 4,
                            overflow: 'hidden',
                        }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${level.bestScore || 0}%` }}
                                style={{
                                    height: '100%',
                                    background: (level.bestScore || 0) >= masteryRequired
                                        ? 'linear-gradient(90deg, #00FF94, #00CC76)'
                                        : 'linear-gradient(90deg, #FFB800, #FF8C00)',
                                    borderRadius: 4,
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                Best: {level.bestScore ? `${level.bestScore}%` : 'Not attempted'}
                            </span>
                            <span style={{ fontSize: 11, color: '#FFB800' }}>
                                Required: {masteryRequired}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rewards */}
            <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                    flex: 1,
                    padding: 12,
                    background: 'rgba(0, 255, 148, 0.05)',
                    border: '1px solid rgba(0, 255, 148, 0.2)',
                    borderRadius: 8,
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>XP REWARD</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#00FF94' }}>
                        +{level.xpReward} ⚡
                    </div>
                </div>

                <div style={{
                    flex: 1,
                    padding: 12,
                    background: 'rgba(0, 224, 255, 0.05)',
                    border: '1px solid rgba(0, 224, 255, 0.2)',
                    borderRadius: 8,
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>DIAMONDS</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#00E0FF' }}>
                        +{level.diamondReward} 💎
                    </div>
                </div>
            </div>

            {/* Start Button */}
            {!level.isLocked && (
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        width: '100%',
                        marginTop: 16,
                        padding: 16,
                        background: colors.primary,
                        border: 'none',
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#000',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        boxShadow: `0 0 30px ${colors.glow}`,
                    }}
                >
                    {level.isCompleted ? 'Replay Level' : 'Start Training'}
                </motion.button>
            )}

            {/* Locked Message */}
            {level.isLocked && (
                <div style={{
                    marginTop: 16,
                    padding: 16,
                    background: 'rgba(100, 100, 100, 0.1)',
                    border: '1px solid rgba(100, 100, 100, 0.2)',
                    borderRadius: 12,
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: 13,
                }}>
                    🔒 Complete Level {level.number - 1} with {masteryRequired}% mastery to unlock
                </div>
            )}
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 MAIN LEVEL PROGRESSION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const LevelProgression: React.FC<LevelProgressionProps> = ({
    levels,
    currentLevel,
    onLevelSelect,
    userMasteryRate,
}) => {
    const [selectedLevel, setSelectedLevel] = React.useState<LevelData | null>(null);

    const handleLevelClick = (level: LevelData) => {
        setSelectedLevel(level);
        onLevelSelect(level);
    };

    // Group levels into rows of 5
    const rows: LevelData[][] = [];
    for (let i = 0; i < levels.length; i += 5) {
        rows.push(levels.slice(i, i + 5));
    }

    return (
        <div style={{ width: '100%' }}>
            {/* Level Map */}
            <div style={{
                background: 'rgba(5, 5, 7, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 20,
                padding: 24,
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 24,
                }}>
                    <span style={{ fontSize: 24 }}>🗺️</span>
                    <h2 style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#FFB800',
                        margin: 0,
                        letterSpacing: '0.1em',
                    }}>
                        TRAINING PATH
                    </h2>
                </div>

                {/* Level Rows */}
                {rows.map((row, rowIndex) => (
                    <div
                        key={rowIndex}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: rowIndex < rows.length - 1 ? 24 : 0,
                            flexDirection: rowIndex % 2 === 1 ? 'row-reverse' : 'row',
                        }}
                    >
                        {row.map((level, levelIndex) => (
                            <React.Fragment key={level.id}>
                                <LevelNode
                                    level={level}
                                    isCurrent={level.number === currentLevel}
                                    onClick={() => handleLevelClick(level)}
                                />
                                {levelIndex < row.length - 1 && (
                                    <ConnectionLine isCompleted={level.isCompleted} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                ))}
            </div>

            {/* Selected Level Details */}
            {selectedLevel && (
                <LevelDetails level={selectedLevel} userMasteryRate={userMasteryRate} />
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default LevelProgression;
