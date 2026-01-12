/**
 * 💵 CASH BUY-IN MODAL
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Buy-in modal for cash games with min/max slider and auto-rebuy option.
 * Matches PokerBros "BUY-IN" modal exactly.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 💵 CASH BUY-IN MODAL PROPS
// ═══════════════════════════════════════════════════════════════════════════

interface CashBuyInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number, autoRebuy: boolean) => void;
    minBuyIn: number;
    maxBuyIn: number;
    accountBalance: number;
    tableName?: string;
    countdownSeconds?: number;
}

export const CashBuyInModal: React.FC<CashBuyInModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    minBuyIn,
    maxBuyIn,
    accountBalance,
    tableName,
    countdownSeconds = 59,
}) => {
    const [amount, setAmount] = useState(minBuyIn);
    const [autoRebuy, setAutoRebuy] = useState(false);
    const [countdown, setCountdown] = useState(countdownSeconds);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setAmount(Math.min(minBuyIn, accountBalance));
            setAutoRebuy(false);
            setCountdown(countdownSeconds);
        }
    }, [isOpen, minBuyIn, accountBalance, countdownSeconds]);

    // Countdown timer
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, onClose]);

    // Clamp amount to valid range
    const effectiveMax = Math.min(maxBuyIn, accountBalance);
    const canBuyIn = amount >= minBuyIn && amount <= effectiveMax;

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(parseInt(e.target.value, 10));
    };

    const handleConfirm = () => {
        if (canBuyIn) {
            onConfirm(amount, autoRebuy);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.7)',
                            zIndex: 400,
                        }}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '90%',
                            maxWidth: 360,
                            background: 'linear-gradient(180deg, #1A2A4A 0%, #0D1520 100%)',
                            border: '2px solid rgba(100,150,255,0.3)',
                            borderRadius: 16,
                            padding: 24,
                            zIndex: 401,
                        }}
                    >
                        {/* Header with Countdown */}
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                            <div style={{ flex: 1 }}>
                                <span style={{ color: '#FFB800', fontSize: 13 }}>
                                    {countdown}s (Close)
                                </span>
                            </div>
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#FFF' }}>
                                BUY-IN
                            </span>
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: '50%',
                                        background: '#FFB800',
                                        border: 'none',
                                        color: '#000',
                                        fontSize: 16,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ×
                                </motion.button>
                            </div>
                        </div>

                        {/* Amount Display */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 700, color: '#FFF' }}>
                                    {minBuyIn}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Min</div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 36, fontWeight: 700, color: '#FFF' }}>
                                    {amount}
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 700, color: '#FFF' }}>
                                    {effectiveMax}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Max</div>
                            </div>
                        </div>

                        {/* Slider */}
                        <div style={{ marginBottom: 20 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                }}
                            >
                                <span style={{ fontSize: 20 }}>♠️</span>
                                <input
                                    type="range"
                                    min={minBuyIn}
                                    max={effectiveMax}
                                    value={amount}
                                    onChange={handleSliderChange}
                                    style={{
                                        flex: 1,
                                        height: 4,
                                        appearance: 'none',
                                        background: 'rgba(255,255,255,0.2)',
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Account Balance */}
                        <div
                            style={{
                                textAlign: 'center',
                                marginBottom: 20,
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: 13,
                            }}
                        >
                            ( Account Balance: <span style={{ color: '#FFB800' }}>{accountBalance.toFixed(2)}</span> )
                        </div>

                        {/* Auto Rebuy */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 12,
                                marginBottom: 16,
                            }}
                        >
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setAutoRebuy(!autoRebuy)}
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 4,
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    background: autoRebuy ? '#FFB800' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#000',
                                    fontSize: 14,
                                    fontWeight: 700,
                                }}
                            >
                                {autoRebuy ? '✓' : ''}
                            </motion.button>
                            <span style={{ color: '#FFF', fontSize: 14 }}>Auto Rebuy</span>
                        </div>

                        {/* Auto Rebuy Description */}
                        <div
                            style={{
                                textAlign: 'center',
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 12,
                                marginBottom: 24,
                                lineHeight: 1.4,
                            }}
                        >
                            When your stack drops to <span style={{ color: '#FF4444' }}>0%</span> of the initial buy-in,
                            <br />
                            it will be automatically replenished.
                        </div>

                        {/* Buy Chips Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleConfirm}
                            disabled={!canBuyIn}
                            style={{
                                width: '100%',
                                padding: '14px 0',
                                borderRadius: 25,
                                border: 'none',
                                background: canBuyIn
                                    ? 'linear-gradient(135deg, #FFB800, #FF8C00)'
                                    : 'rgba(100,100,100,0.3)',
                                color: canBuyIn ? '#000' : 'rgba(255,255,255,0.4)',
                                fontSize: 16,
                                fontWeight: 700,
                                cursor: canBuyIn ? 'pointer' : 'not-allowed',
                            }}
                        >
                            Buy Chips
                        </motion.button>

                        {/* Insufficient Balance Warning */}
                        {accountBalance < minBuyIn && (
                            <div
                                style={{
                                    marginTop: 12,
                                    textAlign: 'center',
                                    color: '#FF4444',
                                    fontSize: 12,
                                }}
                            >
                                Insufficient balance. Minimum buy-in is {minBuyIn} 💎
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CashBuyInModal;
