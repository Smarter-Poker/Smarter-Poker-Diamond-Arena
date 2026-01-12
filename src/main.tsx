/**
 * 🎰 DIAMOND ARENA — MAIN ENTRY POINT (PREMIUM)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ONLINE POKER ROOM — PLAY FOR DIAMONDS 💎
 * 
 * Premium PokerBros-style UI with separated Cash Games and Tournaments.
 * All tables admin-created — no "Create Table" button for users.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';

// Poker Components
import { PokerRoom } from './poker/components/PokerRoom';
import { PokerRoomPremium } from './poker/components/PokerRoomPremium';
import { PokerLobbyPremium } from './poker/components/PokerLobbyPremium';
import { TournamentDetailsPage } from './poker/components/tournament/TournamentDetailsPage';
import { CashBuyInModal } from './poker/components/cash/CashBuyInModal';
import { HandReplayPage } from './poker/components/replay/HandReplayPage';
import { AuthModal } from './poker/components/AuthModal';
import type { PokerVariant, Card } from './poker/types/poker';

// Utilities
import { supabase, isSupabaseConfigured, getConnectionInfo } from './lib/supabase';

// Styles
import './styles/arena-globals.css';

// ═══════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════

type AppView = 'loading' | 'lobby' | 'table' | 'tournament-details' | 'hand-history' | 'hand-replay';

interface TournamentData {
    id: string;
    name: string;
    description: string;
    variant: PokerVariant;
    tableSize: number;
    buyIn: number;
    fee: number;
    prizePool: number;
    guaranteedPool: number;
    startTime: Date;
    status: 'REGISTERING' | 'LATE_REG' | 'RUNNING' | 'COMPLETED';
    entryCount: number;
    entriesRange: string;
    maxEntries: number;
    blindsUp: number;
    lateRegLevel: number;
    currentLevel: number;
    remainingPlayers: number;
    avgStack: number;
    startingChips: number;
    isReentry: boolean;
    reentryLimit: number | null;
    hasAddon: boolean;
    hasBigBlindAnte: boolean;
    blindStructure: string;
    earlyBirdBonus: string | null;
}

interface CashTableData {
    id: string;
    name: string;
    minBuyIn: number;
    maxBuyIn: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌌 LOADING SCREEN
// ═══════════════════════════════════════════════════════════════════════════

const LoadingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const connectionInfo = getConnectionInfo();

    React.useEffect(() => {
        const timer = setTimeout(onComplete, 2000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6 }}
            style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#050507',
                zIndex: 9999,
            }}
        >
            {/* Background Glow */}
            <div style={{
                position: 'absolute',
                width: 400,
                height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,224,255,0.1) 0%, transparent 70%)',
                filter: 'blur(60px)',
            }} />

            {/* Diamond Icon */}
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
                style={{ fontSize: 72, marginBottom: 32 }}
            >
                💎
            </motion.div>

            {/* Title */}
            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                style={{
                    color: '#FFB800',
                    fontSize: 36,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginBottom: 16,
                    textShadow: '0 0 40px rgba(255, 184, 0, 0.3)',
                }}
            >
                Diamond Arena
            </motion.h1>

            {/* Subtitle */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 16,
                    letterSpacing: '0.1em',
                    marginBottom: 48,
                }}
            >
                Online Poker • Play for Diamonds
            </motion.p>

            {/* Loading Bar */}
            <div style={{
                width: 200,
                height: 4,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                overflow: 'hidden',
            }}>
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                        width: '50%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, #FFB800, transparent)',
                    }}
                />
            </div>

            {/* Connection Status */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.4 }}
                style={{
                    marginTop: 48,
                    color: connectionInfo.isConfigured ? '#00FF94' : 'rgba(255,255,255,0.4)',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                }}
            >
                {connectionInfo.isConfigured
                    ? `✓ Connected to ${connectionInfo.project}`
                    : 'Demo Mode — Connect to Supabase for multiplayer'
                }
            </motion.p>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🃏 HAND HISTORY VIEW
// ═══════════════════════════════════════════════════════════════════════════

interface HandHistoryEntry {
    id: string;
    handNumber: number;
    timestamp: Date;
    tableName: string;
    variant: PokerVariant;
    result: number;
    mainPot: number;
}

