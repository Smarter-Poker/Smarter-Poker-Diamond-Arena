/**
 * 🎮 POKERBROS-STYLE ACTION CONTROLS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Premium betting controls inspired by PokerBros mobile app.
 * Features: Fold/Check/Raise buttons, 2X/3X/4X/Pot presets, +/- adjustment.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActionType } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 🎮 ACTION CONTROLS PROPS
// ═══════════════════════════════════════════════════════════════════════════

interface ActionControlsProps {
    isMyTurn: boolean;
    chipStack: number;
    currentBet: number;        // Current bet at table
    myCurrentBet: number;      // What I've already put in
    minBet: number;            // Big blind
    minRaise: number;          // Minimum raise size
    potSize: number;
    maxBetAmount?: number;     // Max bet (for pot-limit games)
    onAction: (action: ActionType, amount?: number) => void;
    disabled?: boolean;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
    isMyTurn,
    chipStack,
    currentBet,
    myCurrentBet,
    minBet,
    minRaise,
    potSize,
    maxBetAmount,
    onAction,
    disabled = false,
}) => {
    const [showRaisePanel, setShowRaisePanel] = useState(false);
    const [raiseAmount, setRaiseAmount] = useState(0);

    const toCall = currentBet - myCurrentBet;
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && toCall < chipStack;
    const canBet = currentBet === 0 && chipStack > 0;
    const canRaise = currentBet > 0 && chipStack > toCall;

    const minRaiseTotal = currentBet + minRaise;
    const maxBet = maxBetAmount ?? (chipStack + myCurrentBet);

    // Calculate preset amounts
    const pot2x = Math.min(currentBet * 2 + toCall, maxBet);
    const pot3x = Math.min(currentBet * 3 + toCall, maxBet);
    const pot4x = Math.min(currentBet * 4 + toCall, maxBet);
    const potBet = Math.min(potSize + toCall * 2, maxBet);

    // Initialize raise amount when opening panel
    const openRaisePanel = useCallback(() => {
        setRaiseAmount(canBet ? minBet : minRaiseTotal);
        setShowRaisePanel(true);
    }, [canBet, minBet, minRaiseTotal]);

    const handleRaiseConfirm = () => {
        onAction(canBet ? 'BET' : 'RAISE', raiseAmount);
        setShowRaisePanel(false);
    };

    const adjustRaise = (delta: number) => {
        const newAmount = Math.max(
            canBet ? minBet : minRaiseTotal,
            Math.min(maxBet, raiseAmount + delta)
        );
        setRaiseAmount(newAmount);
    };

    if (!isMyTurn || disabled) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                padding: '12px 8px',
                background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.95) 30%)',
            }}
        >
            <AnimatePresence mode="wait">
                {!showRaisePanel ? (
                    // ═══════════════════════════════════════════════════════════
                    // MAIN ACTION BUTTONS
                    // ═══════════════════════════════════════════════════════════
                    <motion.div
                        key="actions"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'center',
                        }}
                    >
                        {/* FOLD Button */}
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onAction('FOLD')}
                            style={{
                                flex: 1,
                                maxWidth: 120,
                                padding: '16px 0',
                                borderRadius: 8,
                                border: 'none',
                                background: '#CC3333',
                                color: '#FFF',
                                fontSize: 16,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Fold
                        </motion.button>

                        {/* CHECK or CALL Button */}
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => canCheck ? onAction('CHECK') : onAction('CALL')}
                            style={{
                                flex: 1,
                                maxWidth: 120,
                                padding: '16px 0',
                                borderRadius: 8,
                                border: 'none',
                                background: '#0099CC',
                                color: '#FFF',
                                fontSize: 16,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {canCheck ? 'Check' : `Call ${toCall}`}
                        </motion.button>

                        {/* RAISE Button */}
                        {(canBet || canRaise) && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={openRaisePanel}
                                style={{
                                    flex: 1,
                                    maxWidth: 120,
                                    padding: '16px 0',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#FF6600',
                                    color: '#FFF',
                                    fontSize: 16,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                {canBet ? 'Bet' : 'Raise'}
                            </motion.button>
                        )}
                    </motion.div>
                ) : (
                    // ═══════════════════════════════════════════════════════════
                    // RAISE PANEL
                    // ═══════════════════════════════════════════════════════════
                    <motion.div
                        key="raise"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        {/* Amount Display with +/- */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 16,
                            }}
                        >
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => adjustRaise(-minBet)}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#0088CC',
                                    color: '#FFF',
                                    fontSize: 24,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                −
                            </motion.button>

                            <div
                                style={{
                                    minWidth: 100,
                                    textAlign: 'center',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 28,
                                        fontWeight: 800,
                                        color: '#FFD700',
                                    }}
                                >
                                    {raiseAmount.toLocaleString()}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: 'rgba(255,255,255,0.5)',
                                    }}
                                >
                                    {canBet ? 'BET' : 'RAISE TO'}
                                </div>
                            </div>

                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => adjustRaise(minBet)}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#0088CC',
                                    color: '#FFF',
                                    fontSize: 24,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                +
                            </motion.button>
                        </div>

                        {/* Preset Buttons */}
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                justifyContent: 'center',
                            }}
                        >
                            <PresetButton
                                label="2X"
                                onClick={() => setRaiseAmount(pot2x)}
                                active={raiseAmount === pot2x}
                            />
                            <PresetButton
                                label="3X"
                                onClick={() => setRaiseAmount(pot3x)}
                                active={raiseAmount === pot3x}
                            />
                            <PresetButton
                                label="4X"
                                onClick={() => setRaiseAmount(pot4x)}
                                active={raiseAmount === pot4x}
                            />
                            <PresetButton
                                label="Pot"
                                onClick={() => setRaiseAmount(potBet)}
                                active={raiseAmount === potBet}
                            />
                            <PresetButton
                                label="All-In"
                                onClick={() => setRaiseAmount(maxBet)}
                                active={raiseAmount === maxBet}
                                highlight
                            />
                        </div>

                        {/* Action Buttons */}
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                justifyContent: 'center',
                            }}
                        >
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowRaisePanel(false)}
                                style={{
                                    flex: 1,
                                    maxWidth: 120,
                                    padding: '14px 0',
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    background: 'transparent',
                                    color: '#FFF',
                                    fontSize: 15,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </motion.button>

                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRaiseConfirm}
                                style={{
                                    flex: 2,
                                    maxWidth: 200,
                                    padding: '14px 0',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#FF6600',
                                    color: '#FFF',
                                    fontSize: 16,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Confirm
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔘 PRESET BUTTON
// ═══════════════════════════════════════════════════════════════════════════

interface PresetButtonProps {
    label: string;
    onClick: () => void;
    active?: boolean;
    highlight?: boolean;
}

const PresetButton: React.FC<PresetButtonProps> = ({
    label,
    onClick,
    active = false,
    highlight = false,
}) => (
    <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: active ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.2)',
            background: highlight
                ? 'linear-gradient(135deg, #FF4444, #CC2222)'
                : active
                    ? 'rgba(255,215,0,0.2)'
                    : 'rgba(255,255,255,0.05)',
            color: active ? '#FFD700' : '#FFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
        }}
    >
        {label}
    </motion.button>
);

export default ActionControls;
