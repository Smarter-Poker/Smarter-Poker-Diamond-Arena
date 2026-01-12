/**
 * 🎰 DIAMOND ARENA PREMIUM LOBBY
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Full premium lobby with Cash Games / Tournaments tabs.
 * No "Create Table" — tables are admin-created only.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LobbyTabs } from './lobby/LobbyTabs';
import { CashGamesLobby } from './lobby/CashGamesLobby';
import { TournamentsLobby } from './lobby/TournamentsLobby';

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 PREMIUM LOBBY PROPS
// ═══════════════════════════════════════════════════════════════════════════

interface PokerLobbyPremiumProps {
    userBalance: number;
    username: string;
    onJoinCashTable: (tableId: string) => void;
    onViewTournament: (tournamentId: string) => void;
    onNavigateToHandHistory: () => void;
}

export const PokerLobbyPremium: React.FC<PokerLobbyPremiumProps> = ({
    userBalance,
    username,
    onJoinCashTable,
    onViewTournament,
    onNavigateToHandHistory,
}) => {
    const [activeTab, setActiveTab] = useState<'cash' | 'tournaments'>('cash');

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#0A1628',
                color: '#FFF',
            }}
        >
            {/* Header */}
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>💎</span>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#FFB800' }}>
                            DIAMOND ARENA
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            Online Poker • Play for Diamonds
                        </div>
                    </div>
                </div>

                {/* User Balance */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        background: 'rgba(0,0,0,0.4)',
                        borderRadius: 8,
                        border: '1px solid rgba(255,184,0,0.3)',
                    }}
                >
                    <span style={{ fontSize: 18 }}>💎</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#FFB800' }}>
                        {userBalance.toLocaleString()}
                    </span>
                </div>
            </header>

            {/* Simulation Quick Buttons */}
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    padding: '16px 20px',
                    overflowX: 'auto',
                }}
            >
                {(['NLH', 'PLO', 'PLO8', 'PLO5', 'PLO6'] as const).map(variant => (
                    <SimButton
                        key={variant}
                        variant={variant}
                        onClick={() => onJoinCashTable(`sim-${variant.toLowerCase()}-${Math.floor(Math.random() * 1000)}`)}
                    />
                ))}
            </div>

            {/* Lobby Tabs */}
            <div style={{ padding: '0 20px 16px' }}>
                <LobbyTabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    style={{ padding: '0 20px' }}
                >
                    {activeTab === 'cash' ? (
                        <CashGamesLobby
                            onJoinTable={onJoinCashTable}
                            userBalance={userBalance}
                        />
                    ) : (
                        <TournamentsLobby
                            onViewTournament={onViewTournament}
                            userBalance={userBalance}
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Bottom Navigation */}
            <nav
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 60,
                    background: '#0D1520',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                }}
            >
                <NavButton icon="🎰" label="Tables" isActive />
                <NavButton icon="🃏" label="Hand History" onClick={onNavigateToHandHistory} />
                <NavButton icon="🏆" label="Leaderboard" />
                <NavButton icon="⚙️" label="Settings" />
            </nav>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🏷️ HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface SimButtonProps {
    variant: string;
    onClick: () => void;
}

const SimButton: React.FC<SimButtonProps> = ({ variant, onClick }) => (
    <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid rgba(0,150,200,0.4)',
            background: 'rgba(0,100,150,0.2)',
            color: '#00CCFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
        }}
    >
        {variant}
    </motion.button>
);

interface NavButtonProps {
    icon: string;
    label: string;
    isActive?: boolean;
    onClick?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, isActive, onClick }) => (
    <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: 'none',
            color: isActive ? '#FFB800' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
        }}
    >
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 10 }}>{label}</span>
    </motion.button>
);

export default PokerLobbyPremium;
