/**
 * 🔐 AUTH HOOK — Supabase Authentication State
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Manages user authentication state and profile data.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// 🎭 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UserProfile {
    id: string;
    username: string;
    diamond_balance: number;
    avatar_url?: string;
    created_at: string;
}

export interface AuthState {
    isLoading: boolean;
    user: User | null;
    profile: UserProfile | null;
    isAuthenticated: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 AUTH HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useAuth(): AuthState & {
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
} {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    // Fetch user profile
    const fetchProfile = useCallback(async (userId: string) => {
        if (!isSupabaseConfigured()) {
            setProfile({
                id: userId,
                username: 'Guest Player',
                diamond_balance: 10000,
                created_at: new Date().toISOString(),
            });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Failed to fetch profile:', error);
                // Create a default profile if none exists
                setProfile({
                    id: userId,
                    username: user?.email?.split('@')[0] || 'Player',
                    diamond_balance: 10000,
                    created_at: new Date().toISOString(),
                });
            } else {
                setProfile(data as UserProfile);
            }
        } catch (err) {
            console.error('Profile fetch error:', err);
        }
    }, [user?.email]);

    // Refresh profile data
    const refreshProfile = useCallback(async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    }, [user, fetchProfile]);

    // Sign out
    const signOut = useCallback(async () => {
        if (!isSupabaseConfigured()) {
            setUser(null);
            setProfile(null);
            return;
        }

        try {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
        } catch (err) {
            console.error('Sign out error:', err);
        }
    }, []);

    // Initialize auth state
    useEffect(() => {
        if (!isSupabaseConfigured()) {
            setIsLoading(false);
            return;
        }

        // Get initial session
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                }
            } catch (err) {
                console.error('Auth init error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('🔐 Auth state changed:', event);

                if (session?.user) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    return {
        isLoading,
        user,
        profile,
        isAuthenticated: user !== null,
        signOut,
        refreshProfile,
    };
}

export default useAuth;
