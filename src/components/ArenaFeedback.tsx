/**
 * ✨ THE INTERACTION ENGINE — ARENA FEEDBACK
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Toasts, overlays, and spatial notifications.
 * High-fidelity "Level Up" and "Sub-optimal Answer" alerts.
 * Yellow color identity for training feedback.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    type ReactNode
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 FEEDBACK THEME (YELLOW IDENTITY)
// ═══════════════════════════════════════════════════════════════════════════

const FEEDBACK_COLORS = {
    // Yellow/Gold for training & rewards
    YELLOW: {
        primary: '#FFB800',
        glow: 'rgba(255, 184, 0, 0.4)',
        bg: 'rgba(255, 184, 0, 0.1)',
        border: 'rgba(255, 184, 0, 0.3)',
    },
    // Green for success/XP
    GREEN: {
        primary: '#00FF94',
        glow: 'rgba(0, 255, 148, 0.4)',
        bg: 'rgba(0, 255, 148, 0.1)',
        border: 'rgba(0, 255, 148, 0.3)',
    },
    // Blue for diamonds/info
    BLUE: {
        primary: '#00E0FF',
        glow: 'rgba(0, 224, 255, 0.4)',
        bg: 'rgba(0, 224, 255, 0.1)',
        border: 'rgba(0, 224, 255, 0.3)',
    },
    // Red for errors/warnings
    RED: {
        primary: '#FF3E3E',
        glow: 'rgba(255, 62, 62, 0.4)',
        bg: 'rgba(255, 62, 62, 0.1)',
        border: 'rgba(255, 62, 62, 0.3)',
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type ToastType = 'XP' | 'DIAMOND' | 'LEVEL_UP' | 'STREAK' | 'ERROR' | 'WARNING' | 'INFO' | 'GTO_FEEDBACK';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    description?: string;
    amount?: number;
    duration?: number;
    icon?: string;
}

export interface Overlay {
    id: string;
    type: 'LEVEL_UP' | 'SUB_OPTIMAL' | 'STREAK_BONUS' | 'MASTERY_ACHIEVED' | 'CUSTOM';
    data: Record<string, any>;
    onClose?: () => void;
}

interface FeedbackContextValue {
    // Toast methods
    showToast: (toast: Omit<Toast, 'id'>) => void;
    showXPToast: (amount: number, reason?: string) => void;
    showDiamondToast: (amount: number, reason?: string) => void;
    showLevelUpToast: (newLevel: number) => void;
    showStreakToast: (days: number, multiplier: number) => void;
    showErrorToast: (message: string) => void;
    showGTOFeedback: (isCorrect: boolean, explanation: string) => void;
    dismissToast: (id: string) => void;

    // Overlay methods
    showOverlay: (overlay: Omit<Overlay, 'id'>) => void;
    showLevelUpOverlay: (level: number, xpEarned: number, unlockedFeatures?: string[]) => void;
    showSubOptimalOverlay: (userAction: string, gtoAction: string, evLoss: number, explanation: string) => void;
    showMasteryOverlay: (level: number, accuracy: number) => void;
    dismissOverlay: (id: string) => void;
    dismissAllOverlays: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌌 FEEDBACK CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 🍞 TOAST COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const getToastConfig = (type: ToastType) => {
    switch (type) {
        case 'XP':
            return { colors: FEEDBACK_COLORS.GREEN, icon: '⚡', label: 'XP EARNED' };
        case 'DIAMOND':
            return { colors: FEEDBACK_COLORS.BLUE, icon: '💎', label: 'DIAMONDS' };
        case 'LEVEL_UP':
            return { colors: FEEDBACK_COLORS.YELLOW, icon: '🎮', label: 'LEVEL UP!' };
        case 'STREAK':
            return { colors: FEEDBACK_COLORS.YELLOW, icon: '🔥', label: 'STREAK BONUS' };
        case 'ERROR':
            return { colors: FEEDBACK_COLORS.RED, icon: '❌', label: 'ERROR' };
        case 'WARNING':
            return { colors: FEEDBACK_COLORS.YELLOW, icon: '⚠️', label: 'WARNING' };
        case 'GTO_FEEDBACK':
            return { colors: FEEDBACK_COLORS.YELLOW, icon: '🎯', label: 'GTO ANALYSIS' };
        default:
            return { colors: FEEDBACK_COLORS.BLUE, icon: 'ℹ️', label: 'INFO' };
    }
};

const ArenaToast: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
    const config = getToastConfig(toast.type);

    useEffect(() => {
        const timer = setTimeout(onDismiss, toast.duration || 4000);
        return () => clearTimeout(timer);
    }, [onDismiss, toast.duration]);

    return (
        <motion.div
            initial={{ x: 300, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 300, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
                background: 'rgba(5, 5, 7, 0.95)',
                borderLeft: `4px solid ${config.colors.primary}`,
                borderRadius: '8px',
                padding: '16px 20px',
                boxShadow: `0 0 30px ${config.colors.glow}, 0 10px 40px rgba(0,0,0,0.5)`,
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                minWidth: '300px',
                maxWidth: '400px',
                cursor: 'pointer',
                backdropFilter: 'blur(20px)',
            }}
            onClick={onDismiss}
        >
            {/* Icon */}
            <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
                style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: config.colors.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0,
                }}
            >
                {toast.icon || config.icon}
            </motion.div>

            {/* Content */}
            <div style={{ flex: 1 }}>
                <p style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: config.colors.primary,
                    margin: 0,
                    opacity: 0.8,
                }}>
                    {config.label}
                </p>
                <p style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    margin: '4px 0 0 0',
                    textTransform: 'uppercase',
                }}>
                    {toast.amount !== undefined ? `+${toast.amount.toLocaleString()} ` : ''}{toast.message}
                </p>
                {toast.description && (
                    <p style={{
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.6)',
                        margin: '4px 0 0 0',
                    }}>
                        {toast.description}
                    </p>
                )}
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎆 LEVEL UP OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

