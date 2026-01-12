/**
 * 🏆 TOURNAMENT DETAILS PAGE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Full tournament info with countdown, registration, and tabbed sections.
 * Matches PokerBros "Game Details" UI exactly.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════

import type { TournamentDetails } from '../../types/poker';

type TabType = 'detail' | 'entries' | 'ranking' | 'unions' | 'tables' | 'rewards';

interface TournamentDetailsPageProps {
    tournament: TournamentDetails;
    isRegistered: boolean;
    onBack: () => void;
    onRegister: () => void;
    onShare: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 TOURNAMENT DETAILS PAGE
// ═══════════════════════════════════════════════════════════════════════════

export const TournamentDetailsPage: React.FC<TournamentDetailsPageProps> = ({
    tournament,
    isRegistered,
    onBack,
    onRegister,
    onShare,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('detail');
    const [showSignUpModal, setShowSignUpModal] = useState(false);
    const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

    const totalBuyIn = tournament.buyIn + tournament.fee;

    // Countdown timer
    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            const diff = tournament.startTime.getTime() - now.getTime();

            if (diff <= 0) {
                setCountdown({ hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setCountdown({ hours, minutes, seconds });
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [tournament.startTime]);

    const tabs: { key: TabType; label: string }[] = [
        { key: 'detail', label: 'Detail' },
        { key: 'entries', label: 'Entries' },
        { key: 'ranking', label: 'Ranking' },
        { key: 'unions', label: 'Unions' },
        { key: 'tables', label: 'Tables' },
        { key: 'rewards', label: 'Rewards' },
    ];

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#0A1628',
                color: '#FFF',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
            >
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
                <span style={{ fontSize: 18, fontWeight: 600 }}>Game Details</span>
            </header>

            {/* Tab Bar */}
            <div
                style={{
                    display: 'flex',
                    gap: 0,
                    padding: '8px 16px',
                    overflowX: 'auto',
                }}
            >
                {tabs.map(tab => (
                    <motion.button
                        key={tab.key}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: activeTab === tab.key ? 20 : 0,
                            border: 'none',
                            background: activeTab === tab.key
                                ? 'linear-gradient(135deg, #00AAFF, #0066AA)'
                                : 'transparent',
                            color: activeTab === tab.key ? '#FFF' : 'rgba(255,255,255,0.5)',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {tab.label}
                    </motion.button>
                ))}
            </div>

            {/* Tournament Name & ID */}
            <div style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#FFB800',
                    marginBottom: 4,
                }}>
                    {tournament.name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    ID:{tournament.id.slice(-8)}
                </div>
            </div>

            {/* Description */}
            <div
                style={{
                    padding: '0 16px 16px',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                }}
            >
                {tournament.description}
            </div>

            {/* Countdown Banner */}
            <div
                style={{
                    margin: '0 16px 16px',
                    padding: '24px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(0,50,100,0.4), rgba(0,100,150,0.2))',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 50\'%3E%3C/svg%3E")',
                    textAlign: 'center',
                }}
            >
                {/* Digital Clock */}
                <div
                    style={{
                        fontFamily: 'monospace',
                        fontSize: 48,
                        fontWeight: 700,
                        color: '#00FFFF',
                        textShadow: '0 0 20px rgba(0,255,255,0.5)',
                        marginBottom: 8,
                    }}
                >
                    {String(countdown.hours).padStart(2, '0')}:
                    {String(countdown.minutes).padStart(2, '0')}:
                    {String(countdown.seconds).padStart(2, '0')}
                </div>

                {/* Start Time */}
                <div
                    style={{
                        display: 'inline-block',
                        padding: '4px 16px',
                        background: 'rgba(0,150,200,0.3)',
                        borderRadius: 4,
                        fontSize: 12,
                        color: '#00CCFF',
                        marginBottom: 16,
                    }}
                >
                    {tournament.startTime.toISOString().slice(0, 16).replace('T', ' ')}
                </div>

                {/* Stats Grid */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 16,
                        marginTop: 16,
                    }}
                >
                    <CountdownStat label="Blinds Up" value={`${tournament.blindsUp}:00`} color="#FF8800" />
                    <CountdownStat label="Late Registration" value={`level ${tournament.lateRegLevel}`} color="#FFF" />
                    <CountdownStat label="Current Level" value={String(tournament.currentLevel || 1)} color="#00FF88" />
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 16,
                        marginTop: 12,
                    }}
                >
                    <CountdownStat
                        label="Remaining Players"
                        value={`${tournament.remainingPlayers || 0}/${tournament.entryCount}`}
                        color="#FF8800"
                    />
                    <CountdownStat
                        label="Avg Stack"
                        value={formatChips(tournament.avgStack || 0)}
                        color="#00CCFF"
                    />
                    {tournament.earlyBirdBonus && (
                        <CountdownStat
                            label="Early Bird"
                            value={tournament.earlyBirdBonus}
                            color="#00FF88"
                        />
                    )}
                </div>
            </div>

            {/* Details List */}
            <div style={{ padding: '0 16px', flex: 1 }}>
                <DetailRow label="Game Type:" value={`${tournament.variant} (${tournament.tableSize} max)`} />
                <DetailRow
                    label="Buy-in:"
                    value={`${totalBuyIn}(${tournament.buyIn} + ${tournament.fee})`}
                    badge={tournament.isReentry ? 'Re-entry' : undefined}
                />
                <DetailRow
                    label="Prize Pool:"
                    value={`${tournament.guaranteedPool.toLocaleString()}`}
                    badge="FT DEAL"
                    badgeColor="#00AAFF"
                />
                <DetailRow label="Entries:" value={String(tournament.entryCount)} secondValue={`Entries Range: ${tournament.entriesRange}`} />
                <DetailRow
                    label="Re-entry:"
                    value={tournament.isReentry ? `${totalBuyIn} (x ${tournament.reentryLimit || 'No Limit'})` : 'No Re-entry'}
                    secondValue={`Add-on: ${tournament.hasAddon ? 'Yes' : 'No Add-on'}`}
                />
                <DetailRow
                    label="Starting Chips:"
                    value={formatChips(tournament.startingChips)}
                    secondValue={`Big Blind Ante: ${tournament.hasBigBlindAnte ? 'Yes' : 'No'}`}
                />
                <DetailRow
                    label="Blind Structure:"
                    value={tournament.blindStructure}
                    hasHelp
                />
            </div>

            {/* Bottom Actions */}
            <div
                style={{
                    display: 'flex',
                    gap: 16,
                    padding: 16,
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onShare}
                    style={{
                        flex: 1,
                        padding: '14px 0',
                        borderRadius: 25,
                        border: '2px solid #FFB800',
                        background: 'transparent',
                        color: '#FFB800',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Share
                </motion.button>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowSignUpModal(true)}
                    disabled={isRegistered}
                    style={{
                        flex: 1,
                        padding: '14px 0',
                        borderRadius: 25,
                        border: 'none',
                        background: isRegistered
                            ? 'rgba(100,100,100,0.3)'
                            : 'linear-gradient(135deg, #FFB800, #FF8C00)',
                        color: isRegistered ? 'rgba(255,255,255,0.5)' : '#000',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: isRegistered ? 'default' : 'pointer',
                    }}
                >
                    {isRegistered ? 'Registered' : 'Register'}
                </motion.button>
            </div>

            {/* Sign Up Modal */}
            <AnimatePresence>
                {showSignUpModal && (
                    <TournamentSignUpModal
                        buyIn={tournament.buyIn}
                        fee={tournament.fee}
                        startTime={tournament.startTime}
                        onCancel={() => setShowSignUpModal(false)}
                        onConfirm={() => {
                            setShowSignUpModal(false);
                            onRegister();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📝 SIGN UP MODAL
// ═══════════════════════════════════════════════════════════════════════════

interface TournamentSignUpModalProps {
    buyIn: number;
    fee: number;
    startTime: Date;
    onCancel: () => void;
    onConfirm: () => void;
}

const TournamentSignUpModal: React.FC<TournamentSignUpModalProps> = ({
    buyIn,
    fee,
    startTime,
    onCancel,
    onConfirm,
}) => (
    <>
        {/* Backdrop */}
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                zIndex: 300,
            }}
        />

        {/* Modal */}
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '90%',
                maxWidth: 360,
                background: 'linear-gradient(135deg, #1A2A4A, #0A1628)',
                border: '2px solid rgba(100,150,255,0.3)',
                borderRadius: 16,
                padding: 24,
                zIndex: 301,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                <span style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>Sign Up</span>
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onCancel}
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#FFB800',
                        border: 'none',
                        color: '#000',
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    ×
                </motion.button>
            </div>

            {/* Details */}
            <div style={{ marginBottom: 24 }}>
                <ModalRow label="Entry Fee:" value={`${buyIn + fee} (${buyIn} + ${fee})`} />
                <ModalRow label="Start time:" value={startTime.toISOString().slice(0, 16).replace('T', ' ')} />
            </div>

            {/* Warning */}
            <div
                style={{
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    marginBottom: 24,
                }}
            >
                Cannot unregister within 1 minute of the start time
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onCancel}
                    style={{
                        flex: 1,
                        padding: '12px 0',
                        borderRadius: 25,
                        border: '2px solid #FF8800',
                        background: 'transparent',
                        color: '#FF8800',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Cancel
                </motion.button>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onConfirm}
                    style={{
                        flex: 1,
                        padding: '12px 0',
                        borderRadius: 25,
                        border: 'none',
                        background: 'linear-gradient(135deg, #FFB800, #FF8C00)',
                        color: '#000',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    Confirm
                </motion.button>
            </div>
        </motion.div>
    </>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🏷️ HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const CountdownStat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
    <div>
        <div style={{ fontSize: 10, color: color, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#FFF' }}>{value}</div>
    </div>
);

interface DetailRowProps {
    label: string;
    value: string;
    secondValue?: string;
    badge?: string;
    badgeColor?: string;
    hasHelp?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, secondValue, badge, badgeColor = '#FF8800', hasHelp }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
    >
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, minWidth: 100 }}>{label}</span>
        <span style={{ flex: 1, fontSize: 13, color: '#FFB800' }}>{value}</span>
        {badge && (
            <span
                style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${badgeColor}22`,
                    color: badgeColor,
                    fontSize: 10,
                    fontWeight: 600,
                    marginLeft: 8,
                }}
            >
                {badge}
            </span>
        )}
        {secondValue && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 16 }}>
                {secondValue}
            </span>
        )}
        {hasHelp && (
            <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>❓</span>
        )}
    </div>
);

const ModalRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div
        style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0',
        }}
    >
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{label}</span>
        <span style={{ color: '#FFF', fontSize: 14 }}>{value}</span>
    </div>
);

function formatChips(value: number): string {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return String(value);
}

export default TournamentDetailsPage;
