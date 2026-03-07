import { User } from '@supabase/supabase-js';

/**
 * 🛡️ THE BULLETPROOF AUTH SYSTEM
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Reads the Supabase user from LocalStorage directly, bypassing `getSession()`
 * which crashes in Safari due to `navigator.locks` limitations in iframes.
 *
 * This mirrors the Identity DNA architecture in the World Hub.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export function getAuthUser(): User | null {
    if (typeof window === 'undefined') return null;

    try {
        // Level 1: Primary Smarter Poker Token
        const explicitAuth = localStorage.getItem('smarter-poker-auth');
        if (explicitAuth) {
            const tokenData = JSON.parse(explicitAuth);
            if (tokenData?.user) {
                return tokenData.user as User;
            }
        }

        // Level 2: Supabase Default Token
        const sbKeys = Object.keys(localStorage).filter(
            k => k.startsWith('sb-') && k.endsWith('-auth-token')
        );

        if (sbKeys.length > 0) {
            const tokenData = JSON.parse(localStorage.getItem(sbKeys[0]) || '{}');
            if (tokenData?.user) {
                return tokenData.user as User;
            }
        }

        // Level 3: Cached Header User Fallback
        const cachedUserStr = localStorage.getItem('sp-cached-header-user');
        if (cachedUserStr) {
            const cachedUser = JSON.parse(cachedUserStr);
            if (cachedUser?.id) {
                // Return proxy shape of User
                return cachedUser as unknown as User;
            }
        }

        return null; // Return explicitly null
    } catch (err) {
        console.warn('⚠️ [DiamondAuth] LocalStorage parsing failed:', err);
        return null;
    }
}