const LevelUpOverlay: React.FC<{
    level: number;
    xpEarned: number;
    unlockedFeatures?: string[];
    onClose: () => void;
}> = ({ level, xpEarned, unlockedFeatures, onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            backdropFilter: 'blur(10px)',
        }}
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 50 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
                background: 'linear-gradient(135deg, rgba(255, 184, 0, 0.1) 0%, rgba(5, 5, 7, 0.95) 50%)',
                border: `2px solid ${FEEDBACK_COLORS.YELLOW.primary}`,
                borderRadius: '24px',
                padding: '48px 64px',
                textAlign: 'center',
                boxShadow: `0 0 100px ${FEEDBACK_COLORS.YELLOW.glow}`,
                maxWidth: '500px',
            }}
        >
            {/* Celebration Icon */}
            <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: 3 }}
                style={{ fontSize: '64px', marginBottom: '24px' }}
            >
                🎮
            </motion.div>

            {/* Title */}
            <h1 style={{
                fontSize: '48px',
                fontWeight: 800,
                color: FEEDBACK_COLORS.YELLOW.primary,
                margin: 0,
                textShadow: `0 0 30px ${FEEDBACK_COLORS.YELLOW.glow}`,
                letterSpacing: '-0.02em',
            }}>
                LEVEL {level}
            </h1>

            <p style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
                margin: '12px 0 0 0',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
            }}>
                ⚡ +{xpEarned.toLocaleString()} XP EARNED
            </p>

            {/* Unlocked Features */}
            {unlockedFeatures && unlockedFeatures.length > 0 && (
                <div style={{
                    marginTop: '32px',
                    padding: '20px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                }}>
                    <p style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.5)',
                        letterSpacing: '0.15em',
                        margin: '0 0 12px 0',
                    }}>
                        NEW UNLOCKS
                    </p>
                    {unlockedFeatures.map((feature, i) => (
                        <motion.div
                            key={feature}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#FFFFFF',
                                fontSize: '14px',
                                marginTop: i > 0 ? '8px' : 0,
                            }}
                        >
                            <span style={{ color: FEEDBACK_COLORS.GREEN.primary }}>✓</span>
                            {feature}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Continue Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                style={{
                    marginTop: '32px',
                    padding: '16px 48px',
                    background: FEEDBACK_COLORS.YELLOW.primary,
                    color: '#000',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                    boxShadow: `0 0 30px ${FEEDBACK_COLORS.YELLOW.glow}`,
                }}
            >
                Continue
            </motion.button>
        </motion.div>
    </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ SUB-OPTIMAL ANSWER OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

const SubOptimalOverlay: React.FC<{
    userAction: string;
    gtoAction: string;
    evLoss: number;
    explanation: string;
    onClose: () => void;
}> = ({ userAction, gtoAction, evLoss, explanation, onClose }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            backdropFilter: 'blur(10px)',
        }}
        onClick={onClose}
    >
        <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 50 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
                background: 'linear-gradient(135deg, rgba(255, 184, 0, 0.08) 0%, rgba(5, 5, 7, 0.95) 50%)',
                border: `2px solid ${FEEDBACK_COLORS.YELLOW.border}`,
                borderRadius: '24px',
                padding: '40px 48px',
                maxWidth: '550px',
                boxShadow: `0 0 60px ${FEEDBACK_COLORS.YELLOW.glow}`,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: FEEDBACK_COLORS.YELLOW.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                }}>
                    🎯
                </div>
                <div>
                    <h2 style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: FEEDBACK_COLORS.YELLOW.primary,
                        margin: 0,
                    }}>
                        GTO ANALYSIS
                    </h2>
                    <p style={{
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.5)',
                        margin: '4px 0 0 0',
                    }}>
                        Sub-optimal play detected
                    </p>
                </div>
            </div>

            {/* Comparison */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '24px',
            }}>
                {/* User Action */}
                <div style={{
                    background: 'rgba(255, 62, 62, 0.1)',
                    border: '1px solid rgba(255, 62, 62, 0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                }}>
                    <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, letterSpacing: '0.1em' }}>
                        YOUR ACTION
                    </p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: FEEDBACK_COLORS.RED.primary, margin: '8px 0 0 0' }}>
                        {userAction}
                    </p>
                </div>

                {/* GTO Action */}
                <div style={{
                    background: 'rgba(0, 255, 148, 0.1)',
                    border: '1px solid rgba(0, 255, 148, 0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                }}>
                    <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, letterSpacing: '0.1em' }}>
                        GTO OPTIMAL
                    </p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: FEEDBACK_COLORS.GREEN.primary, margin: '8px 0 0 0' }}>
                        {gtoAction}
                    </p>
                </div>
            </div>

            {/* EV Loss */}
            <div style={{
                background: 'rgba(255, 184, 0, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                textAlign: 'center',
            }}>
                <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, letterSpacing: '0.1em' }}>
                    EV LOSS
                </p>
                <p style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: FEEDBACK_COLORS.RED.primary,
                    margin: '8px 0 0 0',
                }}>
                    -{evLoss.toFixed(2)} BB
                </p>
            </div>

            {/* Explanation */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
            }}>
                <p style={{ fontSize: '10px', color: FEEDBACK_COLORS.YELLOW.primary, margin: 0, letterSpacing: '0.1em' }}>
                    WHY THIS MATTERS
                </p>
                <p style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    margin: '12px 0 0 0',
                    lineHeight: 1.6,
                }}>
                    {explanation}
                </p>
            </div>

            {/* Continue Button */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                style={{
                    width: '100%',
                    padding: '16px',
                    background: FEEDBACK_COLORS.YELLOW.primary,
                    color: '#000',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                }}
            >
                Got It — Continue Training
            </motion.button>
        </motion.div>
    </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 FEEDBACK PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [overlays, setOverlays] = useState<Overlay[]>([]);

    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Toast methods
    const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const newToast = { ...toast, id: generateId() };
        setToasts(prev => [...prev, newToast]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showXPToast = useCallback((amount: number, reason?: string) => {
        showToast({ type: 'XP', message: 'XP', amount, description: reason });
    }, [showToast]);

    const showDiamondToast = useCallback((amount: number, reason?: string) => {
        showToast({ type: 'DIAMOND', message: 'Diamonds', amount, description: reason });
    }, [showToast]);

    const showLevelUpToast = useCallback((newLevel: number) => {
        showToast({ type: 'LEVEL_UP', message: `Reached Level ${newLevel}!`, duration: 5000 });
    }, [showToast]);

    const showStreakToast = useCallback((days: number, multiplier: number) => {
        showToast({ type: 'STREAK', message: `${days} Day Streak!`, description: `${multiplier}x multiplier active`, duration: 5000 });
    }, [showToast]);

    const showErrorToast = useCallback((message: string) => {
        showToast({ type: 'ERROR', message, duration: 6000 });
    }, [showToast]);

    const showGTOFeedback = useCallback((isCorrect: boolean, explanation: string) => {
        showToast({
            type: 'GTO_FEEDBACK',
            message: isCorrect ? 'GTO Optimal!' : 'Sub-Optimal',
            icon: isCorrect ? '✅' : '⚠️',
            description: explanation,
            duration: 5000,
        });
    }, [showToast]);

    // Overlay methods
    const showOverlay = useCallback((overlay: Omit<Overlay, 'id'>) => {
        const newOverlay = { ...overlay, id: generateId() };
        setOverlays(prev => [...prev, newOverlay]);
    }, []);

    const dismissOverlay = useCallback((id: string) => {
        setOverlays(prev => prev.filter(o => o.id !== id));
    }, []);

    const dismissAllOverlays = useCallback(() => {
        setOverlays([]);
    }, []);

    const showLevelUpOverlay = useCallback((level: number, xpEarned: number, unlockedFeatures?: string[]) => {
        showOverlay({ type: 'LEVEL_UP', data: { level, xpEarned, unlockedFeatures } });
    }, [showOverlay]);

    const showSubOptimalOverlay = useCallback((userAction: string, gtoAction: string, evLoss: number, explanation: string) => {
        showOverlay({ type: 'SUB_OPTIMAL', data: { userAction, gtoAction, evLoss, explanation } });
    }, [showOverlay]);

    const showMasteryOverlay = useCallback((level: number, accuracy: number) => {
        showOverlay({ type: 'MASTERY_ACHIEVED', data: { level, accuracy } });
    }, [showOverlay]);

    const contextValue: FeedbackContextValue = {
        showToast,
        showXPToast,
        showDiamondToast,
        showLevelUpToast,
        showStreakToast,
        showErrorToast,
        showGTOFeedback,
        dismissToast,
        showOverlay,
        showLevelUpOverlay,
        showSubOptimalOverlay,
        showMasteryOverlay,
        dismissOverlay,
        dismissAllOverlays,
    };

    // Render toasts via portal
    const toastRoot = typeof document !== 'undefined' ? document.getElementById('arena-toast-root') : null;
    const overlayRoot = typeof document !== 'undefined' ? document.getElementById('arena-overlay-root') : null;

    return (
        <FeedbackContext.Provider value={contextValue}>
            {children}

            {/* Toast Portal */}
            {toastRoot && ReactDOM.createPortal(
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', pointerEvents: 'auto' }}>
                    <AnimatePresence mode="popLayout">
                        {toasts.map(toast => (
                            <ArenaToast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
                        ))}
                    </AnimatePresence>
                </div>,
                toastRoot
            )}

            {/* Overlay Portal */}
            {overlayRoot && ReactDOM.createPortal(
                <AnimatePresence>
                    {overlays.map(overlay => {
                        const handleClose = () => {
                            overlay.onClose?.();
                            dismissOverlay(overlay.id);
                        };

                        switch (overlay.type) {
                            case 'LEVEL_UP':
                                return (
                                    <LevelUpOverlay
                                        key={overlay.id}
                                        level={overlay.data.level}
                                        xpEarned={overlay.data.xpEarned}
                                        unlockedFeatures={overlay.data.unlockedFeatures}
                                        onClose={handleClose}
                                    />
                                );
                            case 'SUB_OPTIMAL':
                                return (
                                    <SubOptimalOverlay
                                        key={overlay.id}
                                        userAction={overlay.data.userAction}
                                        gtoAction={overlay.data.gtoAction}
                                        evLoss={overlay.data.evLoss}
                                        explanation={overlay.data.explanation}
                                        onClose={handleClose}
                                    />
                                );
                            default:
                                return null;
                        }
                    })}
                </AnimatePresence>,
                overlayRoot
            )}
        </FeedbackContext.Provider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 CUSTOM HOOK
// ═══════════════════════════════════════════════════════════════════════════

export const useFeedback = (): FeedbackContextValue => {
    const context = useContext(FeedbackContext);
    if (!context) {
        throw new Error('useFeedback must be used within a FeedbackProvider');
    }
    return context;
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { ArenaToast, LevelUpOverlay, SubOptimalOverlay };
export default FeedbackProvider;
