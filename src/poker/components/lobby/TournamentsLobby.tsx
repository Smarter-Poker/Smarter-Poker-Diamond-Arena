/**
 * 🏆 TOURNAMENTS LOBBY
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Lists upcoming and running tournaments (admin-created only).
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tournamentService } from '../../services/TournamentService';
import type { Tournament, PokerVariant } from '../../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 TOURNAMENTS LOBBY PROPS
// ═══════════════════════════════════════════════════════════════════════════

interface TournamentsLobbyProps {
    onViewTournament: (tournamentId: string) => void;
    userBalance: number;
}

export const TournamentsLobby: React.FC<TournamentsLobbyProps> = ({
    onViewTournament,
    userBalance,
}) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'upcoming' | 'running' | 'all'>('upcoming');

    // Fetch tournaments from Service
    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                const data = await tournamentService.fetchTournaments();
                setTournaments(data);
            } catch (err) {
                console.error('[TournamentsLobby] Failed to fetch:', err);
                // Service handles fallback gracefully
            } finally {
                setIsLoading(false);
            }
        };

        fetchTournaments();

        // Refresh every 30 seconds
        const interval = setInterval(fetchTournaments, 30000);
        return () => clearInterval(interval);
    }, []);

    // Filter tournaments
    const filteredTournaments = tournaments.filter(t => {
        if (filter === 'upcoming') return t.status === 'REGISTERING' || t.status === 'LATE_REG';
        if (filter === 'running') return t.status === 'RUNNING';
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
                }}
            >
                {(['upcoming', 'running', 'all'] as const).map(f => (
                    <FilterChip
                        key={f}
                        label={f === 'upcoming' ? '📅 Upcoming' : f === 'running' ? '🔴 Running' : '📋 All'}
                        isActive={filter === f}
                        onClick={() => setFilter(f)}
                    />
                ))}
            </div>

            {/* Tournament List */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>
                    Loading tournaments...
                </div>
            ) : filteredTournaments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>
                    No tournaments available
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <AnimatePresence>
                        {filteredTournaments.map((tourney, i) => (
                            <motion.div
                                key={tourney.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <TournamentCard
                                    tournament={tourney}
                                    onView={() => onViewTournament(tourney.id)}
                                    canAfford={userBalance >= (tourney.buyIn + tourney.fee)}
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
// 🎴 TOURNAMENT CARD
// ═══════════════════════════════════════════════════════════════════════════

interface TournamentCardProps {
    tournament: Tournament;
    onView: () => void;
    canAfford: boolean;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, onView, canAfford }) => {
    const totalBuyIn = tournament.buyIn + tournament.fee;
    const timeUntil = getTimeUntil(tournament.startTime);

    return (
        <div
            style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
            }}
            onClick={onView}
        >
            {/* Header Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <StatusBadge status={tournament.status} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#FFF', flex: 1 }}>
                    {tournament.name}
                </span>
                <span style={{ fontSize: 12, color: '#FFB800' }}>
                    {tournament.variant} ({tournament.tableSize})
                </span>
            </div>

            {/* Stats Row */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    marginBottom: 12,
                }}
            >
                <StatItem label="Buy-in" value={totalBuyIn === 0 ? 'FREE' : `💎${totalBuyIn}`} />
                <StatItem label="Prize Pool" value={`💎${tournament.guaranteedPool.toLocaleString()}`} highlight />
                <StatItem label="Entries" value={`${tournament.entryCount}/${tournament.maxEntries}`} />
                <StatItem label="Starts" value={timeUntil} />
            </div>

            {/* Bottom Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    {tournament.isReentry && <Badge label="Re-entry" color="#00AAFF" />}
                    {tournament.buyIn === 0 && <Badge label="Freeroll" color="#00FF88" />}
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onView();
                    }}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'linear-gradient(135deg, #FFB800, #FF8C00)',
                        color: '#000',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    View Details
                </motion.button>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🏷️ HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const StatusBadge: React.FC<{ status: Tournament['status'] }> = ({ status }) => {
    const config = {
        REGISTERING: { bg: 'rgba(0,255,136,0.2)', color: '#00FF88', label: '● Open' },
        LATE_REG: { bg: 'rgba(255,184,0,0.2)', color: '#FFB800', label: '● Late Reg' },
        RUNNING: { bg: 'rgba(255,68,68,0.2)', color: '#FF4444', label: '● Running' },
        COMPLETED: { bg: 'rgba(100,100,100,0.2)', color: '#888', label: 'Completed' },
    }[status];

    return (
        <span
            style={{
                padding: '3px 8px',
                borderRadius: 4,
                background: config.bg,
                color: config.color,
                fontSize: 11,
                fontWeight: 600,
            }}
        >
            {config.label}
        </span>
    );
};

const StatItem: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
    <div style={{ textAlign: 'center' }}>
        <div style={{
            fontSize: 14,
            fontWeight: highlight ? 700 : 600,
            color: highlight ? '#FFB800' : '#FFF',
        }}>
            {value}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
    </div>
);

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
    <span
        style={{
            padding: '2px 6px',
            borderRadius: 4,
            background: `${color}22`,
            color,
            fontSize: 10,
            fontWeight: 600,
        }}
    >
        {label}
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
        }}
    >
        {label}
    </motion.button>
);

// ═══════════════════════════════════════════════════════════════════════════
// ⏰ TIME HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getTimeUntil(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Started';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    }

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

export default TournamentsLobby;
