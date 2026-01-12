/**
 * 🎯 BETTING CONTROLS — ACTION INTERFACE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Fold, Check, Call, Bet, Raise slider with keyboard shortcuts.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActionType } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 BUTTON STYLES
// ═══════════════════════════════════════════════════════════════════════════

const BUTTON_STYLES: Record<ActionType, { bg: string; hoverBg: string; color: string }> = {
    FOLD: { bg: '#444', hoverBg: '#555', color: '#FFF' },
    CHECK: { bg: '#00AA70', hoverBg: '#00CC88', color: '#FFF' },
    CALL: { bg: '#0099CC', hoverBg: '#00BBEE', color: '#FFF' },
    BET: { bg: '#FF9900', hoverBg: '#FFAA22', color: '#000' },
    RAISE: { bg: '#FF6600', hoverBg: '#FF7722', color: '#FFF' },
    ALL_IN: { bg: '#FF3333', hoverBg: '#FF5555', color: '#FFF' },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 BETTING CONTROLS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface BettingControlsProps {
    isMyTurn: boolean;
    chipStack: number;
    currentBet: number;        // Current bet at table
    myCurrentBet: number;      // What I've already put in
    minBet: number;            // Big blind
    minRaise: number;          // Minimum raise size
    potSize: number;
    onAction: (action: ActionType, amount?: number) => void;
    disabled?: boolean;
}

export const BettingControls: React.FC<BettingControlsProps> = ({
    isMyTurn,
    chipStack,
    currentBet,
    myCurrentBet,
    minBet,
    minRaise,
    potSize,
    onAction,
    disabled = false,
}) => {
    const [betAmount, setBetAmount] = useState(minBet);
    const [isSliderOpen, setIsSliderOpen] = useState(false);

    const toCall = currentBet - myCurrentBet;
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && toCall < chipStack;
    const canBet = currentBet === 0 && chipStack > 0;
    const canRaise = currentBet > 0 && chipStack > toCall;

    const minRaiseTotal = currentBet + minRaise;
    const maxBet = chipStack + myCurrentBet;

    // Reset bet amount when turn changes
    useEffect(() => {
        setBetAmount(canBet ? minBet : minRaiseTotal);
    }, [isMyTurn, canBet, minBet, minRaiseTotal]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isMyTurn || disabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'f':
                    if (!canCheck) onAction('FOLD');
                    break;
                case 'c':
                    if (canCheck) onAction('CHECK');
                    else if (canCall) onAction('CALL');
                    break;
                case 'b':
                    if (canBet) setIsSliderOpen(true);
                    break;
                case 'r':
                    if (canRaise) setIsSliderOpen(true);
                    break;
                case 'a':
                    onAction('ALL_IN');
                    break;
                case 'escape':
                    setIsSliderOpen(false);
                    break;
                case 'enter':
                    if (isSliderOpen) {
                        onAction(canBet ? 'BET' : 'RAISE', betAmount);
                        setIsSliderOpen(false);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMyTurn, disabled, canCheck, canCall, canBet, canRaise, betAmount, isSliderOpen, onAction]);

    const handleBetSizeClick = (multiplier: number) => {
        const newAmount = Math.min(Math.floor(potSize * multiplier) + currentBet, maxBet);
        setBetAmount(Math.max(newAmount, minRaiseTotal));
    };

    const handleSubmitBet = useCallback(() => {
        onAction(canBet ? 'BET' : 'RAISE', betAmount);
        setIsSliderOpen(false);
    }, [canBet, betAmount, onAction]);

    if (!isMyTurn) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 14,
                }}
            >
                Waiting for your turn...
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 16,
                background: 'rgba(0,0,0,0.8)',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {/* Bet Slider Section */}
            <AnimatePresence>
                {isSliderOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            overflow: 'hidden',
                        }}
                    >
                        {/* Bet Amount Display */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: '12px 0',
                        }}>
                            <span style={{ fontSize: 24 }}>💎</span>
                            <span style={{
                                fontSize: 32,
                                fontWeight: 700,
                                color: '#FFB800',
                            }}>
                                {betAmount.toLocaleString()}
                            </span>
                        </div>

                        {/* Slider */}
                        <input
                            type="range"
                            min={canBet ? minBet : minRaiseTotal}
                            max={maxBet}
                            value={betAmount}
                            onChange={(e) => setBetAmount(parseInt(e.target.value))}
                            style={{
                                width: '100%',
                                height: 8,
                                borderRadius: 4,
                                background: 'rgba(255,255,255,0.1)',
                                cursor: 'pointer',
                            }}
                        />

                        {/* Quick Bet Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'center',
                        }}>
                            {[
                                { label: 'MIN', value: canBet ? minBet : minRaiseTotal },
                                { label: '½ Pot', mult: 0.5 },
                                { label: '¾ Pot', mult: 0.75 },
                                { label: 'Pot', mult: 1 },
                                { label: 'MAX', value: maxBet },
                            ].map((btn) => (
                                <button
                                    key={btn.label}
                                    onClick={() => btn.mult
                                        ? handleBetSizeClick(btn.mult)
                                        : setBetAmount(btn.value!)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 4,
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: 'rgba(255,255,255,0.8)',
                                        fontSize: 11,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {/* Confirm Button */}
                        <button
                            onClick={handleSubmitBet}
                            style={{
                                padding: '12px 24px',
                                borderRadius: 8,
                                border: 'none',
                                background: BUTTON_STYLES[canBet ? 'BET' : 'RAISE'].bg,
                                color: BUTTON_STYLES[canBet ? 'BET' : 'RAISE'].color,
                                fontSize: 16,
                                fontWeight: 700,
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                            }}
                        >
                            {canBet ? 'BET' : 'RAISE TO'} {betAmount.toLocaleString()}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Action Buttons */}
            <div style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'center',
            }}>
                {/* Fold */}
                {!canCheck && (
                    <ActionButton
                        action="FOLD"
                        label="Fold"
                        shortcut="F"
                        onClick={() => onAction('FOLD')}
                        disabled={disabled}
                    />
                )}

                {/* Check */}
                {canCheck && (
                    <ActionButton
                        action="CHECK"
                        label="Check"
                        shortcut="C"
                        onClick={() => onAction('CHECK')}
                        disabled={disabled}
                    />
                )}

                {/* Call */}
                {canCall && (
                    <ActionButton
                        action="CALL"
                        label={`Call ${toCall.toLocaleString()}`}
                        shortcut="C"
                        onClick={() => onAction('CALL')}
                        disabled={disabled}
                    />
                )}

                {/* Bet */}
                {canBet && (
                    <ActionButton
                        action="BET"
                        label="Bet"
                        shortcut="B"
                        onClick={() => setIsSliderOpen(true)}
                        disabled={disabled}
                        active={isSliderOpen}
                    />
                )}

                {/* Raise */}
                {canRaise && (
                    <ActionButton
                        action="RAISE"
                        label="Raise"
                        shortcut="R"
                        onClick={() => setIsSliderOpen(true)}
                        disabled={disabled}
                        active={isSliderOpen}
                    />
                )}

                {/* All-In */}
                <ActionButton
                    action="ALL_IN"
                    label={`All-In (${chipStack.toLocaleString()})`}
                    shortcut="A"
                    onClick={() => onAction('ALL_IN')}
                    disabled={disabled || chipStack === 0}
                />
            </div>

            {/* Pot Info */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 16,
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
            }}>
                <span>Pot: 💎 {potSize.toLocaleString()}</span>
                {toCall > 0 && <span>To Call: 💎 {toCall.toLocaleString()}</span>}
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔘 ACTION BUTTON
// ═══════════════════════════════════════════════════════════════════════════

interface ActionButtonProps {
    action: ActionType;
    label: string;
    shortcut: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
    action,
    label,
    shortcut,
    onClick,
    disabled = false,
    active = false,
}) => {
    const style = BUTTON_STYLES[action];

    return (
        <motion.button
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '12px 20px',
                borderRadius: 8,
                border: active ? '2px solid #FFF' : 'none',
                background: disabled ? '#333' : style.bg,
                color: disabled ? '#666' : style.color,
                fontSize: 14,
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                minWidth: 80,
                transition: 'background 0.15s ease',
            }}
        >
            <span>{label}</span>
            <span style={{
                fontSize: 10,
                opacity: 0.6,
                fontWeight: 400,
            }}>
                [{shortcut}]
            </span>
        </motion.button>
    );
};

export default BettingControls;
