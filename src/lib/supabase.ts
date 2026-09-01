/**
 * 🔗 SUPABASE CLIENT — DIAMOND ARENA
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Production-ready Supabase client for the Diamond Arena.
 * Environment: PokerIQ-Production (kuklfnapbkmacvwxktbh)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ ENVIRONMENT CONFIGURATION — VITE LAW
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// Validate configuration in development
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '⚠️ [Diamond Arena] Missing Supabase configuration.\n' +
        '   Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local'
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SHARED SESSION STORAGE KEY — ORG-WIDE. DO NOT CHANGE INDEPENDENTLY.
 *
 * Every Smarter Poker surface (World Hub, Club Arena, Diamond Arena) reads
 * and writes the Supabase session under this one localStorage key, so a
 * user who signs in on one property is signed in on all of them.
 *
 * Until 2026-09-01 this client passed no `storageKey`, so supabase-js used
 * its own default (`sb-kuklfnapbkmacvwxktbh-auth-token`) while
 * src/lib/authUtils.ts read `smarter-poker-auth` as its Level 1 key — the
 * Arena wrote one key and read another.
 *
 * Changing this value in one repo silently un-shares the session for that
 * property. If it ever has to change, it changes everywhere at once.
 */
const SHARED_AUTH_STORAGE_KEY = 'smarter-poker-auth';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Shared org-wide session key — see SHARED_AUTH_STORAGE_KEY above.
        storageKey: SHARED_AUTH_STORAGE_KEY,
        // Persist session in localStorage
        persistSession: true,
        // Auto-refresh tokens before expiry
        autoRefreshToken: true,
        // Detect session from URL (OAuth callbacks)
        detectSessionInUrl: true,
    },
    global: {
        headers: {
            'x-client-name': 'diamond-arena',
            'x-client-version': '1.0.0',
        },
    },
});

// ═══════════════════════════════════════════════════════════════════════════
// 📡 CONNECTION STATUS HELPER
// ═══════════════════════════════════════════════════════════════════════════

export const isSupabaseConfigured = (): boolean => {
    return Boolean(supabaseUrl && supabaseAnonKey);
};

export const getConnectionInfo = () => ({
    url: supabaseUrl,
    isConfigured: isSupabaseConfigured(),
    project: 'PokerIQ-Production',
    ref: 'kuklfnapbkmacvwxktbh',
});

export default supabase;
