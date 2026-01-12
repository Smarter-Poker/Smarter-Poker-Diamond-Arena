/**
 * 🎰 POKERBROS-STYLE PREMIUM POKER ROOM
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Full-featured poker room with premium visuals and mobile-first design.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PokerTablePremium } from './PokerTablePremium';
import { ActionControls } from './ActionControls';
import { TableMenu, MenuButton } from './TableMenu';
import { useSimulatedTable } from '../hooks/useSimulatedTable';
import { usePokerTable } from '../hooks/usePoker';
import type { ActionType, TableState } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 PREMIUM POKER ROOM PROPS
// ═══════════════════════════════════════════════════════════════════════════

interface PokerRoomPremiumProps {
    tableId: string;
    userId: string;
    onLeaveTable: () => void;
}

export const PokerRoomPremium: React.FC<PokerRoomPremiumProps> = ({
    tableId,
    userId,
    onLeaveTable,
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [fourColorDeck, setFourColorDeck] = useState(false);
    const [timerProgress, setTimerProgress] = useState(100);
    const [, forceUpdate] = useState(0);

    // Use simulated table for offline mode
    const isSimulated = tableId.startsWith('sim-');
    const simulatedTable = useSimulatedTable(tableId, userId);
    const realtimeTable = usePokerTable(tableId, userId);

    const table = isSimulated ? simulatedTable : realtimeTable;
    const {
        tableInfo,
        players,
        isLoading,
        seatPlayer,
        leaveTable,
        sendAction,
        engine,
    } = table;

    // For simulated tables, track updateTrigger to force re-renders
    const updateTrigger = 'updateTrigger' in table ? (table as any).updateTrigger : 0;

    // Force re-render when updateTrigger changes
    useEffect(() => {
        forceUpdate(prev => prev + 1);
    }, [updateTrigger]);

    // Get current state from engine (simulated) or reconstruct (realtime)
    const state = engine?.getState() || null;
    const heroPlayer = state?.seats.find(p => p?.id === userId) || null;
    const heroSeat = heroPlayer?.seatNumber || null;
    const isHeroTurn = heroPlayer?.isTurn || false;

    // Timer countdown when it's hero's turn
    useEffect(() => {
        if (!isHeroTurn) {
            setTimerProgress(100);
            return;
        }

        const timeLimit = 20000; // 20 seconds
        const startTime = Date.now();

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / timeLimit) * 100);
            setTimerProgress(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [isHeroTurn]);

    // Seat at table
    const handleSeatClick = useCallback((seatNumber: number) => {
        if (!state) return;

        const seat = state.seats[seatNumber - 1];
        if (!seat) {
            seatPlayer(seatNumber);
        }
    }, [state, seatPlayer]);

    // Handle action
    const handleAction = useCallback((action: ActionType, amount?: number) => {
        if (!heroSeat) return;
        sendAction(action, amount);
    }, [heroSeat, sendAction]);

    // Handle exit
    const handleExit = useCallback(() => {
        leaveTable();
        onLeaveTable();
    }, [leaveTable, onLeaveTable]);

    // Loading state
    if (isLoading || !state) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    background: '#0A1628',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{ fontSize: 48 }}
                >
                    💎
                </motion.div>
            </div>
        );
    }

    // Calculate betting values for action controls
    const currentBet = state.currentBet || 0;
    const myCurrentBet = heroPlayer?.currentBet || 0;
    const potSize = state.pots.reduce((sum, pot) => sum + pot.amount, 0);
    const chipStack = heroPlayer?.chipStack || 0;
    const minBet = state.config.bigBlind;
    const minRaise = state.minRaise;

    // Calculate max bet for pot-limit games
    let maxBetAmount: number | undefined;
    if (state.config.bettingStructure === 'POT_LIMIT') {
        const toCall = currentBet - myCurrentBet;
        maxBetAmount = potSize + toCall * 2;
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#0A1628',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Background Pattern */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: `
                        repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 30px,
                            rgba(0,50,100,0.02) 30px,
                            rgba(0,50,100,0.02) 60px
                        )
                    `,
                    pointerEvents: 'none',
                }}
            />

            {/* Header */}
            <header
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 60,
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 100,
                    background: 'linear-gradient(180deg, rgba(10,22,40,0.95) 0%, transparent 100%)',
                }}
            >
                {/* Left: Menu + Add Table */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <MenuButton onClick={() => setShowMenu(true)} />
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            background: 'rgba(0,100,150,0.3)',
                            border: '1px solid rgba(0,150,200,0.4)',
                            color: '#0099CC',
                            fontSize: 20,
                            cursor: 'pointer',
                        }}
                    >
                        +
                    </motion.button>
                </div>

                {/* Center: Jackpot (optional) */}
                <div
                    style={{
                        padding: '6px 16px',
                        background: 'linear-gradient(90deg, #FF6B00, #FFB800)',
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#FFF',
                        letterSpacing: '0.05em',
                    }}
                >
                    JACKPOT 💰 000,000
                </div>

                {/* Right: Help + Stats */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 14,
                            cursor: 'pointer',
                        }}
                    >
                        ?
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowStats(true)}
                        style={{
                            height: 32,
                            padding: '0 12px',
                            borderRadius: 6,
                            background: 'rgba(0,100,150,0.3)',
                            border: '1px solid rgba(0,150,200,0.4)',
                            color: '#0099CC',
                            fontSize: 11,
                            cursor: 'pointer',
                        }}
                    >
                        📊
                    </motion.button>
                </div>
            </header>

            {/* Main Table */}
            <main
                style={{
                    paddingTop: 70,
                    paddingBottom: 120,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                }}
            >
                <PokerTablePremium
                    state={state}
                    heroId={userId}
                    onSeatClick={handleSeatClick}
                    fourColorDeck={fourColorDeck}
                    timerProgress={timerProgress}
                />
            </main>

            {/* Bottom HUD: Timer + Chat */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 80,
                    left: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}
            >
                {/* Diamond Balance */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#FFB800',
                    }}
                >
                    💎 10
                </div>

                {/* Timer */}
                {isHeroTurn && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            background: 'rgba(0,0,0,0.6)',
                            borderRadius: 8,
                            fontSize: 13,
                            color: timerProgress < 30 ? '#FF4444' : '#00CCFF',
                        }}
                    >
                        ⏱️ {Math.ceil(timerProgress / 5)}s
                    </div>
                )}
            </div>

            {/* Hand History Button */}
            <motion.button
                whileTap={{ scale: 0.95 }}
                style={{
                    position: 'fixed',
                    bottom: 80,
                    left: 16,
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    fontSize: 20,
                    cursor: 'pointer',
                }}
            >
                🃏
            </motion.button>

            {/* Chat Button */}
            <motion.button
                whileTap={{ scale: 0.95 }}
                style={{
                    position: 'fixed',
                    bottom: 80,
                    right: 16,
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    fontSize: 20,
                    cursor: 'pointer',
                }}
            >
                💬
            </motion.button>

            {/* Action Controls */}
            {isHeroTurn && (
                <ActionControls
                    isMyTurn={true}
                    chipStack={chipStack}
                    currentBet={currentBet}
                    myCurrentBet={myCurrentBet}
                    minBet={minBet}
                    minRaise={minRaise}
                    potSize={potSize}
                    maxBetAmount={maxBetAmount}
                    onAction={handleAction}
                />
            )}

            {/* Slide-out Menu */}
            <TableMenu
                isOpen={showMenu}
                onClose={() => setShowMenu(false)}
                onExit={handleExit}
                soundEnabled={soundEnabled}
                onSoundToggle={() => setSoundEnabled(!soundEnabled)}
            />

            {/* Stats Panel (slide-in from right) */}
            <AnimatePresence>
                {showStats && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowStats(false)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0,0,0,0.5)',
                                zIndex: 200,
                            }}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            style={{
                                position: 'fixed',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: 300,
                                background: '#0D1520',
                                borderLeft: '1px solid rgba(255,255,255,0.1)',
                                zIndex: 201,
                                padding: 24,
                            }}
                        >
                            <h3 style={{ color: '#FFF', margin: '0 0 24px' }}>
                                REAL TIME RESULT
                            </h3>

                            <StatRow label="Game Name" value={state.config.name} />
                            <StatRow label="Game ID" value={tableId.slice(0, 8)} />
                            <StatRow label="Table" value={state.config.variant || 'NLH'} />
                            <StatRow label="Blinds" value={`${state.config.smallBlind}/${state.config.bigBlind}`} />

                            <div style={{ height: 24 }} />

                            <h4 style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', fontSize: 13 }}>
                                Profile Data
                            </h4>
                            <StatRow label="Buy-in" value={chipStack.toString()} />
                            <StatRow label="Current Table VPIP" value="-%" />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 STAT ROW
// ═══════════════════════════════════════════════════════════════════════════

const StatRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div
        style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
    >
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{label}:</span>
        <span style={{ color: '#FFF', fontSize: 13 }}>{value}</span>
    </div>
);

export default PokerRoomPremium;
