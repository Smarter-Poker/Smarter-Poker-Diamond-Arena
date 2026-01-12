/**
 * 🎰 POKER ROOM PAGE — LIVE MULTIPLAYER TABLE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Real-time multiplayer poker table with Supabase integration.
 * Supports live seating, betting actions, and real-time state sync.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TableState, TableConfig, ActionType, Card } from '../types/poker';
import { usePokerTable, dbRowToPlayer, dbRowToTableConfig } from '../hooks/usePoker';
import { PokerTable } from './PokerTable';
import { BettingControls } from './BettingControls';
import { HandHistoryPanel } from './HandHistoryPanel';
import { ChatPanel } from './ChatPanel';
import { TableSettingsPanel } from './TableSettingsPanel';
import { LeaderboardPanel } from './LeaderboardPanel';
import { QuickActionsHUD } from './QuickActionsHUD';
import { PotOddsCalculator } from './PotOddsCalculator';
import { useGameSettings } from '../hooks/useGameSettings';
import { analyzeHandStrength } from '../engine/hand-strength';
import { useGameEffects } from '../hooks/useGameEffects';
import { useAutoAction } from '../hooks/useAutoAction';

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 POKER ROOM COMPONENT — LIVE MULTIPLAYER
// ═══════════════════════════════════════════════════════════════════════════

interface PokerRoomProps {
    tableId: string;
    userId: string;
    onLeaveTable: () => void;
}

export const PokerRoom: React.FC<PokerRoomProps> = ({
    tableId,
    userId,
    onLeaveTable,
}) => {
    // Connect to live table via hook
    const {
        isConnected,
        isLoading,
        error,
        tableInfo,
        players,
        onlinePlayers,
        heroSeat,
        isMyTurn,
        myChips,
        seatPlayer,
        leaveTable,
        sendAction,
        disconnect,
    } = usePokerTable(tableId, userId);

    // Local UI state
    const [showChat, setShowChat] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showSeatPicker, setShowSeatPicker] = useState(false);
    const [preActionMode, setPreActionMode] = useState<'CHECK_FOLD' | 'CALL_ANY' | null>(null);
    const [buyInAmount, setBuyInAmount] = useState(1000);
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [messages, setMessages] = useState<{ id: string; userId: string; username: string; message: string; timestamp: Date; type: 'CHAT' | 'SYSTEM' | 'EMOTE' | 'ACTION' }[]>([]);

    // Load settings
    const { settings, saveSettings } = useGameSettings();
    const [actionError, setActionError] = useState<string | null>(null);

    // Build TableState from live data
    const tableState: TableState | null = useMemo(() => {
        if (!tableInfo) return null;

        const config = dbRowToTableConfig(tableInfo);
        const seats: (ReturnType<typeof dbRowToPlayer> | null)[] = new Array(config.tableSize).fill(null);

        // Populate seats
        players.forEach(p => {
            if (p.seat_number >= 1 && p.seat_number <= config.tableSize) {
                seats[p.seat_number - 1] = dbRowToPlayer(p, userId);
            }
        });

        return {
            config,
            handNumber: tableInfo.hand_number,
            street: tableInfo.current_street as any,
            communityCards: tableInfo.community_cards || [],
            pots: [{ amount: tableInfo.pot_total, eligiblePlayers: players.map(p => p.user_id) }],
            currentBet: tableInfo.current_bet,
            minRaise: tableInfo.min_raise || config.bigBlind,
            seats,
        };
    }, [tableInfo, players, userId]);

    // Calculate pot total
    const totalPot = tableState?.pots.reduce((sum, pot) => sum + pot.amount, 0) ?? 0;

    // Integrate Sound & Animation Effects
    useGameEffects(tableState, isMyTurn, userId);

    // Handle player action
    const handleAction = useCallback(async (action: ActionType, amount?: number) => {
        setActionError(null);
        try {
            await sendAction(action, amount);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Action failed');
        }
    }, [sendAction]);

    // Integrate Auto-Action (Pre-moves)
    useAutoAction(
        tableState,
        isMyTurn,
        preActionMode,
        setPreActionMode,
        handleAction,
        heroSeat
    );

    // Handle seating
    const handleSeat = useCallback(async () => {
        if (selectedSeat === null) return;
        setActionError(null);

        const success = await seatPlayer(selectedSeat, buyInAmount);
        if (success) {
            setShowSeatPicker(false);
            setSelectedSeat(null);
        } else {
            setActionError('Failed to take seat');
        }
    }, [selectedSeat, buyInAmount, seatPlayer]);

    // Handle chat
    const handleSendMessage = useCallback((text: string) => {
        // In a real app, this would send to Supabase
        const newMessage = {
            id: Date.now().toString(),
            userId: userId,
            username: 'Hero', // Should come from profile
            message: text,
            timestamp: new Date(),
            type: text.startsWith('/me') ? 'ACTION' as const : 'CHAT' as const,
        };
        setMessages(prev => [...prev, newMessage]);
    }, [userId]);

    // Handle leaving
    const handleLeave = useCallback(async () => {
        const result = await leaveTable();
        if (result) {
            disconnect();
            onLeaveTable();
        }
    }, [leaveTable, disconnect, onLeaveTable]);

    // Get available seats
    const availableSeats = useMemo(() => {
        if (!tableInfo) return [];
        const occupiedSeats = new Set(players.map(p => p.seat_number));
        return Array.from({ length: tableInfo.table_size }, (_, i) => i + 1)
            .filter(seat => !occupiedSeats.has(seat));
    }, [tableInfo, players]);

    // ───────────────────────────────────────────────────────────────────────
    // LOADING / ERROR STATES
    // ───────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#050507',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{
                        width: 48,
                        height: 48,
                        border: '3px solid rgba(0,224,255,0.2)',
                        borderTopColor: '#00E0FF',
                        borderRadius: '50%',
                    }}
                />
                <span style={{ marginLeft: 16, color: '#00E0FF', fontSize: 18 }}>
                    Connecting to table...
                </span>
            </div>
        );
    }

    if (error || !tableState) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#050507',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
            }}>
                <span style={{ fontSize: 48 }}>❌</span>
                <span style={{ color: '#FF4444', fontSize: 18 }}>
                    {error || 'Failed to load table'}
                </span>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onLeaveTable}
                    style={{
                        marginTop: 20,
                        padding: '12px 32px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#FFF',
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    ← Back to Lobby
                </motion.button>
            </div>
        );
    }

    // ───────────────────────────────────────────────────────────────────────
    // MAIN RENDER
    // ───────────────────────────────────────────────────────────────────────

    const hero = heroSeat !== null ? tableState.seats[heroSeat - 1] : null;

    return (
        <div style={{
            minHeight: '100vh',
            background: '#050507',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Header Bar */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 24px',
                background: 'rgba(0,0,0,0.5)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={heroSeat ? handleLeave : onLeaveTable}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 13,
                            cursor: 'pointer',
                        }}
                    >
                        ← {heroSeat ? 'Cash Out' : 'Leave'}
                    </motion.button>

                    <span style={{ color: '#FFB800', fontWeight: 600 }}>
                        {tableState.config.name}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                        💎 {tableState.config.smallBlind}/{tableState.config.bigBlind} NL Hold'em
                    </span>

                    {/* Connection Status */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        background: isConnected ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                        borderRadius: 100,
                    }}>
                        <div style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: isConnected ? '#00FF88' : '#FF4444',
                        }} />
                        <span style={{
                            color: isConnected ? '#00FF88' : '#FF4444',
                            fontSize: 11,
                            fontWeight: 500,
                        }}>
                            {isConnected ? 'LIVE' : 'DISCONNECTED'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Online Players */}
                    <div style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 12,
                    }}>
                        👤 {onlinePlayers.length} watching
                    </div>

                    {/* Your Stack */}
                    {hero && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 16px',
                            background: 'rgba(0,224,255,0.1)',
                            borderRadius: 6,
                            border: '1px solid rgba(0,224,255,0.3)',
                        }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                                Your Stack:
                            </span>
                            <span style={{ fontSize: 16 }}>💎</span>
                            <span style={{
                                color: '#00E0FF',
                                fontSize: 16,
                                fontWeight: 700,
                            }}>
                                {myChips.toLocaleString()}
                            </span>
                        </div>
                    )}

                    {/* Take Seat Button (if not seated) */}
                    {!heroSeat && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowSeatPicker(true)}
                            disabled={availableSeats.length === 0}
                            style={{
                                padding: '8px 20px',
                                borderRadius: 6,
                                border: 'none',
                                background: 'linear-gradient(180deg, #00E0FF 0%, #00A8CC 100%)',
                                color: '#000',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: availableSeats.length > 0 ? 'pointer' : 'not-allowed',
                                opacity: availableSeats.length > 0 ? 1 : 0.5,
                            }}
                        >
                            Take Seat
                        </motion.button>
                    )}

                    {/* Chat Toggle */}
                    <button
                        onClick={() => setShowChat(!showChat)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: showChat ? 'rgba(0,224,255,0.2)' : 'transparent',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 13,
                            cursor: 'pointer',
                        }}
                    >
                        💬 Chat
                    </button>
                </div>
            </header>

            {/* Error Banner */}
            <AnimatePresence>
                {actionError && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{
                            padding: '8px 24px',
                            background: 'rgba(255,68,68,0.1)',
                            borderBottom: '1px solid rgba(255,68,68,0.3)',
                            color: '#FF4444',
                            fontSize: 13,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span>⚠️ {actionError}</span>
                        <button
                            onClick={() => setActionError(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#FF4444',
                                cursor: 'pointer',
                            }}
                        >
                            ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div style={{
                flex: 1,
                display: 'flex',
                padding: 24,
                gap: 24,
            }}>
                {/* Table Area */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <PokerTable
                        state={tableState}
                        heroId={userId}
                        width={900}
                        height={550}
                    />
                </div>

                {/* Chat Panel */}
                <AnimatePresence>
                    {showChat && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 280, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            style={{
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            <div style={{
                                padding: 12,
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: 13,
                                fontWeight: 500,
                            }}>
                                Table Chat
                            </div>
                            <div style={{
                                flex: 1,
                                padding: 12,
                                overflowY: 'auto',
                            }}>
                                {messages.length === 0 && (
                                    <div style={{
                                        color: 'rgba(255,255,255,0.3)',
                                        fontSize: 12,
                                        textAlign: 'center',
                                        marginTop: 20,
                                    }}>
                                        No messages yet
                                    </div>
                                )}
                            </div>
                            <div style={{
                                padding: 12,
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(0,0,0,0.3)',
                                        color: '#FFF',
                                        fontSize: 13,
                                    }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Betting Controls */}
            <div style={{
                padding: '16px 24px',
                background: 'rgba(0,0,0,0.5)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'center',
            }}>
                {heroSeat ? (
                    <BettingControls
                        isMyTurn={isMyTurn}
                        chipStack={myChips}
                        currentBet={tableState.currentBet}
                        myCurrentBet={hero?.currentBet ?? 0}
                        minBet={tableState.config.bigBlind}
                        minRaise={tableState.minRaise}
                        potSize={totalPot}
                        onAction={handleAction}
                        preAction={preActionMode}
                        onPreActionChange={setPreActionMode}
                    />
                ) : (
                    <div style={{
                        padding: '20px 40px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.06)',
                        textAlign: 'center',
                    }}>
                        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
                            Take a seat to join the action
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowSeatPicker(true)}
                            disabled={availableSeats.length === 0}
                            style={{
                                padding: '12px 32px',
                                borderRadius: 8,
                                border: 'none',
                                background: 'linear-gradient(180deg, #00E0FF 0%, #00A8CC 100%)',
                                color: '#000',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: availableSeats.length > 0 ? 'pointer' : 'not-allowed',
                                opacity: availableSeats.length > 0 ? 1 : 0.5,
                            }}
                        >
                            {availableSeats.length > 0 ? '🎰 Take Seat' : 'Table Full'}
                        </motion.button>
                    </div>
                )}
            </div>

            {/* Seat Picker Modal */}
            <AnimatePresence>
                {showSeatPicker && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSeatPicker(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 100,
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#0A0A0C',
                                borderRadius: 16,
                                border: '1px solid rgba(0,224,255,0.3)',
                                padding: 32,
                                minWidth: 400,
                            }}
                        >
                            <h2 style={{
                                color: '#00E0FF',
                                fontSize: 20,
                                fontWeight: 600,
                                marginBottom: 24,
                                textAlign: 'center',
                            }}>
                                🎰 Take Your Seat
                            </h2>

                            {/* Available Seats */}
                            <div style={{ marginBottom: 24 }}>
                                <label style={{
                                    display: 'block',
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: 12,
                                    marginBottom: 8,
                                }}>
                                    Select Seat
                                </label>
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                }}>
                                    {availableSeats.map(seat => (
                                        <button
                                            key={seat}
                                            onClick={() => setSelectedSeat(seat)}
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 8,
                                                border: selectedSeat === seat
                                                    ? '2px solid #00E0FF'
                                                    : '1px solid rgba(255,255,255,0.2)',
                                                background: selectedSeat === seat
                                                    ? 'rgba(0,224,255,0.2)'
                                                    : 'rgba(255,255,255,0.05)',
                                                color: selectedSeat === seat ? '#00E0FF' : '#FFF',
                                                fontSize: 16,
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {seat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Buy-in Amount */}
                            <div style={{ marginBottom: 24 }}>
                                <label style={{
                                    display: 'block',
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: 12,
                                    marginBottom: 8,
                                }}>
                                    Buy-in Amount (💎 {tableInfo?.min_buy_in} - {tableInfo?.max_buy_in})
                                </label>
                                <input
                                    type="range"
                                    min={tableInfo?.min_buy_in || 400}
                                    max={tableInfo?.max_buy_in || 2000}
                                    step={tableInfo?.big_blind || 20}
                                    value={buyInAmount}
                                    onChange={e => setBuyInAmount(Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        marginBottom: 8,
                                    }}
                                />
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                                        Min: 💎 {tableInfo?.min_buy_in}
                                    </span>
                                    <span style={{ color: '#00E0FF', fontSize: 20, fontWeight: 700 }}>
                                        💎 {buyInAmount.toLocaleString()}
                                    </span>
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                                        Max: 💎 {tableInfo?.max_buy_in}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{
                                display: 'flex',
                                gap: 12,
                            }}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowSeatPicker(false)}
                                    style={{
                                        flex: 1,
                                        padding: '12px 24px',
                                        borderRadius: 8,
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        background: 'transparent',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: 14,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSeat}
                                    disabled={selectedSeat === null}
                                    style={{
                                        flex: 1,
                                        padding: '12px 24px',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: selectedSeat !== null
                                            ? 'linear-gradient(180deg, #00E0FF 0%, #00A8CC 100%)'
                                            : 'rgba(255,255,255,0.1)',
                                        color: selectedSeat !== null ? '#000' : 'rgba(255,255,255,0.3)',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: selectedSeat !== null ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    💎 Buy In
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quick Actions HUD */}
            <QuickActionsHUD
                onOpenChat={() => setShowChat(!showChat)}
                onOpenHistory={() => setShowHistory(true)}
                onOpenSettings={() => setShowSettings(true)}
                onOpenLeaderboard={() => setShowLeaderboard(true)}
                onRebuy={() => console.log('Rebuy functionality to be implemented')}
                onSitOut={() => console.log('Sit Out functionality to be implemented')}
                onLeaveTable={onLeaveTable}
                isSittingOut={false}
                canRebuy={myChips < tableState.config.maxBuyIn}
                isSeated={heroSeat !== undefined}
                connectionStatus={isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            />

            {/* Chat Panel (Left Side Overlay) */}
            <AnimatePresence>
                {showChat && (
                    <motion.div
                        initial={{ x: -300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -300, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={{
                            position: 'absolute',
                            top: 60,
                            bottom: 20,
                            left: 20,
                            zIndex: 40,
                        }}
                    >
                        <ChatPanel
                            messages={messages}
                            currentUserId={userId}
                            onSendMessage={handleSendMessage}
                            onToggleCollapse={() => setShowChat(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hand History Panel */}
            <HandHistoryPanel
                hands={[
                    // Mock data for initial display
                    {
                        handId: 'h1',
                        timestamp: new Date(),
                        holeCards: [{ rank: 'A', suit: 'SPADES' }, { rank: 'K', suit: 'SPADES' }],
                        communityCards: [{ rank: 'Q', suit: 'SPADES' }, { rank: 'J', suit: 'SPADES' }, { rank: '10', suit: 'SPADES' }, { rank: '2', suit: 'HEARTS' }, { rank: '3', suit: 'CLUBS' }],
                        netProfit: 500,
                        winnerId: userId,
                        isWinner: true,
                        actionSummary: 'Royal Flush! Won 500 diamonds.',
                        finalHandRank: 'Royal Flush'
                    }
                ]}
                heroId={userId}
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
            />

            {/* Table Settings Panel */}
            <TableSettingsPanel
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onSave={(newSettings) => {
                    saveSettings(newSettings);
                    setShowSettings(false);
                }}
            />

            {/* Leaderboard Panel */}
            <LeaderboardPanel
                entries={[
                    { rank: 1, userId: 'u1', username: 'PokerPro', value: 50000, trend: 'UP', isOnline: true },
                    { rank: 2, userId: 'u2', username: 'ChipLeader', value: 45000, trend: 'DOWN', isOnline: true },
                    { rank: 3, userId: userId, username: 'Hero', value: 30000, trend: 'SAME', isOnline: true },
                    { rank: 4, userId: 'u3', username: 'Shark', value: 25000, trend: 'UP', isOnline: false },
                ]}
                currentUserId={userId}
                isOpen={showLeaderboard}
                onClose={() => setShowLeaderboard(false)}
            />

            {/* Analytics: Pot Odds Calculator */}
            {/* Analytics: Pot Odds Calculator */}
            {heroSeat !== undefined && isMyTurn && (
                <PotOddsCalculator
                    potSize={totalPot}
                    amountToCall={tableState.currentBet - ((tableState.seats[heroSeat - 1]?.bet || 0))}
                    estimatedEquity={useMemo(() => {
                        const hero = tableState.seats[heroSeat - 1];
                        if (!hero?.holeCards) return 0;
                        const analysis = analyzeHandStrength(hero.holeCards, tableState.communityCards);
                        return analysis.equity;
                    }, [tableState.seats[heroSeat - 1]?.holeCards, tableState.communityCards])}
                    isVisible={settings.showPotOdds}
                    position="BOTTOM"
                />
            )}
        </div>
    );
};

export default PokerRoom;
