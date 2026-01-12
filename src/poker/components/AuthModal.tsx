/**
 * 🔐 AUTH MODAL — Login & Signup for Diamond Arena
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Supabase authentication with email/password and social providers.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 AUTH MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (userId: string) => void;
}

type AuthMode = 'login' | 'signup';

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const resetForm = useCallback(() => {
        setEmail('');
        setPassword('');
        setUsername('');
        setError(null);
        setSuccessMessage(null);
    }, []);

    const handleLogin = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (authError) {
                setError(authError.message);
            } else if (data.user) {
                onSuccess(data.user.id);
                onClose();
                resetForm();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsLoading(false);
        }
    }, [email, password, onSuccess, onClose, resetForm]);

    const handleSignup = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            setIsLoading(false);
            return;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            setIsLoading(false);
            return;
        }

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        username: username.trim(),
                    },
                },
            });

            if (authError) {
                setError(authError.message);
            } else if (data.user) {
                // Create profile with initial diamond balance
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        username: username.trim(),
                        diamond_balance: 10000, // Starting balance
                    });

                if (profileError && !profileError.message.includes('duplicate')) {
                    console.error('Profile creation error:', profileError);
                }

                setSuccessMessage('Account created! Check your email to confirm.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Signup failed');
        } finally {
            setIsLoading(false);
        }
    }, [email, password, username]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (mode === 'login') {
            handleLogin();
        } else {
            handleSignup();
        }
    }, [mode, handleLogin, handleSignup]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 200,
                    backdropFilter: 'blur(12px)',
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
                        borderRadius: 20,
                        border: '1px solid rgba(255,184,0,0.3)',
                        padding: 40,
                        width: 420,
                        maxWidth: '90vw',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 60px rgba(255,184,0,0.1)',
                    }}
                >
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
                        <h2 style={{
                            color: '#FFB800',
                            fontSize: 24,
                            fontWeight: 700,
                            margin: 0,
                            letterSpacing: '0.05em',
                        }}>
                            {mode === 'login' ? 'Welcome Back' : 'Join the Arena'}
                        </h2>
                        <p style={{
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 14,
                            marginTop: 8,
                        }}>
                            {mode === 'login'
                                ? 'Sign in to play for diamonds'
                                : 'Create your account to start playing'
                            }
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        {/* Username (signup only) */}
                        {mode === 'signup' && (
                            <div style={{ marginBottom: 20 }}>
                                <label style={{
                                    display: 'block',
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    marginBottom: 8,
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                }}>
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="Choose your player name"
                                    required
                                    minLength={3}
                                    maxLength={20}
                                    style={{
                                        width: '100%',
                                        padding: '14px 18px',
                                        borderRadius: 10,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(0,0,0,0.3)',
                                        color: '#FFF',
                                        fontSize: 15,
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        )}

                        {/* Email */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{
                                display: 'block',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 8,
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                            }}>
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                                style={{
                                    width: '100%',
                                    padding: '14px 18px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.3)',
                                    color: '#FFF',
                                    fontSize: 15,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: 24 }}>
                            <label style={{
                                display: 'block',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: 12,
                                fontWeight: 500,
                                marginBottom: 8,
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                            }}>
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
                                required
                                minLength={6}
                                style={{
                                    width: '100%',
                                    padding: '14px 18px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.3)',
                                    color: '#FFF',
                                    fontSize: 15,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    style={{
                                        padding: '12px 16px',
                                        background: 'rgba(255,68,68,0.1)',
                                        borderRadius: 8,
                                        marginBottom: 20,
                                        color: '#FF4444',
                                        fontSize: 13,
                                    }}
                                >
                                    ⚠️ {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Success Message */}
                        <AnimatePresence>
                            {successMessage && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    style={{
                                        padding: '12px 16px',
                                        background: 'rgba(0,255,136,0.1)',
                                        borderRadius: 8,
                                        marginBottom: 20,
                                        color: '#00FF88',
                                        fontSize: 13,
                                    }}
                                >
                                    ✓ {successMessage}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit Button */}
                        <motion.button
                            type="submit"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '16px 24px',
                                borderRadius: 12,
                                border: 'none',
                                background: 'linear-gradient(180deg, #FFB800 0%, #CC9400 100%)',
                                color: '#000',
                                fontSize: 16,
                                fontWeight: 700,
                                cursor: isLoading ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                opacity: isLoading ? 0.7 : 1,
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        style={{
                                            width: 18,
                                            height: 18,
                                            border: '2px solid rgba(0,0,0,0.2)',
                                            borderTopColor: '#000',
                                            borderRadius: '50%',
                                        }}
                                    />
                                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                                </>
                            ) : (
                                <>
                                    {mode === 'login' ? '🎰 Sign In' : '💎 Create Account'}
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Mode Toggle */}
                    <div style={{
                        marginTop: 24,
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 14,
                    }}>
                        {mode === 'login' ? (
                            <>
                                Don't have an account?{' '}
                                <button
                                    onClick={() => { setMode('signup'); setError(null); setSuccessMessage(null); }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#00E0FF',
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        fontWeight: 600,
                                    }}
                                >
                                    Sign Up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button
                                    onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#00E0FF',
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        fontWeight: 600,
                                    }}
                                >
                                    Sign In
                                </button>
                            </>
                        )}
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 18,
                            cursor: 'pointer',
                        }}
                    >
                        ✕
                    </button>

                    {/* Signup Bonus */}
                    {mode === 'signup' && (
                        <div style={{
                            marginTop: 24,
                            padding: 16,
                            background: 'rgba(255,184,0,0.05)',
                            borderRadius: 12,
                            border: '1px solid rgba(255,184,0,0.2)',
                            textAlign: 'center',
                        }}>
                            <span style={{ fontSize: 20 }}>🎁</span>
                            <p style={{
                                color: '#FFB800',
                                fontSize: 14,
                                fontWeight: 600,
                                marginTop: 8,
                                marginBottom: 4,
                            }}>
                                New Player Bonus
                            </p>
                            <p style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 13,
                            }}>
                                Start with 💎 10,000 Diamonds to play!
                            </p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AuthModal;
