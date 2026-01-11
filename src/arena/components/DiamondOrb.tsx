/**
 * 💎 THE DIAMOND ORB — SPATIAL NEURAL HUB
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Central 3D-feeling interactive sphere for training games.
 * Shows XP/Diamond multipliers through reactive pulses.
 * Particle emitters for visual feedback.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type OrbStatus = 'idle' | 'active' | 'charging' | 'success' | 'error' | 'locked';

export interface OrbState {
    status: OrbStatus;
    level: number;
    xp: number;
    xpToNext: number;
    multiplier: number;
    streakDays: number;
    masteryRate: number;
    diamondBalance: number;
}

export interface DiamondOrbProps {
    state: OrbState;
    onActivate?: () => void;
    onPulse?: () => void;
    showParticles?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 ORB CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const ORB_COLORS = {
    idle: {
        primary: '#FFB800',
        secondary: '#FF8C00',
        glow: 'rgba(255, 184, 0, 0.3)',
        pulse: 'rgba(255, 184, 0, 0.5)',
    },
    active: {
        primary: '#00FF94',
        secondary: '#00CC76',
        glow: 'rgba(0, 255, 148, 0.4)',
        pulse: 'rgba(0, 255, 148, 0.6)',
    },
    charging: {
        primary: '#00E0FF',
        secondary: '#0099CC',
        glow: 'rgba(0, 224, 255, 0.4)',
        pulse: 'rgba(0, 224, 255, 0.6)',
    },
    success: {
        primary: '#00FF94',
        secondary: '#FFD700',
        glow: 'rgba(0, 255, 148, 0.5)',
        pulse: 'rgba(255, 215, 0, 0.6)',
    },
    error: {
        primary: '#FF3E3E',
        secondary: '#CC3232',
        glow: 'rgba(255, 62, 62, 0.4)',
        pulse: 'rgba(255, 62, 62, 0.6)',
    },
    locked: {
        primary: '#666666',
        secondary: '#444444',
        glow: 'rgba(100, 100, 100, 0.2)',
        pulse: 'rgba(100, 100, 100, 0.3)',
    },
};

const ORB_SIZES = {
    sm: { container: 160, core: 100, ring: 140 },
    md: { container: 256, core: 160, ring: 220 },
    lg: { container: 320, core: 200, ring: 280 },
    xl: { container: 400, core: 260, ring: 360 },
};

// ═══════════════════════════════════════════════════════════════════════════
// ✨ PARTICLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
}

const ParticleField: React.FC<{ color: string; active: boolean; count?: number }> = ({
    color,
    active,
    count = 12
}) => {
    const particles = useMemo<Particle[]>(() =>
        Array.from({ length: count }, (_, i) => ({
            id: i,
            x: Math.random() * 360,
            y: Math.random() * 100,
            size: 2 + Math.random() * 4,
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 2,
        })),
        [count]);

    if (!active) return null;

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                        y: [0, -80],
                        x: Math.sin(p.x) * 30,
                    }}
                    transition={{
                        duration: p.duration,
                        delay: p.delay,
                        repeat: Infinity,
                        ease: 'easeOut',
                    }}
                    style={{
                        position: 'absolute',
                        left: `${50 + Math.cos(p.x * Math.PI / 180) * 40}%`,
                        top: `${50 + Math.sin(p.x * Math.PI / 180) * 40}%`,
                        width: p.size,
                        height: p.size,
                        borderRadius: '50%',
                        background: color,
                        boxShadow: `0 0 ${p.size * 2}px ${color}`,
                    }}
                />
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔮 MAIN ORB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const DiamondOrb: React.FC<DiamondOrbProps> = ({
    state,
    onActivate,
    onPulse,
    showParticles = true,
    size = 'md',
}) => {
    const colors = ORB_COLORS[state.status];
    const dimensions = ORB_SIZES[size];
    const [isPulsing, setIsPulsing] = useState(false);

    // Progress calculation
    const progressPercent = state.xpToNext > 0 ? (state.xp / (state.xp + state.xpToNext)) * 100 : 100;
    const masteryPercent = state.masteryRate * 100;

    // Motion values for interactivity
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const rotateX = useTransform(mouseY, [-100, 100], [10, -10]);
    const rotateY = useTransform(mouseX, [-100, 100], [-10, 10]);
    const springRotateX = useSpring(rotateX, { stiffness: 100, damping: 20 });
    const springRotateY = useSpring(rotateY, { stiffness: 100, damping: 20 });

    // Handle mouse movement for 3D effect
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        mouseX.set(e.clientX - centerX);
        mouseY.set(e.clientY - centerY);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
    };

    // Pulse effect
    const triggerPulse = () => {
        setIsPulsing(true);
        onPulse?.();
        setTimeout(() => setIsPulsing(false), 500);
    };

    return (
        <motion.div
            className="diamond-orb-container"
            style={{
                position: 'relative',
                width: dimensions.container,
                height: dimensions.container,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                perspective: 1000,
                cursor: state.status !== 'locked' ? 'pointer' : 'not-allowed',
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={() => {
                if (state.status !== 'locked') {
                    triggerPulse();
                    onActivate?.();
                }
            }}
            whileHover={state.status !== 'locked' ? { scale: 1.02 } : {}}
            whileTap={state.status !== 'locked' ? { scale: 0.98 } : {}}
        >
            {/* Outer Glow Layer */}
            <motion.div
                animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    position: 'absolute',
                    width: dimensions.container,
                    height: dimensions.container,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
                    filter: 'blur(20px)',
                }}
            />

            {/* Orbital Ring - Outer */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                style={{
                    position: 'absolute',
                    width: dimensions.ring,
                    height: dimensions.ring,
                    borderRadius: '50%',
                    border: `2px solid ${colors.primary}40`,
                }}
            />

            {/* Orbital Ring - Inner (Counter-rotate) */}
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                style={{
                    position: 'absolute',
                    width: dimensions.ring * 0.85,
                    height: dimensions.ring * 0.85,
                    borderRadius: '50%',
                    border: `1px dashed ${colors.secondary}30`,
                }}
            />

            {/* XP Progress Ring */}
            <svg
                style={{
                    position: 'absolute',
                    width: dimensions.ring * 0.95,
                    height: dimensions.ring * 0.95,
                    transform: 'rotate(-90deg)',
                }}
            >
                <circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke={`${colors.primary}20`}
                    strokeWidth="4"
                />
                <motion.circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="4"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: progressPercent / 100 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{
                        filter: `drop-shadow(0 0 6px ${colors.glow})`,
                    }}
                />
            </svg>

            {/* Main Orb Core */}
            <motion.div
                style={{
                    position: 'relative',
                    width: dimensions.core,
                    height: dimensions.core,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 30% 30%, ${colors.primary}40 0%, ${colors.secondary}20 50%, transparent 70%)`,
                    border: `2px solid ${colors.primary}60`,
                    boxShadow: `
            0 0 30px ${colors.glow},
            inset 0 0 60px ${colors.glow},
            0 0 100px ${colors.pulse}
          `,
                    rotateX: springRotateX,
                    rotateY: springRotateY,
                    transformStyle: 'preserve-3d',
                }}
            >
                {/* Inner Core Content */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                    }}
                >
                    {/* Status Icon */}
                    <motion.div
                        animate={state.status === 'active' ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        style={{ fontSize: size === 'sm' ? '24px' : '36px' }}
                    >
                        {state.status === 'locked' ? '🔒' : '💎'}
                    </motion.div>

                    {/* Level Display */}
                    <div
                        style={{
                            fontSize: size === 'sm' ? '28px' : '42px',
                            fontWeight: 900,
                            fontStyle: 'italic',
                            color: colors.primary,
                            textShadow: `0 0 20px ${colors.glow}`,
                            letterSpacing: '-0.05em',
                            lineHeight: 1,
                            marginTop: '4px',
                        }}
                    >
                        {state.level}
                    </div>

                    {/* Status Label */}
                    <div
                        style={{
                            fontSize: size === 'sm' ? '8px' : '10px',
                            fontWeight: 600,
                            letterSpacing: '0.3em',
                            textTransform: 'uppercase',
                            color: `${colors.primary}80`,
                            marginTop: '4px',
                        }}
                    >
                        {state.status === 'active' ? 'Training' : state.status === 'locked' ? 'Locked' : 'Ready'}
                    </div>
                </div>

                {/* Pulse Effect */}
                <AnimatePresence>
                    {isPulsing && (
                        <motion.div
                            initial={{ scale: 1, opacity: 0.8 }}
                            animate={{ scale: 2, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                border: `3px solid ${colors.primary}`,
                            }}
                        />
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Particle Effects */}
            {showParticles && (
                <ParticleField
                    color={colors.primary}
                    active={state.status === 'active' || state.status === 'success'}
                />
            )}

            {/* Stats Display - Bottom */}
            <div
                style={{
                    position: 'absolute',
                    bottom: -40,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '16px',
                    whiteSpace: 'nowrap',
                }}
            >
                {/* Multiplier */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                        MULT
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: colors.primary }}>
                        {state.multiplier.toFixed(1)}x
                    </div>
                </div>

                {/* Streak */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                        STREAK
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFB800' }}>
                        🔥 {state.streakDays}
                    </div>
                </div>

                {/* Mastery */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                        MASTERY
                    </div>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: masteryPercent >= 85 ? '#00FF94' : '#FF3E3E'
                    }}>
                        {masteryPercent.toFixed(0)}%
                    </div>
                </div>
            </div>

            {/* Diamond Balance - Top */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    position: 'absolute',
                    top: -30,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: 'rgba(0, 224, 255, 0.1)',
                    border: '1px solid rgba(0, 224, 255, 0.3)',
                    borderRadius: '20px',
                }}
            >
                <span style={{ fontSize: '14px' }}>💎</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#00E0FF' }}>
                    {state.diamondBalance.toLocaleString()}
                </span>
            </motion.div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default DiamondOrb;
