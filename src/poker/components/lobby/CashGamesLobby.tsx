/**
 * 💵 CASH GAMES LOBBY
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Lists available cash game tables (admin-created only).
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { PokerVariant } from '../../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 📊 CASH TABLE TYPE
// ═══════════════════════════════════════════════════════════════════════════

interface CashTable {
    id: string;
    name: string;
    variant: PokerVariant;
    stakes: string; // e.g., "10/20"
    tableSize: number;
    playerCount: number;
    minBuyIn: number;
    maxBuyIn: number;
    avgPot: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 CASH GAMES LOBBY PROPS
// ═══════════════════════════════════════════════════════════════════════════

interface CashGamesLobbyProps {
    onJoinTable: (tableId: string) => void;
    userBalance: number;
}

export const CashGamesLobby: React.FC<CashGamesLobbyProps> = ({
    onJoinTable,
    userBalance,
}) => {
    const [tables, setTables] = useState<CashTable[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<{
        variant: PokerVariant | 'ALL';
        stakes: 'ALL' | 'LOW' | 'MID' | 'HIGH';
    }>({
        variant: 'ALL',
        stakes: 'ALL',
    });

    // Fetch tables from Supabase
    useEffect(() => {
        const fetchTables = async () => {
            if (!isSupabaseConfigured) {
                // Demo tables for local mode
                setTables([
                    { id: 'cash-1', name: 'Diamond Ring', variant: 'NLH', stakes: '10/20', tableSize: 6, playerCount: 4, minBuyIn: 200, maxBuyIn: 2000, avgPot: 450 },
                    { id: 'cash-2', name: 'High Roller', variant: 'NLH', stakes: '100/200', tableSize: 6, playerCount: 2, minBuyIn: 2000, maxBuyIn: 20000, avgPot: 4500 },
                    { id: 'cash-3', name: 'PLO Action', variant: 'PLO', stakes: '25/50', tableSize: 6, playerCount: 5, minBuyIn: 500, maxBuyIn: 5000, avgPot: 1200 },
                    { id: 'cash-4', name: 'PLO8 Split', variant: 'PLO8', stakes: '10/20', tableSize: 6, playerCount: 3, minBuyIn: 200, maxBuyIn: 2000, avgPot: 380 },
                ]);
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('poker_tables')
                    .select('*')
                    .eq('game_type', 'CASH')
                    .eq('status', 'ACTIVE');

                if (error) throw error;

                const mapped: CashTable[] = (data || []).map(t => ({
                    id: t.id,
                    name: t.name,
                    variant: t.variant || 'NLH',
                    stakes: `${t.small_blind}/${t.big_blind}`,
                    tableSize: t.table_size,
                    playerCount: t.player_count || 0,
                    minBuyIn: t.min_buy_in,
                    maxBuyIn: t.max_buy_in,
                    avgPot: t.avg_pot || 0,
                }));

                setTables(mapped);
            } catch (err) {
                console.error('[CashLobby] Failed to fetch tables:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTables();
    }, []);

    // Filter tables
    const filteredTables = tables.filter(t => {
        if (filter.variant !== 'ALL' && t.variant !== filter.variant) return false;
        // Add stakes filtering logic here if needed
        return true;
    });

    return (
        <div style={{ padding: '16px 0' }}>
            {/* Filter Bar */}
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 16,
                    overflowX: 'auto',
                    paddingBottom: 8,
                }}
            >
                {(['ALL', 'NLH', 'PLO', 'PLO8', 'PLO5', 'PLO6'] as const).map(v => (
                    <FilterChip
                        key={v}
                        label={v === 'ALL' ? 'All Games' : v}
                        isActive={filter.variant === v}
                        onClick={() => setFilter(prev => ({ ...prev, variant: v }))}
                    />
                ))}
            </div>

            {/* Table List */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>
                    Loading tables...
                </div>
            ) : filteredTables.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>
                    No tables available
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <AnimatePresence>
                        {filteredTables.map((table, i) => (
                            <motion.div
                                key={table.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <CashTableCard
                                    table={table}
                                    onJoin={() => onJoinTable(table.id)}
                                    canAfford={userBalance >= table.minBuyIn}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 CASH TABLE CARD
// ═══════════════════════════════════════════════════════════════════════════

interface CashTableCardProps {
    table: CashTable;
    onJoin: () => void;
    canAfford: boolean;
}

const CashTableCard: React.FC<CashTableCardProps> = ({ table, onJoin, canAfford }) => (
    <div
        style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
        }}
    >
        {/* Table Info */}
        <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#FFF' }}>
                    {table.name}
                </span>
                <VariantBadge variant={table.variant} />
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                💎 {table.stakes} • {table.tableSize}-max • Avg Pot: {table.avgPot}
            </div>
        </div>

        {/* Player Count */}
        <div style={{ textAlign: 'center', minWidth: 50 }}>
            <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: table.playerCount > 0 ? '#00FF88' : 'rgba(255,255,255,0.3)',
            }}>
                {table.playerCount}/{table.tableSize}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Players</div>
        </div>

        {/* Join Button */}
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onJoin}
            disabled={!canAfford}
            style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: canAfford
                    ? 'linear-gradient(135deg, #00CC88, #00AA66)'
                    : 'rgba(100,100,100,0.3)',
                color: canAfford ? '#FFF' : 'rgba(255,255,255,0.3)',
                fontSize: 14,
                fontWeight: 600,
                cursor: canAfford ? 'pointer' : 'not-allowed',
            }}
        >
            Join
        </motion.button>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🏷️ HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const VariantBadge: React.FC<{ variant: PokerVariant }> = ({ variant }) => (
    <span
        style={{
            padding: '2px 8px',
            borderRadius: 4,
            background: variant === 'NLH'
                ? 'rgba(0,150,255,0.2)'
                : 'rgba(255,150,0,0.2)',
            color: variant === 'NLH' ? '#00AAFF' : '#FFAA00',
            fontSize: 11,
            fontWeight: 600,
        }}
    >
        {variant}
    </span>
);

interface FilterChipProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, isActive, onClick }) => (
    <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        style={{
            padding: '8px 16px',
            borderRadius: 20,
            border: isActive ? '1px solid #FFB800' : '1px solid rgba(255,255,255,0.2)',
            background: isActive ? 'rgba(255,184,0,0.2)' : 'transparent',
            color: isActive ? '#FFB800' : 'rgba(255,255,255,0.6)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
        }}
    >
        {label}
    </motion.button>
);

export default CashGamesLobby;
