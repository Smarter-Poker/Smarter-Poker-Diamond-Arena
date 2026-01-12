/**
 * 🏛️ POKER LOBBY — TABLE BROWSER
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Browse available tables, filter by stakes/type, join or create games.
 * NOW CONNECTED TO SUPABASE REALTIME 🔌
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameType, LobbyFilters } from '../types/poker';
import { usePokerLobby } from '../hooks/usePoker';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ LOBBY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PokerLobbyProps {
    onJoinTable: (tableId: string) => void;
    onCreateTable: () => void;
    userBalance: number;
}

export const PokerLobby: React.FC<PokerLobbyProps> = ({
    onJoinTable,
    onCreateTable,
    userBalance,
}) => {
    const { tables, isLoading, error, refresh } = usePokerLobby();
    const [filters, setFilters] = useState<LobbyFilters>({});
    const [selectedTab, setSelectedTab] = useState<GameType | 'ALL'>('ALL');

    const filteredTables = tables.filter(table => {
        if (selectedTab !== 'ALL' && table.gameType !== selectedTab) return false;
        if (filters.hideEmpty && table.playerCount === 0) return false;
        if (filters.hideFull && table.playerCount >= table.tableSize) return false;
        return true;
    });

    return (
        <div style={{
            minHeight: '100vh',
            background: '#050507',
            padding: '24px 32px',
        }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 32,
            }}>
                <div>
                    <h1 style={{
                        color: '#FFB800',
                        fontSize: 28,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        margin: 0,
                    }}>
                        💎 DIAMOND ARENA
                    </h1>
                    <p style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 14,
                        marginTop: 4,
                    }}>
                        Online Poker • Play for Diamonds
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                }}>
                    {/* Balance */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 20px',
                        background: 'rgba(255,184,0,0.1)',
                        borderRadius: 8,
                        border: '1px solid rgba(255,184,0,0.3)',
                    }}>
                        <span style={{ fontSize: 20 }}>💎</span>
                        <span style={{
                            color: '#FFB800',
                            fontSize: 18,
                            fontWeight: 700,
                        }}>
                            {userBalance.toLocaleString()}
                        </span>
                    </div>

                    {/* Sim Variants */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        {['NLH', 'PLO', 'PLO8', 'PLO5', 'PLO6'].map(v => (
                            <motion.button
                                key={v}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onJoinTable(`sim-${v.toLowerCase()}-${Math.floor(Math.random() * 1000)}`)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(0,224,255,0.3)',
                                    background: 'rgba(0,224,255,0.1)',
                                    color: '#00E0FF',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                {v}
                            </motion.button>
                        ))}
                    </div>

                    {/* Create Table */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onCreateTable}
                        style={{
                            padding: '12px 24px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'linear-gradient(135deg, #00FF94 0%, #00CC76 100%)',
                            color: '#000',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        ➕ Create Table
                    </motion.button>
                </div>
            </header>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 4,
                marginBottom: 24,
                background: 'rgba(255,255,255,0.03)',
                padding: 4,
                borderRadius: 8,
                width: 'fit-content',
            }}>
                {(['ALL', 'CASH', 'SIT_N_GO', 'TOURNAMENT'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 6,
                            border: 'none',
                            background: selectedTab === tab ? '#00E0FF' : 'transparent',
                            color: selectedTab === tab ? '#000' : 'rgba(255,255,255,0.6)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {tab === 'ALL' ? 'All Games' : tab.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: 16,
                marginBottom: 20,
            }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 13,
                    cursor: 'pointer',
                }}>
                    <input
                        type="checkbox"
                        checked={filters.hideEmpty}
                        onChange={e => setFilters(f => ({ ...f, hideEmpty: e.target.checked }))}
                    />
                    Hide Empty
                </label>
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 13,
                    cursor: 'pointer',
                }}>
                    <input
                        type="checkbox"
                        checked={filters.hideFull}
                        onChange={e => setFilters(f => ({ ...f, hideFull: e.target.checked }))}
                    />
                    Hide Full
                </label>
            </div>

            {/* Table List */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
            }}>
                {/* Header Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 120px',
                    gap: 16,
                    padding: '12px 20px',
                    background: 'rgba(0,0,0,0.3)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>
                    <span>Table Name</span>
                    <span>Stakes</span>
                    <span>Players</span>
                    <span>Avg Pot</span>
                    <span>Hands/Hr</span>
                    <span>Type</span>
                    <span></span>
                </div>

                {/* Table Rows */}
                <AnimatePresence>
                    {filteredTables.map((table, index) => (
                        <motion.div
                            key={table.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.03 }}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 120px',
                                gap: 16,
                                padding: '16px 20px',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                alignItems: 'center',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            {/* Name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {table.isPrivate && <span style={{ fontSize: 12 }}>🔒</span>}
                                <span style={{ color: '#FFF', fontWeight: 500 }}>
                                    {table.name}
                                </span>
                            </div>

                            {/* Stakes */}
                            <span style={{ color: '#FFB800', fontWeight: 600 }}>
                                💎 {table.stakes}
                            </span>

                            {/* Players */}
                            <div>
                                <span style={{
                                    color: table.playerCount >= table.tableSize ? '#FF4444' : '#00FF94',
                                    fontWeight: 500,
                                }}>
                                    {table.playerCount}/{table.tableSize}
                                </span>
                                {table.waitlistCount > 0 && (
                                    <span style={{
                                        marginLeft: 8,
                                        color: 'rgba(255,255,255,0.4)',
                                        fontSize: 11,
                                    }}>
                                        (+{table.waitlistCount})
                                    </span>
                                )}
                            </div>

                            {/* Avg Pot */}
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                                💎 {table.averagePot}
                            </span>

                            {/* Hands/Hr */}
                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                                {table.handsPerHour}
                            </span>

                            {/* Type */}
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: 4,
                                background: 'rgba(0,224,255,0.1)',
                                color: '#00E0FF',
                                fontSize: 11,
                                fontWeight: 500,
                            }}>
                                {table.tableSize}-max
                            </span>

                            {/* Join Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onJoinTable(table.id)}
                                disabled={table.playerCount >= table.tableSize}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: table.playerCount >= table.tableSize
                                        ? '#333'
                                        : '#00FF94',
                                    color: table.playerCount >= table.tableSize
                                        ? '#666'
                                        : '#000',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: table.playerCount >= table.tableSize
                                        ? 'not-allowed'
                                        : 'pointer',
                                }}
                            >
                                {table.playerCount >= table.tableSize ? 'Full' : 'Join'}
                            </motion.button>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {filteredTables.length === 0 && (
                    <div style={{
                        padding: 48,
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.4)',
                    }}>
                        No tables match your filters
                    </div>
                )}

                {/* Loading State */}
                {isLoading && tables.length === 0 && (
                    <div style={{
                        padding: 48,
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.4)',
                    }}>
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{ fontSize: 24, marginBottom: 12 }}
                        >
                            💎
                        </motion.div>
                        Loading tables...
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div style={{
                display: 'flex',
                gap: 24,
                marginTop: 24,
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
                alignItems: 'center',
            }}>
                <span>{tables.length} tables running</span>
                <span>
                    {tables.reduce((sum, t) => sum + t.playerCount, 0)} players online
                </span>
                <button
                    onClick={refresh}
                    style={{
                        padding: '4px 12px',
                        borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 11,
                        cursor: 'pointer',
                    }}
                >
                    ↻ Refresh
                </button>
                {error && (
                    <span style={{ color: '#FF4444' }}>⚠ {error}</span>
                )}
            </div>
        </div>
    );
};

export default PokerLobby;
