/**
 * ⚡ QUICK ACTIONS HUD — In-Game Shortcuts
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Floating action bar with quick access to common game features.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ QUICK ACTIONS HUD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface QuickActionsHUDProps {
    onOpenChat: () => void;
    onOpenHistory: () => void;
    onOpenSettings: () => void;
    onOpenLeaderboard: () => void;
    onRebuy?: () => void;
    onSitOut?: () => void;
    onLeaveTable: () => void;
    isSittingOut?: boolean;
    canRebuy?: boolean;
    isSeated: boolean;
    connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
}

export const QuickActionsHUD: React.FC<QuickActionsHUDProps> = ({
    onOpenChat,
    onOpenHistory,
    onOpenSettings,
    onOpenLeaderboard,
    onRebuy,
    onSitOut,
    onLeaveTable,
    isSittingOut = false,
    canRebuy = false,
    isSeated,
    connectionStatus,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showTooltip, setShowTooltip] = useState<string | null>(null);

    const actions = [
        { id: 'chat', icon: '💬', label: 'Chat', onClick: onOpenChat },
        { id: 'history', icon: '📜', label: 'History', onClick: onOpenHistory },
        { id: 'leaderboard', icon: '🏆', label: 'Leaderboard', onClick: onOpenLeaderboard },
        { id: 'settings', icon: '⚙️', label: 'Settings', onClick: onOpenSettings },
    ];

    const getStatusColor = () => {
        switch (connectionStatus) {
            case 'CONNECTED': return '#00FF88';
            case 'DISCONNECTED': return '#FF4444';
            case 'RECONNECTING': return '#FFB800';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                position: 'absolute',
                bottom: 20,
                left: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                zIndex: 50,
            }}
        >
            {/* Connection Status */}
            <motion.div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: 100,
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${getStatusColor()}30`,
                }}
            >
                <motion.div
                    animate={{
                        opacity: connectionStatus === 'RECONNECTING' ? [1, 0.3, 1] : 1,
                    }}
                    transition={{
                        repeat: connectionStatus === 'RECONNECTING' ? Infinity : 0,
                        duration: 1,
                    }}
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getStatusColor(),
                    }}
                />
                <span style={{
                    color: getStatusColor(),
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                }}>
                    {connectionStatus === 'CONNECTED' ? 'Live' : connectionStatus.toLowerCase()}
                </span>
            </motion.div>

            {/* Main Action Bar */}
            <motion.div
                style={{
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(12px)',
                    overflow: 'hidden',
                }}
            >
                {/* Toggle Button */}
                <motion.button
                    whileHover={{ background: 'rgba(255,255,255,0.1)' }}
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                        width: '100%',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        cursor: 'pointer',
                    }}
                >
                    <span style={{ color: '#FFF', fontSize: 12, fontWeight: 600 }}>
                        ⚡ Quick Actions
                    </span>
                    <motion.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    >
                        ▼
                    </motion.span>
                </motion.button>

                {/* Actions Grid */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div style={{
                                padding: 12,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 8,
                            }}>
                                {actions.map(action => (
                                    <motion.button
                                        key={action.id}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={action.onClick}
                                        onMouseEnter={() => setShowTooltip(action.id)}
                                        onMouseLeave={() => setShowTooltip(null)}
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 10,
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            background: 'rgba(255,255,255,0.05)',
                                            fontSize: 20,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                        }}
                                    >
                                        {action.icon}

                                        {/* Tooltip */}
                                        <AnimatePresence>
                                            {showTooltip === action.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 5 }}
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: -28,
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        padding: '4px 8px',
                                                        background: '#000',
                                                        borderRadius: 4,
                                                        whiteSpace: 'nowrap',
                                                        color: '#FFF',
                                                        fontSize: 10,
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {action.label}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.button>
                                ))}
                            </div>

                            {/* Seated Actions */}
                            {isSeated && (
                                <div style={{
                                    padding: '8px 12px 12px',
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex',
                                    gap: 8,
                                }}>
                                    {/* Sit Out */}
                                    {onSitOut && (
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={onSitOut}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: isSittingOut
                                                    ? 'rgba(0,255,136,0.2)'
                                                    : 'transparent',
                                                color: isSittingOut ? '#00FF88' : 'rgba(255,255,255,0.6)',
                                                fontSize: 11,
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {isSittingOut ? '✓ Sitting Out' : '⏸️ Sit Out'}
                                        </motion.button>
                                    )}

                                    {/* Rebuy */}
                                    {onRebuy && canRebuy && (
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={onRebuy}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                borderRadius: 8,
                                                border: 'none',
                                                background: 'linear-gradient(180deg, #FFB800 0%, #CC9400 100%)',
                                                color: '#000',
                                                fontSize: 11,
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            💎 Rebuy
                                        </motion.button>
                                    )}
                                </div>
                            )}

                            {/* Leave Table */}
                            <div style={{ padding: '0 12px 12px' }}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={onLeaveTable}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: 8,
                                        border: '1px solid rgba(255,68,68,0.3)',
                                        background: 'rgba(255,68,68,0.1)',
                                        color: '#FF4444',
                                        fontSize: 12,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                    }}
                                >
                                    🚪 Leave Table
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default QuickActionsHUD;
