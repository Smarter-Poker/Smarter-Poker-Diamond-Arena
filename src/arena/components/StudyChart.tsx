/**
 * 📊 THE STUDY CHART — GTO RANGE VIEWER
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Spatial Chart Viewer for GTO ranges and alternate lines.
 * Includes "Leak Signal" detector for repeated mastery failures.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type HandCategory = 'RAISE' | 'CALL' | 'FOLD' | 'MIXED' | 'EMPTY';
export type Position = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

export interface HandData {
    hand: string;
    category: HandCategory;
    frequency?: number; // 0-100 for mixed strategies
    evDelta?: number;
    notes?: string;
}

export interface RangeData {
    [hand: string]: HandData;
}

export interface LeakSignal {
    id: string;
    hand: string;
    mistakeCount: number;
    totalAttempts: number;
    avgEvLoss: number;
    lastMistakeAt: Date;
    isActive: boolean;
}

export interface StudyChartProps {
    title: string;
    subtitle?: string;
    range: RangeData;
    leakSignals?: LeakSignal[];
    position?: Position;
    scenario?: string;
    onHandClick?: (hand: string, data: HandData) => void;
    onLeakClick?: (leak: LeakSignal) => void;
    showLegend?: boolean;
    showLeaks?: boolean;
    highlightedHands?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const CATEGORY_COLORS: Record<HandCategory, { bg: string; border: string; text: string }> = {
    RAISE: { bg: 'rgba(0, 255, 148, 0.3)', border: 'rgba(0, 255, 148, 0.6)', text: '#00FF94' },
    CALL: { bg: 'rgba(0, 224, 255, 0.3)', border: 'rgba(0, 224, 255, 0.6)', text: '#00E0FF' },
    FOLD: { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.1)', text: '#666666' },
    MIXED: { bg: 'rgba(255, 184, 0, 0.3)', border: 'rgba(255, 184, 0, 0.6)', text: '#FFB800' },
    EMPTY: { bg: 'transparent', border: 'rgba(255, 255, 255, 0.05)', text: '#333333' },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const getHandNotation = (row: number, col: number): string => {
    const rank1 = RANKS[row];
    const rank2 = RANKS[col];

    if (row === col) {
        return `${rank1}${rank2}`; // Pair
    } else if (row < col) {
        return `${rank1}${rank2}s`; // Suited (above diagonal)
    } else {
        return `${rank2}${rank1}o`; // Offsuit (below diagonal)
    }
};

const getHandType = (row: number, col: number): 'pair' | 'suited' | 'offsuit' => {
    if (row === col) return 'pair';
    if (row < col) return 'suited';
    return 'offsuit';
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LEAK SIGNAL INDICATOR
// ═══════════════════════════════════════════════════════════════════════════

const LeakIndicator: React.FC<{ leak: LeakSignal; onClick?: () => void }> = ({ leak, onClick }) => (
    <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        onClick={onClick}
        style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#FF3E3E',
            border: '2px solid #FF6B6B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#FFF',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(255, 62, 62, 0.6)',
            zIndex: 10,
        }}
    >
        {leak.mistakeCount}
    </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 📊 HAND CELL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface HandCellProps {
    hand: string;
    data: HandData | undefined;
    type: 'pair' | 'suited' | 'offsuit';
    leak?: LeakSignal;
    isHighlighted: boolean;
    onClick?: () => void;
    onLeakClick?: () => void;
}

const HandCell: React.FC<HandCellProps> = ({
    hand,
    data,
    type,
    leak,
    isHighlighted,
    onClick,
    onLeakClick,
}) => {
    const category = data?.category || 'EMPTY';
    const colors = CATEGORY_COLORS[category];
    const frequency = data?.frequency ?? 100;

    return (
        <motion.div
            whileHover={{ scale: 1.1, zIndex: 20 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            style={{
                position: 'relative',
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isHighlighted
                    ? 'rgba(255, 184, 0, 0.4)'
                    : category === 'MIXED'
                        ? `linear-gradient(135deg, ${colors.bg} ${frequency}%, rgba(255,255,255,0.05) ${frequency}%)`
                        : colors.bg,
                border: `1px solid ${isHighlighted ? '#FFB800' : colors.border}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '9px',
                fontWeight: 600,
                color: isHighlighted ? '#FFB800' : colors.text,
                transition: 'all 0.15s ease',
                boxShadow: isHighlighted ? '0 0 15px rgba(255, 184, 0, 0.4)' : 'none',
            }}
        >
            {hand}

            {/* Leak indicator */}
            {leak && leak.isActive && (
                <LeakIndicator leak={leak} onClick={(e) => { e?.stopPropagation?.(); onLeakClick?.(); }} />
            )}

            {/* Frequency indicator for mixed */}
            {category === 'MIXED' && frequency < 100 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 1,
                        right: 2,
                        fontSize: '7px',
                        color: 'rgba(255,255,255,0.5)',
                    }}
                >
                    {frequency}%
                </div>
            )}
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📋 LEAK PANEL
// ═══════════════════════════════════════════════════════════════════════════

