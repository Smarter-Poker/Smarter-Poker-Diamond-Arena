/**
 * 🎰 DIAMOND ARENA — MAIN ENTRY POINT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ONLINE POKER ROOM — PLAY FOR DIAMONDS 💎
 * 
 * NOT a training platform. This is a FULLY FUNCTIONING POKER ROOM where
 * users play Texas Hold'em against each other, wagering Diamonds as currency.
 * 
 * Features:
 * - Lobby with available cash games and tournaments
 * - Live multiplayer tables with real-time updates
 * - Full betting controls (Fold/Check/Call/Bet/Raise/All-In)
 * - Community cards, pot display, player seats
 * - Hand history and showdown logic
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';

// Poker Components
import { PokerLobby } from './poker/components/PokerLobby';
import { PokerRoom } from './poker/components/PokerRoom';

// Utilities
import { isSupabaseConfigured, getConnectionInfo } from './lib/supabase';

// Styles
import './styles/arena-globals.css';

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
                ONLINE POKER • PLAY FOR DIAMONDS
            </motion.p>

            {/* Progress Bar */}
            <motion.div
                style={{
                    width: 200,
                    height: 3,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}
            >
                <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.8, ease: 'easeInOut' }}
                    style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #00E0FF, #FFB800)',
                        borderRadius: 2,
                    }}
                />
            </motion.div>

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
// 🎰 MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

type AppView = 'loading' | 'lobby' | 'table';

const App: React.FC = () => {
    const [view, setView] = useState<AppView>('loading');
    const [currentTableId, setCurrentTableId] = useState<string | null>(null);
    const [userBalance] = useState(10000); // Demo balance
    const userId = 'demo-user-' + Math.random().toString(36).slice(2, 8);

    const handleJoinTable = (tableId: string) => {
        setCurrentTableId(tableId);
        setView('table');
    };

    const handleCreateTable = () => {
        // For demo, just join a new table
        const newTableId = 'table-' + Date.now();
        setCurrentTableId(newTableId);
        setView('table');
    };

    const handleLeaveTable = () => {
        setCurrentTableId(null);
        setView('lobby');
    };

    return (
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
                    <PokerLobby
                        onJoinTable={handleJoinTable}
                        onCreateTable={handleCreateTable}
                        userBalance={userBalance}
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
                    <PokerRoom
                        tableId={currentTableId}
                        userId={userId}
                        onLeaveTable={handleLeaveTable}
                    />
                </motion.div>
            )}
        </AnimatePresence>
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
