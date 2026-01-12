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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
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