const LeakPanel: React.FC<{ leaks: LeakSignal[]; onLeakClick?: (leak: LeakSignal) => void }> = ({
    leaks,
    onLeakClick,
}) => {
    const activeLeaks = leaks.filter(l => l.isActive);

    if (activeLeaks.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                marginTop: '24px',
                padding: '16px',
                background: 'rgba(255, 62, 62, 0.1)',
                border: '1px solid rgba(255, 62, 62, 0.3)',
                borderRadius: '12px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#FF3E3E',
                    textTransform: 'uppercase',
                }}>
                    Leak Signals Detected ({activeLeaks.length})
                </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {activeLeaks.map((leak) => (
                    <motion.button
                        key={leak.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onLeakClick?.(leak)}
                        style={{
                            padding: '8px 12px',
                            background: 'rgba(255, 62, 62, 0.2)',
                            border: '1px solid rgba(255, 62, 62, 0.4)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <span style={{ fontWeight: 700, color: '#FFB800' }}>{leak.hand}</span>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                            {leak.mistakeCount}/{leak.totalAttempts} missed
                        </span>
                        <span style={{ fontSize: '11px', color: '#FF3E3E' }}>
                            -{leak.avgEvLoss.toFixed(1)} EV
                        </span>
                    </motion.button>
                ))}
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 MAIN STUDY CHART COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const StudyChart: React.FC<StudyChartProps> = ({
    title,
    subtitle,
    range,
    leakSignals = [],
    position,
    scenario,
    onHandClick,
    onLeakClick,
    showLegend = true,
    showLeaks = true,
    highlightedHands = [],
}) => {
    const [selectedHand, setSelectedHand] = useState<string | null>(null);

    // Build leak map for quick lookup
    const leakMap = useMemo(() => {
        const map: Record<string, LeakSignal> = {};
        leakSignals.forEach(leak => {
            map[leak.hand] = leak;
        });
        return map;
    }, [leakSignals]);

    // Handle hand click
    const handleHandClick = useCallback((hand: string, data: HandData | undefined) => {
        setSelectedHand(hand);
        if (data) {
            onHandClick?.(hand, data);
        }
    }, [onHandClick]);

    return (
        <div
            style={{
                background: 'rgba(5, 5, 7, 0.9)',
                border: '1px solid rgba(255, 184, 0, 0.2)',
                borderRadius: '16px',
                padding: '24px',
                backdropFilter: 'blur(20px)',
            }}
        >
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#FFB800',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            margin: 0,
                        }}>
                            {title}
                        </h3>
                        {subtitle && (
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0 0' }}>
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {position && (
                        <div style={{
                            padding: '6px 12px',
                            background: 'rgba(255, 184, 0, 0.1)',
                            border: '1px solid rgba(255, 184, 0, 0.3)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#FFB800',
                        }}>
                            {position}
                        </div>
                    )}
                </div>

                {scenario && (
                    <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.7)',
                    }}>
                        📋 {scenario}
                    </div>
                )}
            </div>

            {/* 13x13 Grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(13, 1fr)',
                    gap: '3px',
                }}
            >
                {RANKS.map((_, rowIndex) =>
                    RANKS.map((_, colIndex) => {
                        const hand = getHandNotation(rowIndex, colIndex);
                        const type = getHandType(rowIndex, colIndex);
                        const data = range[hand];
                        const leak = leakMap[hand];
                        const isHighlighted = highlightedHands.includes(hand) || selectedHand === hand;

                        return (
                            <HandCell
                                key={hand}
                                hand={hand}
                                data={data}
                                type={type}
                                leak={leak}
                                isHighlighted={isHighlighted}
                                onClick={() => handleHandClick(hand, data)}
                                onLeakClick={() => leak && onLeakClick?.(leak)}
                            />
                        );
                    })
                )}
            </div>

            {/* Legend */}
            {showLegend && (
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginTop: '20px',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                }}>
                    {(['RAISE', 'CALL', 'MIXED', 'FOLD'] as HandCategory[]).map((cat) => (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '3px',
                                background: CATEGORY_COLORS[cat].bg,
                                border: `1px solid ${CATEGORY_COLORS[cat].border}`,
                            }} />
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                {cat}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Leak Panel */}
            {showLeaks && leakSignals.length > 0 && (
                <LeakPanel leaks={leakSignals} onLeakClick={onLeakClick} />
            )}

            {/* Selected Hand Details */}
            <AnimatePresence>
                {selectedHand && range[selectedHand] && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            marginTop: '20px',
                            padding: '16px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <span style={{ fontSize: '20px', fontWeight: 700, color: '#FFB800' }}>
                                    {selectedHand}
                                </span>
                                <span style={{
                                    marginLeft: '12px',
                                    padding: '4px 10px',
                                    background: CATEGORY_COLORS[range[selectedHand].category].bg,
                                    border: `1px solid ${CATEGORY_COLORS[range[selectedHand].category].border}`,
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: CATEGORY_COLORS[range[selectedHand].category].text,
                                }}>
                                    {range[selectedHand].category}
                                </span>
                            </div>

                            <button
                                onClick={() => setSelectedHand(null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {range[selectedHand].notes && (
                            <p style={{ marginTop: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                                {range[selectedHand].notes}
                            </p>
                        )}

                        {range[selectedHand].evDelta !== undefined && (
                            <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                                EV Impact: <span style={{ color: range[selectedHand].evDelta! >= 0 ? '#00FF94' : '#FF3E3E', fontWeight: 600 }}>
                                    {range[selectedHand].evDelta! >= 0 ? '+' : ''}{range[selectedHand].evDelta!.toFixed(2)} BB
                                </span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default StudyChart;
