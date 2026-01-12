/**
 * 🔐 HUB AUTHENTICATION HANDSHAKE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Receives auth session from parent hub via postMessage.
 * Eliminates double login when navigating from smarter.poker/hub to diamond arena.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 AUTH CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface UserProfile {
    id: string;
    username: string;
    avatar_url: string | null;
    diamond_balance: number;
    player_number: number | null;
}

interface HubAuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: User | null;
    profile: UserProfile | null;
    error: string | null;
}

interface HubAuthContextType extends HubAuthState {
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const HubAuthContext = createContext<HubAuthContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// 🔑 ALLOWED ORIGINS FOR POSTMESSAGE
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = [
    'https://smarter.poker',
    'https://www.smarter.poker',
    'http://localhost:3000', // Dev hub
    'http://localhost:3001',
];

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 HUB AUTH PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface HubAuthProviderProps {
    children: ReactNode;
}

export const HubAuthProvider: React.FC<HubAuthProviderProps> = ({ children }) => {
    const [state, setState] = useState<HubAuthState>({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        profile: null,
        error: null,
    });

    // Fetch user profile from Supabase
    const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
        if (!isSupabaseConfigured) return null;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, diamond_balance, player_number')
                .eq('id', userId)
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('[HubAuth] Failed to fetch profile:', err);
            return null;
        }
    }, []);

    // Handle session from hub via postMessage
    const handleHubMessage = useCallback(async (event: MessageEvent) => {
        // Verify origin
        if (!ALLOWED_ORIGINS.includes(event.origin)) {
            return;
        }

        const { type, payload } = event.data || {};

        if (type === 'SMARTER_POKER_AUTH') {
            console.log('[HubAuth] Received auth from hub');

            if (payload?.access_token && payload?.refresh_token) {
                try {
                    // Set session in Supabase client
                    const { data, error } = await supabase.auth.setSession({
                        access_token: payload.access_token,
                        refresh_token: payload.refresh_token,
                    });

                    if (error) throw error;

                    if (data.user) {
                        const profile = await fetchProfile(data.user.id);
                        setState({
                            isLoading: false,
                            isAuthenticated: true,
                            user: data.user,
                            profile,
                            error: null,
                        });

                        // Acknowledge receipt
                        event.source?.postMessage({
                            type: 'SMARTER_POKER_AUTH_ACK',
                            success: true,
                        }, { targetOrigin: event.origin });
                    }
                } catch (err) {
                    console.error('[HubAuth] Failed to set session:', err);
                    setState(prev => ({
                        ...prev,
                        isLoading: false,
                        error: 'Failed to authenticate from hub',
                    }));
                }
            }
        }
    }, [fetchProfile]);

    // Check for existing session on mount
    useEffect(() => {
        const initAuth = async () => {
            if (!isSupabaseConfigured) {
                // Local-only mode
                setState({
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    profile: {
                        id: 'local-user',
                        username: 'Guest',
                        avatar_url: null,
                        diamond_balance: 10000,
                        player_number: null,
                    },
                    error: null,
                });
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const profile = await fetchProfile(session.user.id);
                    setState({
                        isLoading: false,
                        isAuthenticated: true,
                        user: session.user,
                        profile,
                        error: null,
                    });
                } else {
                    // No session — request from hub if in iframe
                    if (window.parent !== window) {
                        console.log('[HubAuth] Requesting auth from hub...');
                        window.parent.postMessage({
                            type: 'SMARTER_POKER_AUTH_REQUEST',
                            source: 'diamond-arena',
                        }, '*');

                        // Wait a bit for response, then fallback
                        setTimeout(() => {
                            setState(prev => {
                                if (prev.isLoading) {
                                    return {
                                        ...prev,
                                        isLoading: false,
                                        error: 'No authentication received from hub',
                                    };
                                }
                                return prev;
                            });
                        }, 3000);
                    } else {
                        // Direct access — allow guest mode
                        setState({
                            isLoading: false,
                            isAuthenticated: false,
                            user: null,
                            profile: null,
                            error: null,
                        });
                    }
                }
            } catch (err) {
                console.error('[HubAuth] Init error:', err);
                setState({
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    profile: null,
                    error: 'Failed to initialize authentication',
                });
            }
        };

        // Listen for hub messages
        window.addEventListener('message', handleHubMessage);

        // Initialize
        initAuth();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const profile = await fetchProfile(session.user.id);
                setState({
                    isLoading: false,
                    isAuthenticated: true,
                    user: session.user,
                    profile,
                    error: null,
                });
            } else if (event === 'SIGNED_OUT') {
                setState({
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    profile: null,
                    error: null,
                });
            }
        });

        return () => {
            window.removeEventListener('message', handleHubMessage);
            subscription.unsubscribe();
        };
    }, [handleHubMessage, fetchProfile]);

    // Sign out
    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            profile: null,
            error: null,
        });

        // Notify hub
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'SMARTER_POKER_SIGN_OUT',
            }, '*');
        }
    }, []);

    // Refresh profile
    const refreshProfile = useCallback(async () => {
        if (state.user) {
            const profile = await fetchProfile(state.user.id);
            setState(prev => ({ ...prev, profile }));
        }
    }, [state.user, fetchProfile]);

    return (
        <HubAuthContext.Provider value={{
            ...state,
            signOut,
            refreshProfile,
        }}>
            {children}
        </HubAuthContext.Provider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎣 USE HUB AUTH HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useHubAuth(): HubAuthContextType {
    const context = useContext(HubAuthContext);
    if (!context) {
        throw new Error('useHubAuth must be used within HubAuthProvider');
    }
    return context;
}

export default HubAuthProvider;
