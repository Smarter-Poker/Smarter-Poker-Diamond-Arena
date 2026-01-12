/**
 * 📊 POT ODDS CALCULATOR — Real-time Odds Display
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Displays pot odds, equity, and calling requirements for decisions.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PotOddsInfo {
    potSize: number;
    amountToCall: number;
    potOddsPercentage: number;
    potOddsRatio: string;
    requiredEquity: number;
    impliedOdds?: {
        expectedAdditional: number;
        adjustedEquity: number;
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 POT ODDS CALCULATOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PotOddsCalculatorProps {
    potSize: number;
    amountToCall: number;
    estimatedEquity?: number; // 0-100
    isVisible: boolean;
    position?: 'TOP' | 'BOTTOM';
}

export const PotOddsCalculator: React.FC<PotOddsCalculatorProps> = ({
    potSize,
    amountToCall,
    estimatedEquity,
    isVisible,
    position = 'BOTTOM',
}) => {
    // Calculate pot odds
    const totalPot = potSize + amountToCall;
    const potOddsPercentage = totalPot > 0 ? (amountToCall / totalPot) * 100 : 0;
    const requiredEquity = potOddsPercentage;

    // Format as ratio (e.g., "3:1")
    const formatRatio = (percentage: number): string => {
        if (percentage <= 0) return '∞:1';
        const ratio = (100 - percentage) / percentage;
        if (ratio >= 10) return `${Math.round(ratio)}:1`;
        return `${ratio.toFixed(1)}:1`;
    };

    // Determine if call is profitable
    const isProfitable = estimatedEquity !== undefined && estimatedEquity >= requiredEquity;

    if (!isVisible || amountToCall <= 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: position === 'TOP' ? -10 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: position === 'TOP' ? -10 : 10 }}
                style={{
                    position: 'absolute',
                    [position === 'TOP' ? 'top' : 'bottom']: -70,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.85)',
                    borderRadius: 12,
                    border: '1px solid rgba(0,224,255,0.3)',
                    padding: '12px 16px',
                    backdropFilter: 'blur(8px)',
                    zIndex: 20,
                    minWidth: 200,
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                }}>
                    <span style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                    }}>
                        Pot Odds
                    </span>
                    <span style={{
                        color: '#00E0FF',
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                    }}>
                        {formatRatio(potOddsPercentage)}
                    </span>
                </div>

                {/* Visual Bar */}
                <div style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.1)',
                    marginBottom: 10,
                    overflow: 'hidden',
                    position: 'relative',
                }}>
                    {/* Required Equity Marker */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(requiredEquity, 100)}%` }}
                        style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #00E0FF, #00A8CC)',
                            borderRadius: 3,
                        }}
                    />

                    {/* Estimated Equity Marker */}
                    {estimatedEquity !== undefined && (
                        <motion.div
                            initial={{ left: 0 }}
                            animate={{ left: `${Math.min(estimatedEquity, 100)}%` }}
                            style={{
                                position: 'absolute',
                                top: -2,
                                width: 2,
                                height: 10,
                                background: isProfitable ? '#00FF88' : '#FF4444',
                                borderRadius: 1,
                            }}
                        />
                    )}
                </div>

                {/* Stats Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                }}>
                    <StatBox
                        label="To Call"
                        value={`💎 ${amountToCall}`}
                        color="#FFB800"
                    />
                    <StatBox
                        label="Need"
                        value={`${requiredEquity.toFixed(1)}%`}
                        color="#00E0FF"
                    />
                    {estimatedEquity !== undefined && (
                        <StatBox
                            label="Equity"
                            value={`${estimatedEquity.toFixed(1)}%`}
                            color={isProfitable ? '#00FF88' : '#FF4444'}
                        />
                    )}
                </div>

                {/* Verdict */}
                {estimatedEquity !== undefined && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            marginTop: 10,
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: isProfitable
                                ? 'rgba(0,255,136,0.1)'
                                : 'rgba(255,68,68,0.1)',
                            textAlign: 'center',
                        }}
                    >
                        <span style={{
                            color: isProfitable ? '#00FF88' : '#FF4444',
                            fontSize: 11,
                            fontWeight: 600,
                        }}>
                            {isProfitable ? '✓ +EV Call' : '✗ -EV Call'}
                        </span>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const StatBox: React.FC<{
    label: string;
    value: string;
    color: string;
}> = ({ label, value, color }) => (
    <div style={{ textAlign: 'center' }}>
        <div style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 9,
            marginBottom: 2,
            textTransform: 'uppercase',
        }}>
            {label}
        </div>
        <div style={{
            color,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
        }}>
            {value}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 📊 POT ODDS UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const calculatePotOdds = (potSize: number, amountToCall: number): PotOddsInfo => {
    const totalPot = potSize + amountToCall;
    const potOddsPercentage = totalPot > 0 ? (amountToCall / totalPot) * 100 : 0;
    const requiredEquity = potOddsPercentage;

    // Calculate ratio like "3:1"
    const ratio = potOddsPercentage > 0
        ? `${((100 - potOddsPercentage) / potOddsPercentage).toFixed(1)}:1`
        : '∞:1';

    return {
        potSize,
        amountToCall,
        potOddsPercentage,
        potOddsRatio: ratio,
        requiredEquity,
    };
};

export const calculateImpliedOdds = (
    potSize: number,
    amountToCall: number,
    expectedAdditionalWinnings: number
): PotOddsInfo => {
    const basePotOdds = calculatePotOdds(potSize, amountToCall);
    const impliedPot = potSize + expectedAdditionalWinnings;
    const impliedTotal = impliedPot + amountToCall;
    const adjustedEquity = impliedTotal > 0 ? (amountToCall / impliedTotal) * 100 : 0;

    return {
        ...basePotOdds,
        impliedOdds: {
            expectedAdditional: expectedAdditionalWinnings,
            adjustedEquity,
        },
    };
};

export default PotOddsCalculator;
