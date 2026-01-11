/**
 * 🌌 THE DIMENSIONAL NAVIGATOR — ARENA SHELL
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Core spatial frame with orbital layout, depth-layers,
 * and Framer Motion transitions for the Diamond Arena.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useArena } from '../lib/arena-auth-context';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

const spatialTransition = {
    duration: 0.6,
    ease: [0.16, 1, 0.3, 1], // Custom expo ease-out
};

const fadeInUpVariants = {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.98 },
};

const pulseVariants = {
    animate: {
        scale: [1, 1.1, 1],
        opacity: [0.5, 1, 0.5],
        boxShadow: [
            '0 0 20px rgba(0, 255, 148, 0.4)',
            '0 0 40px rgba(0, 255, 148, 0.6)',
            '0 0 20px rgba(0, 255, 148, 0.4)',
        ],
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 LOADING SPINNER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const LoadingSpinner: React.FC = () => (
    <div
        className="spatial-layer"
        style={{
            background: 'var(--void-bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
        }}
    >
        {/* Animated Diamond */}
        <motion.div
            variants={pulseVariants}
            animate="animate"
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                border: '2px solid var(--poker-green)',
                transform: 'rotate(45deg)',
                boxShadow: '0 0 30px rgba(0, 255, 148, 0.4)',
            }}
        />

        {/* Loading Text */}
        <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
            }}
        >
            Initializing Arena
        </motion.span>

        {/* Animated Dots */}
        <div style={{ display: 'flex', gap: '8px' }}>
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                    style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--poker-green)',
                    }}
                />
            ))}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🧭 NAVBAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface NavbarProps {
    isAuthenticated: boolean;
    username?: string;
    onSignOut?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, username, onSignOut }) => (
    <nav
        style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '80px',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 40px',
            borderBottom: '1px solid var(--glass-border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            background: 'rgba(5, 5, 7, 0.8)',
        }}
    >
        {/* Logo & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <motion.div
                whileHover={{ rotate: 90, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                style={{
                    width: '32px',
                    height: '32px',
                    background: 'var(--poker-green)',
                    borderRadius: '4px',
                    transform: 'rotate(45deg)',
                    boxShadow: '0 0 20px var(--poker-green-glow)',
                }}
            />
            <span
                style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                }}
            >
                Diamond Arena
            </span>
        </div>

        {/* Center Nav (Placeholder for future routes) */}
        <div style={{ display: 'flex', gap: '32px' }}>
            {['Arena', 'Leaderboard', 'History'].map((item) => (
                <motion.button
                    key={item}
                    whileHover={{ y: -2, color: 'var(--poker-green)' }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        padding: '8px 16px',
                    }}
                >
                    {item}
                </motion.button>
            ))}
        </div>

        {/* Right Section: Status & User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* System Status */}
            <div
                style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                }}
            >
                <span>System Stable</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--poker-green)' }}>
                    <span
                        style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'var(--poker-green)',
                            boxShadow: '0 0 10px var(--poker-green-glow)',
                        }}
                    />
                    Connected
                </span>
            </div>

            {/* User Badge (if authenticated) */}
            {isAuthenticated && username && (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 16px',
                        background: 'var(--surface)',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                    }}
                >
                    <div
                        style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, var(--xp-red) 0%, var(--diamond-blue) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                        }}
                    >
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{username}</span>
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onSignOut}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '14px',
                        }}
                    >
                        ⏻
                    </motion.button>
                </motion.div>
            )}
        </div>
    </nav>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ MAIN ARENA SHELL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ArenaShellProps {
    children: ReactNode;
}

export const ArenaShell: React.FC<ArenaShellProps> = ({ children }) => {
    const arena = useArena();
    const { isLoading, isAuthenticated, profile, signOut } = arena;

    // Show loading state
    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div
            style={{
                position: 'relative',
                minHeight: '100vh',
                width: '100%',
                overflow: 'hidden',
                background: 'var(--void-bg)',
            }}
        >
            {/* ═══ PERSISTENT DEPTH ORBS (Background) ═══ */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                }}
            >
                {/* Top-Left Red Orb */}
                <motion.div
                    animate={{
                        x: [0, 30, 0],
                        y: [0, -20, 0],
                    }}
                    transition={{ repeat: Infinity, duration: 20, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute',
                        top: '-10%',
                        left: '-10%',
                        width: '40%',
                        height: '40%',
                        background: 'var(--xp-red)',
                        opacity: 0.1,
                        borderRadius: '50%',
                        filter: 'blur(120px)',
                    }}
                />

                {/* Bottom-Right Green Orb */}
                <motion.div
                    animate={{
                        x: [0, -30, 0],
                        y: [0, 20, 0],
                    }}
                    transition={{ repeat: Infinity, duration: 25, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute',
                        bottom: '-10%',
                        right: '-10%',
                        width: '40%',
                        height: '40%',
                        background: 'var(--poker-green)',
                        opacity: 0.1,
                        borderRadius: '50%',
                        filter: 'blur(120px)',
                    }}
                />

                {/* Center Blue Accent */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.05, 0.08, 0.05],
                    }}
                    transition={{ repeat: Infinity, duration: 15, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute',
                        top: '30%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '30%',
                        height: '30%',
                        background: 'var(--diamond-blue)',
                        opacity: 0.05,
                        borderRadius: '50%',
                        filter: 'blur(100px)',
                    }}
                />
            </div>

            {/* ═══ NAVIGATION BAR ═══ */}
            <Navbar
                isAuthenticated={isAuthenticated}
                username={profile?.username}
                onSignOut={signOut}
            />

            {/* ═══ MAIN CONTENT AREA ═══ */}
            <main
                style={{
                    position: 'relative',
                    zIndex: 10,
                    paddingTop: '96px',
                    minHeight: '100vh',
                    width: '100%',
                }}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={isAuthenticated ? 'authed' : 'anonymous'}
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={spatialTransition}
                        style={{
                            height: '100%',
                            width: '100%',
                            padding: '32px',
                        }}
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* ═══ MODAL/OVERLAY ROOT ═══ */}
            <div
                id="arena-overlay-root"
                style={{
                    position: 'fixed',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 100,
                }}
            />

            {/* ═══ TOAST CONTAINER ═══ */}
            <div
                id="arena-toast-root"
                style={{
                    position: 'fixed',
                    bottom: '32px',
                    right: '32px',
                    zIndex: 300,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}
            />
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🚧 PLACEHOLDER COMPONENTS (For Future Routes)
// ═══════════════════════════════════════════════════════════════════════════

interface PlaceholderProps {
    title: string;
    subtitle?: string;
    icon?: string;
}

export const ComingSoonPlaceholder: React.FC<PlaceholderProps> = ({
    title,
    subtitle = 'This feature is under construction',
    icon = '🚀',
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100vh - 200px)',
            textAlign: 'center',
            gap: '24px',
        }}
    >
        <motion.span
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ fontSize: '64px' }}
        >
            {icon}
        </motion.span>

        <h1
            style={{
                fontSize: '32px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                margin: 0,
            }}
        >
            {title}
        </h1>

        <p
            style={{
                fontSize: '14px',
                color: 'var(--text-muted)',
                maxWidth: '400px',
                margin: 0,
            }}
        >
            {subtitle}
        </p>

        <div
            style={{
                display: 'flex',
                gap: '8px',
                padding: '16px 24px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
            }}
        >
            <span style={{ color: 'var(--poker-green)', fontWeight: 600 }}>STATUS:</span>
            <span style={{ color: 'var(--text-secondary)' }}>Under Development</span>
        </div>
    </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default ArenaShell;
