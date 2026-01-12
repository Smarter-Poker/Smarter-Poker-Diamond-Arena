/**
 * 🎰 LOBBY TABS — CASH GAMES & TOURNAMENTS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Top-level navigation for separating Cash Games and Tournaments.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import { motion } from 'framer-motion';

type LobbyTab = 'cash' | 'tournaments';

interface LobbyTabsProps {
    activeTab: LobbyTab;
    onTabChange: (tab: LobbyTab) => void;
}

export const LobbyTabs: React.FC<LobbyTabsProps> = ({ activeTab, onTabChange }) => {
    return (
        <div
            style={{
                display: 'flex',
                gap: 0,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)',
            }}
        >
            <TabButton
                label="💵 Cash Games"
                isActive={activeTab === 'cash'}
                onClick={() => onTabChange('cash')}
            />
            <TabButton
                label="🏆 Tournaments"
                isActive={activeTab === 'tournaments'}
                onClick={() => onTabChange('tournaments')}
            />
        </div>
    );
};

interface TabButtonProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => (
    <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        style={{
            flex: 1,
            padding: '12px 24px',
            background: isActive
                ? 'linear-gradient(135deg, #FFB800, #FF8C00)'
                : 'transparent',
            border: 'none',
            color: isActive ? '#000' : 'rgba(255,255,255,0.6)',
            fontSize: 14,
            fontWeight: isActive ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
        }}
    >
        {label}
    </motion.button>
);

export default LobbyTabs;
