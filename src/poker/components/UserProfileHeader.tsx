/**
 * 👤 USER PROFILE HEADER — Authenticated User Display
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Displays user avatar, username, diamond balance, and auth controls.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import { motion } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 👤 USER PROFILE HEADER
// ═══════════════════════════════════════════════════════════════════════════

interface UserProfileHeaderProps {
    userId: string | null;
    username?: string;
    avatarUrl?: string;
    diamondBalance: number;
    isAuthenticated: boolean;
    onLogin: () => void;
    onLogout: () => void;
}

export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
    userId,
    username = 'Guest',
    avatarUrl,
    diamondBalance,
    isAuthenticated,
    onLogin,
    onLogout,
}) => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
        }}>
            {/* Diamond Balance */}
            <motion.div
                whileHover={{ scale: 1.02 }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, rgba(255,184,0,0.15) 0%, rgba(255,184,0,0.05) 100%)',
                    borderRadius: 12,
                    border: '1px solid rgba(255,184,0,0.3)',
                    cursor: 'default',
                }}
            >
                <span style={{ fontSize: 22 }}>💎</span>
                <div>
                    <div style={{
                        color: '#FFB800',
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.02em',
                    }}>
                        {diamondBalance.toLocaleString()}
                    </div>
                    <div style={{
                        color: 'rgba(255,184,0,0.6)',
                        fontSize: 10,
                        fontWeight: 500,
                        marginTop: 2,
                    }}>
                        DIAMONDS
                    </div>
                </div>
            </motion.div>

            {/* User Info or Login Button */}
            {isAuthenticated ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}>
                    {/* Avatar */}
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: avatarUrl
                            ? `url(${avatarUrl}) center/cover`
                            : 'linear-gradient(135deg, #00E0FF 0%, #00A8CC 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid rgba(0,224,255,0.3)',
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#FFF',
                    }}>
                        {!avatarUrl && username.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Username & ID */}
                    <div>
                        <div style={{
                            color: '#FFF',
                            fontSize: 14,
                            fontWeight: 600,
                        }}>
                            {username}
                        </div>
                        <div style={{
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: 10,
                            fontFamily: 'var(--font-mono)',
                        }}>
                            #{userId?.slice(-6).toUpperCase()}
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        background: 'rgba(0,255,136,0.1)',
                        borderRadius: 100,
                    }}>
                        <div style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#00FF88',
                        }} />
                        <span style={{
                            color: '#00FF88',
                            fontSize: 10,
                            fontWeight: 600,
                        }}>
                            ONLINE
                        </span>
                    </div>

                    {/* Logout */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onLogout}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.03)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        Sign Out
                    </motion.button>
                </div>
            ) : (
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onLogin}
                    style={{
                        padding: '12px 28px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'linear-gradient(180deg, #FFB800 0%, #CC9400 100%)',
                        color: '#000',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 4px 15px rgba(255,184,0,0.3)',
                    }}
                >
                    <span>🔐</span>
                    Login / Sign Up
                </motion.button>
            )}
        </div>
    );
};

export default UserProfileHeader;
