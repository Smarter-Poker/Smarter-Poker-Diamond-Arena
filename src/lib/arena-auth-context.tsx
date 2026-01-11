/**
 * 🚪 THE VOID GATE — ARENA AUTH CONTEXT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Persistent Auth Provider and Session Gate for Supabase.
 * Real-time listener for auth state changes.
 * Global State Contract for user capabilities and access flags.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
    type ReactNode
} from 'react';
import { createClient, type User, type Session, type SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type UserCapability =
    | 'ARENA_ACCESS'
    | 'STAKING_ENABLED'
    | 'HIGH_STAKES_UNLOCKED'
    | 'LEADERBOARD_VIEW'
    | 'TOURNAMENT_ENTRY'
    | 'ADMIN_ACCESS'
    | 'SOVEREIGN_ADMIN';

export type AccessFlag =
    | 'EMAIL_VERIFIED'
    | 'KYC_COMPLETE'
    | 'BIOMETRIC_ENABLED'
    | 'TWO_FACTOR_ENABLED'
    | 'VELOCITY_FLAGGED'
    | 'COOLDOWN_ACTIVE';

export interface ArenaProfile {
    id: string;
    username: string;
    avatarUrl?: string;
    level: number;
    xpTotal: number;
    diamondBalance: number;
    skillTier: string;
    createdAt: Date;
}

export interface ArenaState {
    // Auth State
    user: User | null;
    session: Session | null;
    profile: ArenaProfile | null;

    // Access Control
    capabilities: UserCapability[];
    accessFlags: AccessFlag[];

    // UI State
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;

    // Supabase Client (for direct queries)
    supabase: SupabaseClient;
}

export interface ArenaActions {
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    refreshSession: () => Promise<void>;
    checkCapability: (capability: UserCapability) => boolean;
    hasFlag: (flag: AccessFlag) => boolean;
}

type ArenaContextValue = ArenaState & ArenaActions;

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 SUPABASE CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ VOID_GATE: Supabase credentials not configured. Auth will be disabled.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// 🌌 CONTEXT CREATION
// ═══════════════════════════════════════════════════════════════════════════

const ArenaContext = createContext<ArenaContextValue | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 ARENA PROVIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ArenaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<Omit<ArenaState, 'supabase'>>({
        user: null,
        session: null,
        profile: null,
        capabilities: [],
        accessFlags: [],
        isLoading: true,
        isAuthenticated: false,
        error: null,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 FETCH USER PROFILE & CAPABILITIES
    // ═══════════════════════════════════════════════════════════════════════

    const fetchUserProfile = useCallback(async (userId: string) => {
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profileError) {
                console.warn('⚠️ VOID_GATE: Profile fetch failed:', profileError.message);
                return null;
            }

            const profile: ArenaProfile = {
                id: profileData.id,
                username: profileData.username || 'Anonymous',
                avatarUrl: profileData.avatar_url,
                level: profileData.level || 1,
                xpTotal: profileData.xp_total || 0,
                diamondBalance: profileData.diamond_balance || 0,
                skillTier: profileData.skill_tier || 'NOVICE',
                createdAt: new Date(profileData.created_at),
            };

            // Derive capabilities from profile
            const capabilities: UserCapability[] = ['ARENA_ACCESS', 'LEADERBOARD_VIEW'];

            if (profile.level >= 1) capabilities.push('STAKING_ENABLED');
            if (profile.level >= 20) capabilities.push('HIGH_STAKES_UNLOCKED');
            if (profile.level >= 5) capabilities.push('TOURNAMENT_ENTRY');
            if (profileData.is_admin) capabilities.push('ADMIN_ACCESS');
            if (profileData.is_sovereign_admin) capabilities.push('SOVEREIGN_ADMIN');

            // Derive access flags
            const accessFlags: AccessFlag[] = [];
            if (profileData.email_verified) accessFlags.push('EMAIL_VERIFIED');
            if (profileData.kyc_complete) accessFlags.push('KYC_COMPLETE');
            if (profileData.biometric_enabled) accessFlags.push('BIOMETRIC_ENABLED');
            if (profileData.two_factor_enabled) accessFlags.push('TWO_FACTOR_ENABLED');
            if (profileData.velocity_flagged) accessFlags.push('VELOCITY_FLAGGED');
            if (profileData.cooldown_until && new Date(profileData.cooldown_until) > new Date()) {
                accessFlags.push('COOLDOWN_ACTIVE');
            }

            return { profile, capabilities, accessFlags };
        } catch (err) {
            console.error('❌ VOID_GATE: Profile fetch error:', err);
            return null;
        }
    }, []);

    // ═══════════════════════════════════════════════════════════════════════
    // 🔐 INITIALIZE AUTH STATE
    // ═══════════════════════════════════════════════════════════════════════

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('❌ VOID_GATE: Session fetch error:', error.message);
                    setState(prev => ({ ...prev, isLoading: false, error: error.message }));
                    return;
                }

                if (session?.user) {
                    const profileData = await fetchUserProfile(session.user.id);

                    setState(prev => ({
                        ...prev,
                        session,
                        user: session.user,
                        profile: profileData?.profile || null,
                        capabilities: profileData?.capabilities || [],
                        accessFlags: profileData?.accessFlags || [],
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    }));
                } else {
                    setState(prev => ({
                        ...prev,
                        isLoading: false,
                        isAuthenticated: false,
                    }));
                }
            } catch (err) {
                console.error('❌ VOID_GATE: Init error:', err);
                setState(prev => ({ ...prev, isLoading: false, error: 'Initialization failed' }));
            }
        };

        // Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('🔄 VOID_GATE: Auth event:', event);

                if (event === 'SIGNED_IN' && session?.user) {
                    const profileData = await fetchUserProfile(session.user.id);

                    setState(prev => ({
                        ...prev,
                        session,
                        user: session.user,
                        profile: profileData?.profile || null,
                        capabilities: profileData?.capabilities || [],
                        accessFlags: profileData?.accessFlags || [],
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    }));
                } else if (event === 'SIGNED_OUT') {
                    setState(prev => ({
                        ...prev,
                        session: null,
                        user: null,
                        profile: null,
                        capabilities: [],
                        accessFlags: [],
                        isAuthenticated: false,
                        isLoading: false,
                    }));
                } else if (event === 'TOKEN_REFRESHED' && session) {
                    setState(prev => ({ ...prev, session }));
                }
            }
        );

        initializeAuth();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchUserProfile]);

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 AUTH ACTIONS
    // ═══════════════════════════════════════════════════════════════════════

    const signIn = useCallback(async (email: string, password: string) => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setState(prev => ({ ...prev, isLoading: false, error: error.message }));
            return { success: false, error: error.message };
        }

        return { success: true };
    }, []);

    const signUp = useCallback(async (email: string, password: string, username: string) => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username },
            },
        });

        if (error) {
            setState(prev => ({ ...prev, isLoading: false, error: error.message }));
            return { success: false, error: error.message };
        }

        return { success: true };
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    const refreshSession = useCallback(async () => {
        const { data: { session } } = await supabase.auth.refreshSession();
        if (session) {
            setState(prev => ({ ...prev, session }));
        }
    }, []);

    const checkCapability = useCallback((capability: UserCapability) => {
        return state.capabilities.includes(capability);
    }, [state.capabilities]);

    const hasFlag = useCallback((flag: AccessFlag) => {
        return state.accessFlags.includes(flag);
    }, [state.accessFlags]);

    // ═══════════════════════════════════════════════════════════════════════
    // 📦 CONTEXT VALUE
    // ═══════════════════════════════════════════════════════════════════════

    const contextValue = useMemo<ArenaContextValue>(() => ({
        ...state,
        supabase,
        signIn,
        signUp,
        signOut,
        refreshSession,
        checkCapability,
        hasFlag,
    }), [state, signIn, signUp, signOut, refreshSession, checkCapability, hasFlag]);

    return (
        <ArenaContext.Provider value={contextValue}>
            {/* Grain Overlay for cinematic texture */}
            <div className="grain-overlay" />
            {children}
        </ArenaContext.Provider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 CUSTOM HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Primary hook for accessing Arena state and actions
 */
export const useArena = (): ArenaContextValue => {
    const context = useContext(ArenaContext);
    if (!context) {
        throw new Error('useArena must be used within an ArenaProvider');
    }
    return context;
};

/**
 * Hook for auth state only (lighter weight)
 */
export const useArenaAuth = () => {
    const { user, session, isAuthenticated, isLoading, signIn, signUp, signOut } = useArena();
    return { user, session, isAuthenticated, isLoading, signIn, signUp, signOut };
};

/**
 * Hook for profile data only
 */
export const useArenaProfile = () => {
    const { profile, capabilities, accessFlags, checkCapability, hasFlag } = useArena();
    return { profile, capabilities, accessFlags, checkCapability, hasFlag };
};

/**
 * Hook for Supabase client access
 */
export const useSupabase = () => {
    const { supabase } = useArena();
    return supabase;
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { supabase };
export default ArenaProvider;
