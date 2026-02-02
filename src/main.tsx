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
import { HandReplayPage, type HandReplayData } from './poker/components/replay/HandReplayPage';
import { AuthModal } from './poker/components/AuthModal';
import type { PokerVariant, Card, TournamentDetails } from './poker/types/poker';

// Utilities
import { supabase, isSupabaseConfigured, getConnectionInfo } from './lib/supabase';
import { tournamentService } from './poker/services/TournamentService';
import { handHistoryService } from './poker/services/HandHistoryService';
import { pokerService } from './poker/services/poker-realtime'; // Ensure this is available if needed

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
    userId?: string | null;
}> = ({ onBack, onViewHand, userId }) => {
    const [hands, setHands] = useState<HandHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await handHistoryService.fetchRecentHands(userId || 'demo');
                setHands(data.map((h, i) => ({
                    id: h.id,
                    handNumber: i + 1, // Service doesn't return hand num in summary yet
                    timestamp: h.timestamp,
                    tableName: h.summary.split(' - ')[1] || 'Unknown Table',
                    variant: (h.summary.split(' - ')[0] as PokerVariant) || 'NLH',
                    result: h.winAmount,
                    mainPot: 0 // Service summary doesn't include pot yet
                })));
            } catch (err) {
                console.error("Failed to fetch history", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [userId]);

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
                {isLoading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>Loading history...</div>
                ) : (
                    hands.map(hand => (
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
                                <span>{hand.timestamp.toLocaleDateString()}</span>
                            </div>
                        </motion.div>
                    ))
                )}
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
    const [currentTournament, setCurrentTournament] = useState<TournamentDetails | null>(null);
    const [currentHandReplayId, setCurrentHandReplayId] = useState<string | null>(null);
    const [currentHandReplayData, setCurrentHandReplayData] = useState<HandReplayData | null>(null);
    const [loadingReplay, setLoadingReplay] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showBuyInModal, setShowBuyInModal] = useState(false);
    const [pendingCashTable, setPendingCashTable] = useState<CashTableData | null>(null);
    const [registeredTournaments, setRegisteredTournaments] = useState<Set<string>>(new Set());

    // User state
    const [userId, setUserId] = useState<string | null>(null);
    const [userBalance, setUserBalance] = useState(10000);
    const [username, setUsername] = useState('Guest');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // PARALLEL LOADING: Track data ready state separately from animation
    const [dataReady, setDataReady] = useState(false);
    const [animationComplete, setAnimationComplete] = useState(false);

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

    // START DATA LOADING IMMEDIATELY on mount (parallel with loading screen)
    useEffect(() => {
        const loadAllData = async () => {
            console.log('[DiamondArena] Starting parallel data loading...');

            // Check session
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
                setIsAuthenticated(true);
                await fetchUserProfile(session.user.id);
            }

            // Mark data as ready
            console.log('[DiamondArena] Data loading complete');
            setDataReady(true);
        };

        loadAllData();

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
    }, [fetchUserProfile]);

    // TRANSITION TO LOBBY: Only when BOTH animation AND data are ready
    useEffect(() => {
        if (animationComplete && dataReady && view === 'loading') {
            console.log('[DiamondArena] Both animation and data ready - transitioning to lobby');
            setView('lobby');
        }
    }, [animationComplete, dataReady, view]);

    // Handle loading screen animation complete
    const handleLoadingComplete = useCallback(() => {
        console.log('[DiamondArena] Loading animation complete');
        setAnimationComplete(true);
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

    const handleViewTournament = useCallback(async (tournamentId: string) => {
        const details = await tournamentService.getTournamentDetails(tournamentId);
        if (details) {
            setCurrentTournament(details);
            setView('tournament-details');
        }
    }, []);

    const handleTournamentRegister = useCallback(async () => {
        if (currentTournament && userId) {
            const { success, error } = await tournamentService.register(currentTournament.id, userId);
            if (success) {
                setUserBalance(prev => prev - (currentTournament.buyIn + currentTournament.fee));
                setRegisteredTournaments(prev => new Set(prev).add(currentTournament.id));
            } else {
                alert(`Registration failed: ${error}`);
            }
        } else if (!userId) {
            setShowAuthModal(true);
        }
    }, [currentTournament, userId]);

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

    const handleViewHandReplay = useCallback(async (handId: string) => {
        setLoadingReplay(true);
        setCurrentHandReplayId(handId);
        const data = await handHistoryService.getHandReplay(handId);
        if (data) {
            setCurrentHandReplayData(data);
            setView('hand-replay');
        } else {
            alert('Hand data not found');
        }
        setLoadingReplay(false);
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



    return (
        <>
            <AnimatePresence mode="wait">
                {view === 'loading' && (
                    <LoadingScreen
                        key="loading"
                        onComplete={handleLoadingComplete}
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

                {view === 'hand-replay' && currentHandReplayData && (
                    <motion.div
                        key="hand-replay"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <HandReplayPage
                            handData={currentHandReplayData}
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