const HandHistoryView: React.FC<{
    onBack: () => void;
    onViewHand: (handId: string) => void;
}> = ({ onBack, onViewHand }) => {
    // Demo hand history
    const [hands] = useState<HandHistoryEntry[]>([
        { id: 'hand-1', handNumber: 1, timestamp: new Date(Date.now() - 60000), tableName: 'Diamond Ring', variant: 'NLH', result: 450, mainPot: 900 },
        { id: 'hand-2', handNumber: 2, timestamp: new Date(Date.now() - 120000), tableName: 'Diamond Ring', variant: 'NLH', result: -200, mainPot: 400 },
        { id: 'hand-3', handNumber: 3, timestamp: new Date(Date.now() - 180000), tableName: 'PLO Action', variant: 'PLO', result: 1200, mainPot: 2400 },
        { id: 'hand-4', handNumber: 4, timestamp: new Date(Date.now() - 240000), tableName: 'Low Stakes', variant: 'NLH', result: 0, mainPot: 60 },
        { id: 'hand-5', handNumber: 5, timestamp: new Date(Date.now() - 300000), tableName: 'PLO Action', variant: 'PLO', result: -500, mainPot: 1000 },
    ]);

    return (
        <div style={{ minHeight: '100vh', background: '#0A1628', color: '#FFF' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onBack}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#00AAFF',
                        fontSize: 20,
                        cursor: 'pointer',
                        marginRight: 16,
                    }}
                >
                    ‹‹
                </motion.button>
                <span style={{ fontSize: 18, fontWeight: 600 }}>🃏 Hand History</span>
            </header>

            {/* Hand List */}
            <div style={{ padding: 20 }}>
                {hands.map(hand => (
                    <motion.div
                        key={hand.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onViewHand(hand.id)}
                        style={{
                            padding: 16,
                            marginBottom: 12,
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12,
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontWeight: 600 }}>{hand.tableName}</span>
                            <span style={{
                                color: hand.result > 0 ? '#00FF88' : hand.result < 0 ? '#FF4444' : 'rgba(255,255,255,0.5)',
                                fontWeight: 600,
                            }}>
                                {hand.result > 0 ? '+' : ''}{hand.result} 💎
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            <span>Hand #{hand.handNumber} • {hand.variant}</span>
                            <span>Pot: {hand.mainPot}</span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

const App: React.FC = () => {
    const [view, setView] = useState<AppView>('loading');
    const [currentTableId, setCurrentTableId] = useState<string | null>(null);
    const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(null);
    const [currentHandReplayId, setCurrentHandReplayId] = useState<string | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showBuyInModal, setShowBuyInModal] = useState(false);
    const [pendingCashTable, setPendingCashTable] = useState<CashTableData | null>(null);
    const [registeredTournaments, setRegisteredTournaments] = useState<Set<string>>(new Set());

    // User state
    const [userId, setUserId] = useState<string | null>(null);
    const [userBalance, setUserBalance] = useState(10000);
    const [username, setUsername] = useState('Guest');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
                setIsAuthenticated(true);
                fetchUserProfile(session.user.id);
            }
        };
        checkSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    setUserId(session.user.id);
                    setIsAuthenticated(true);
                    fetchUserProfile(session.user.id);
                } else {
                    setUserId(null);
                    setIsAuthenticated(false);
                    setUserBalance(10000);
                    setUsername('Guest');
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Fetch user profile (balance + username)
    const fetchUserProfile = useCallback(async (uid: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('diamond_balance, username')
            .eq('id', uid)
            .single();

        if (data && !error) {
            setUserBalance(data.diamond_balance || 10000);
            setUsername(data.username || 'Player');
        }
    }, []);

    const handleAuthSuccess = useCallback((uid: string) => {
        setUserId(uid);
        setIsAuthenticated(true);
        fetchUserProfile(uid);
        setShowAuthModal(false);
    }, [fetchUserProfile]);

    // ═══════════════════════════════════════════════════════════════════════
    // 🎮 CASH GAME FLOW
    // ═══════════════════════════════════════════════════════════════════════

    const handleJoinCashTable = useCallback((tableId: string) => {
        // For simulation tables, go directly
        if (tableId.startsWith('sim-')) {
            setCurrentTableId(tableId);
            setView('table');
            return;
        }

        // For real tables, show buy-in modal
        // Demo: use placeholder data
        setPendingCashTable({
            id: tableId,
            name: 'Cash Table',
            minBuyIn: 200,
            maxBuyIn: 2000,
        });
        setShowBuyInModal(true);
    }, []);

    const handleBuyInConfirm = useCallback((amount: number, autoRebuy: boolean) => {
        if (pendingCashTable) {
            console.log(`Buying in for ${amount} with autoRebuy: ${autoRebuy}`);
            setCurrentTableId(pendingCashTable.id);
            setShowBuyInModal(false);
            setPendingCashTable(null);
            setView('table');
        }
    }, [pendingCashTable]);

    const handleLeaveTable = useCallback(() => {
        setCurrentTableId(null);
        setView('lobby');
    }, []);

    // ═══════════════════════════════════════════════════════════════════════
    // 🏆 TOURNAMENT FLOW
    // ═══════════════════════════════════════════════════════════════════════

    const handleViewTournament = useCallback((tournamentId: string) => {
        // Demo tournament data
        const demoTournament: TournamentData = {
            id: tournamentId,
            name: '15K GTD✨WEEKNIGHT✨',
            description: '15K GTD NLH WEEKNIGHT / 65 BUY-IN / REBUY / NO ADD-ON',
            variant: 'NLH',
            tableSize: 9,
            buyIn: 58.50,
            fee: 6.50,
            prizePool: 15000,
            guaranteedPool: 15000,
            startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
            status: 'REGISTERING',
            entryCount: 13,
            entriesRange: '5-7K',
            maxEntries: 500,
            blindsUp: 10,
            lateRegLevel: 15,
            currentLevel: 0,
            remainingPlayers: 13,
            avgStack: 48000,
            startingChips: 40000,
            isReentry: true,
            reentryLimit: null,
            hasAddon: false,
            hasBigBlindAnte: false,
            blindStructure: 'Standard',
            earlyBirdBonus: 'LVL 2/+20% chip',
        };

        setCurrentTournament(demoTournament);
        setView('tournament-details');
    }, []);

    const handleTournamentRegister = useCallback(() => {
        if (currentTournament) {
            // Check balance
            const totalBuyIn = currentTournament.buyIn + currentTournament.fee;
            if (userBalance >= totalBuyIn) {
                setUserBalance(prev => prev - totalBuyIn);
                setRegisteredTournaments(prev => new Set(prev).add(currentTournament.id));
                console.log(`Registered for tournament ${currentTournament.id}`);
            } else {
                alert('Insufficient balance!');
            }
        }
    }, [currentTournament, userBalance]);

    const handleTournamentShare = useCallback(() => {
        if (currentTournament) {
            const shareUrl = `https://diamond.smarter.poker/t/${currentTournament.id}`;
            if (navigator.share) {
                navigator.share({
                    title: currentTournament.name,
                    text: `Join me for ${currentTournament.name}!`,
                    url: shareUrl,
                });
            } else {
                navigator.clipboard.writeText(shareUrl);
                alert('Link copied to clipboard!');
            }
        }
    }, [currentTournament]);

    // ═══════════════════════════════════════════════════════════════════════
    // 🃏 HAND HISTORY FLOW
    // ═══════════════════════════════════════════════════════════════════════

    const handleNavigateToHandHistory = useCallback(() => {
        setView('hand-history');
    }, []);

    const handleViewHandReplay = useCallback((handId: string) => {
        setCurrentHandReplayId(handId);
        setView('hand-replay');
    }, []);

    const handleShareHandReplay = useCallback(() => {
        if (currentHandReplayId) {
            const shareUrl = `https://s.smarter.poker/h/${currentHandReplayId}`;
            if (navigator.share) {
                navigator.share({
                    title: 'Check out this hand!',
                    text: 'Check out the hand I played on #DiamondArena',
                    url: shareUrl,
                });
            } else {
                navigator.clipboard.writeText(shareUrl);
                alert('Link copied to clipboard!');
            }
        }
    }, [currentHandReplayId]);

    // Demo hand replay data
    const demoHandReplay = {
        handId: currentHandReplayId || 'demo',
        serialNumber: '2049883074',
        timestamp: new Date(),
        variant: 'NLH' as PokerVariant,
        tableId: 'table-1',
        tableName: 'Diamond Ring',
        blinds: '10/20',
        handNumber: 5,
        totalHands: 10,
        mainPot: 2265,
        sidePots: [],
        communityCards: [
            { rank: 'A', suit: 's' },
            { rank: '5', suit: 's' },
            { rank: '9', suit: 'd' },
            { rank: '5', suit: 'h' },
            { rank: '2', suit: 'h' },
        ] as Card[],
        players: [
            { seatNumber: 1, playerId: 'p1', username: '-KingFish-', avatarUrl: null, position: 'UTG' as const, holeCards: [{ rank: 'Q', suit: 's' }, { rank: '4', suit: 'c' }] as Card[], finalHand: null, result: -10, potContribution: 10 },
            { seatNumber: 2, playerId: 'p2', username: 'soul king', avatarUrl: null, position: 'BTN' as const, holeCards: [{ rank: 'A', suit: 'd' }, { rank: 'K', suit: 's' }] as Card[], finalHand: null, result: 0, potContribution: 0 },
            { seatNumber: 3, playerId: 'p3', username: 'cubby2426', avatarUrl: null, position: 'SB' as const, holeCards: [{ rank: 'J', suit: 'h' }, { rank: '9', suit: 'h' }] as Card[], finalHand: null, result: -5, potContribution: 5 },
            { seatNumber: 4, playerId: 'p4', username: 'Im gna CUM', avatarUrl: null, position: 'BB' as const, holeCards: [{ rank: 'K', suit: 'd' }, { rank: '3', suit: 's' }] as Card[], finalHand: 'One Pair', result: -1125, potContribution: 1125 },
            { seatNumber: 5, playerId: 'p5', username: 'Wizurd', avatarUrl: null, position: 'MP' as const, holeCards: [{ rank: '7', suit: 'c' }, { rank: '7', suit: 'd' }] as Card[], finalHand: null, result: 0, potContribution: 0 },
            { seatNumber: 6, playerId: 'p6', username: 'monkey88', avatarUrl: null, position: 'CO' as const, holeCards: [{ rank: 'T', suit: 'd' }, { rank: 'T', suit: 's' }] as Card[], finalHand: 'Two Pair', result: 1137.73, potContribution: 100 },
        ],
        actions: [
            { street: 'preflop' as const, seatNumber: 1, action: 'CALL', amount: 20, timestamp: 1 },
            { street: 'preflop' as const, seatNumber: 6, action: 'RAISE', amount: 60, timestamp: 2 },
            { street: 'flop' as const, seatNumber: 4, action: 'CHECK', timestamp: 3 },
        ],
        winnerId: 'p6',
        winnerSeat: 6,
    };

    return (
        <>
            <AnimatePresence mode="wait">
                {view === 'loading' && (
                    <LoadingScreen
                        key="loading"
                        onComplete={() => setView('lobby')}
                    />
                )}

                {view === 'lobby' && (
                    <motion.div
                        key="lobby"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <PokerLobbyPremium
                            userBalance={userBalance}
                            username={username}
                            onJoinCashTable={handleJoinCashTable}
                            onViewTournament={handleViewTournament}
                            onNavigateToHandHistory={handleNavigateToHandHistory}
                        />
                    </motion.div>
                )}

                {view === 'table' && currentTableId && (
                    <motion.div
                        key="table"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.4 }}
                    >
                        {currentTableId.startsWith('sim-') ? (
                            <PokerRoomPremium
                                tableId={currentTableId}
                                userId={userId || `demo-${Math.random().toString(36).slice(2, 8)}`}
                                onLeaveTable={handleLeaveTable}
                            />
                        ) : (
                            <PokerRoom
                                tableId={currentTableId}
                                userId={userId || `demo-${Math.random().toString(36).slice(2, 8)}`}
                                onLeaveTable={handleLeaveTable}
                            />
                        )}
                    </motion.div>
                )}

                {view === 'tournament-details' && currentTournament && (
                    <motion.div
                        key="tournament"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <TournamentDetailsPage
                            tournament={currentTournament}
                            isRegistered={registeredTournaments.has(currentTournament.id)}
                            onBack={() => setView('lobby')}
                            onRegister={handleTournamentRegister}
                            onShare={handleTournamentShare}
                        />
                    </motion.div>
                )}

                {view === 'hand-history' && (
                    <motion.div
                        key="hand-history"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <HandHistoryView
                            onBack={() => setView('lobby')}
                            onViewHand={handleViewHandReplay}
                        />
                    </motion.div>
                )}

                {view === 'hand-replay' && currentHandReplayId && (
                    <motion.div
                        key="hand-replay"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <HandReplayPage
                            handData={demoHandReplay}
                            onClose={() => setView('hand-history')}
                            onShare={handleShareHandReplay}
                            onFavorite={() => console.log('Favorited')}
                            onPlayVideo={() => console.log('Play video replay')}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cash Buy-In Modal */}
            <CashBuyInModal
                isOpen={showBuyInModal}
                onClose={() => {
                    setShowBuyInModal(false);
                    setPendingCashTable(null);
                }}
                onConfirm={handleBuyInConfirm}
                minBuyIn={pendingCashTable?.minBuyIn || 200}
                maxBuyIn={pendingCashTable?.maxBuyIn || 2000}
                accountBalance={userBalance}
                tableName={pendingCashTable?.name}
            />

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
            />
        </>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 MOUNT APPLICATION
// ═══════════════════════════════════════════════════════════════════════════

const rootElement = document.getElementById('root');

if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} else {
    console.error('❌ [Diamond Arena] Root element not found');
}
