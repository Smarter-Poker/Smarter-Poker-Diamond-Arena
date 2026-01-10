/**
 * ⚡ ECONOMY FIX — ATOMIC MINTING ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Direct database-level minting. Zero network crawl.
 * Bypasses slow Node.js/Edge layer entirely.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚡ ECONOMY FIX — SECURE MINTING INTERFACE
// ═══════════════════════════════════════════════════════════

/**
 * Creates an EconomyFix instance bound to a Supabase client.
 * All operations execute directly on Postgres metal.
 * 
 * @param {object} supabase - Initialized Supabase client
 * @returns {object} EconomyFix interface
 */
export function createEconomyFix(supabase) {
    if (!supabase) {
        throw new Error('ECONOMY_ERROR: Supabase client is required');
    }

    return {
        /**
         * ⚡ Mint diamonds atomically (CREDIT)
         * Executes directly on database metal.
         * 
         * @param {string} userId - Target user UUID
         * @param {number} amount - Amount to mint
         * @param {object} options - Optional config
         * @returns {Promise<object>} Mint result with ATOMIC_SUCCESS status
         */
        async mintDiamondsAtomic(userId, amount, options = {}) {
            const { data, error } = await supabase.rpc('fn_mint_diamonds_secure', {
                target_user: userId,
                mint_amount: amount,
                mint_source: options.source || 'SESSION_REWARD',
                mint_metadata: options.metadata || {}
            });

            if (error) {
                return {
                    data: null,
                    error,
                    status: 'ATOMIC_FAILED',
                    message: error.message
                };
            }

            const result = typeof data === 'string' ? JSON.parse(data) : data;
            return {
                data: result.data,
                error: result.success ? null : result.error,
                status: result.status,
                meta: result.meta
            };
        },

        /**
         * ⚡ Burn diamonds atomically (DEBIT)
         * Executes directly on database metal.
         * 
         * @param {string} userId - Target user UUID
         * @param {number} amount - Amount to burn
         * @param {object} options - Optional config
         * @returns {Promise<object>} Burn result with ATOMIC_SUCCESS status
         */
        async burnDiamondsAtomic(userId, amount, options = {}) {
            const { data, error } = await supabase.rpc('fn_burn_diamonds_secure', {
                target_user: userId,
                burn_amount: amount,
                burn_source: options.source || 'ARCADE_STAKE',
                burn_metadata: options.metadata || {}
            });

            if (error) {
                return {
                    data: null,
                    error,
                    status: 'ATOMIC_FAILED'
                };
            }

            const result = typeof data === 'string' ? JSON.parse(data) : data;
            return {
                data: result.data,
                error: result.success ? null : result.error,
                status: result.status,
                meta: result.meta
            };
        },

        /**
         * ⚡ Get balance instantly
         * O(1) direct read from wallet table.
         * 
         * @param {string} userId - Target user UUID
         * @returns {Promise<object>} Balance data
         */
        async getBalanceFast(userId) {
            const { data, error } = await supabase.rpc('fn_get_balance_fast', {
                target_user: userId
            });

            if (error) {
                return { balance: 0, streak: 0, exists: false, error };
            }

            const result = typeof data === 'string' ? JSON.parse(data) : data;
            return {
                balance: result.balance,
                streak: result.streak,
                exists: result.exists,
                error: null
            };
        },

        /**
         * ⚡ Arcade transaction pair (stake + potential payout)
         * Wraps stake and payout into a clean interface.
         * 
         * @param {string} userId - Player UUID
         * @param {number} stakeAmount - Entry fee
         * @param {string} gameMode - Arcade mode identifier
         * @returns {object} Arcade session controller
         */
        createArcadeSession(userId, stakeAmount, gameMode) {
            // Capture parent methods via closure
            const burnFn = this.burnDiamondsAtomic.bind(this);
            const mintFn = this.mintDiamondsAtomic.bind(this);

            let sessionState = 'PENDING';
            let stakeResult = null;

            return {
                /**
                 * Execute the stake (call before game starts)
                 */
                async stake() {
                    stakeResult = await burnFn(userId, stakeAmount, {
                        source: 'ARCADE_STAKE',
                        metadata: { game_mode: gameMode }
                    });

                    if (stakeResult.status === 'ATOMIC_SUCCESS') {
                        sessionState = 'STAKED';
                    }

                    return stakeResult;
                },

                /**
                 * Execute payout (call after game ends)
                 */
                async payout(winAmount, gameResult = {}) {
                    if (sessionState !== 'STAKED') {
                        return {
                            error: 'INVALID_SESSION_STATE',
                            status: 'ATOMIC_FAILED'
                        };
                    }

                    if (winAmount <= 0) {
                        sessionState = 'COMPLETED_LOSS';
                        return {
                            data: { amount: 0 },
                            status: 'ATOMIC_SUCCESS'
                        };
                    }

                    const payoutResult = await mintFn(userId, winAmount, {
                        source: 'ARCADE_WIN',
                        metadata: {
                            game_mode: gameMode,
                            stake: stakeAmount,
                            ...gameResult
                        }
                    });

                    sessionState = payoutResult.status === 'ATOMIC_SUCCESS'
                        ? 'COMPLETED_WIN'
                        : 'PAYOUT_FAILED';

                    return payoutResult;
                },

                /**
                 * Get current session state
                 */
                getState() {
                    return { sessionState, stakeResult };
                }
            };
        }
    };
}

// ═══════════════════════════════════════════════════════════
// 📦 SINGLETON FACTORY
// ═══════════════════════════════════════════════════════════

let _economyInstance = null;

/**
 * Get or create the global EconomyFix instance.
 * 
 * @param {object} supabase - Supabase client (required on first call)
 * @returns {object} EconomyFix interface
 */
export function getEconomyFix(supabase) {
    if (!_economyInstance) {
        if (!supabase) {
            throw new Error('ECONOMY_ERROR: Supabase client required for initialization');
        }
        _economyInstance = createEconomyFix(supabase);
    }
    return _economyInstance;
}

// ═══════════════════════════════════════════════════════════
// 📤 DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════

export default { createEconomyFix, getEconomyFix };
