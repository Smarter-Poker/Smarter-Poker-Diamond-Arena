/**
 * 🧪 ECONOMY FIX — TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for atomic database-level minting operations.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { jest } from '@jest/globals';
import { createEconomyFix, getEconomyFix } from '../EconomyFix.js';

// ═══════════════════════════════════════════════════════════
// 🔌 MOCK SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════

const createMockSupabase = (rpcResponses = {}) => {
    return {
        rpc: jest.fn((functionName, params) => {
            const response = rpcResponses[functionName];
            if (response?.error) {
                return Promise.resolve({ data: null, error: response.error });
            }
            return Promise.resolve({ data: response?.data || {}, error: null });
        })
    };
};

// ═══════════════════════════════════════════════════════════
// ⚡ ECONOMY FIX TESTS
// ═══════════════════════════════════════════════════════════

describe('⚡ EconomyFix (Database Metal Minting)', () => {

    describe('createEconomyFix()', () => {

        test('✅ Throws error if supabase client not provided', () => {
            expect(() => createEconomyFix(null)).toThrow('ECONOMY_ERROR');
        });

        test('✅ Returns interface with required methods', () => {
            const supabase = createMockSupabase({});
            const economy = createEconomyFix(supabase);

            expect(typeof economy.mintDiamondsAtomic).toBe('function');
            expect(typeof economy.burnDiamondsAtomic).toBe('function');
            expect(typeof economy.getBalanceFast).toBe('function');
            expect(typeof economy.createArcadeSession).toBe('function');
        });
    });

    describe('mintDiamondsAtomic()', () => {

        test('✅ Calls fn_mint_diamonds_secure with correct params', async () => {
            const mockResponse = {
                success: true,
                status: 'ATOMIC_SUCCESS',
                data: {
                    user_id: 'user-123',
                    amount: 100,
                    balance_before: 0,
                    balance_after: 100,
                    wallet_id: 'wallet-abc',
                    transaction_id: 'tx-xyz',
                    wallet_created: true
                },
                meta: {
                    execution_ms: 2.5,
                    timestamp: '2026-01-09T00:00:00Z'
                }
            };

            const supabase = createMockSupabase({
                fn_mint_diamonds_secure: { data: mockResponse }
            });

            const economy = createEconomyFix(supabase);
            const result = await economy.mintDiamondsAtomic('user-123', 100);

            expect(supabase.rpc).toHaveBeenCalledWith('fn_mint_diamonds_secure', {
                target_user: 'user-123',
                mint_amount: 100,
                mint_source: 'SESSION_REWARD',
                mint_metadata: {}
            });

            expect(result.status).toBe('ATOMIC_SUCCESS');
            expect(result.data.amount).toBe(100);
            expect(result.data.balance_after).toBe(100);
        });

        test('✅ Returns ATOMIC_FAILED on RPC error', async () => {
            const supabase = createMockSupabase({
                fn_mint_diamonds_secure: {
                    error: { message: 'Connection failed' }
                }
            });

            const economy = createEconomyFix(supabase);
            const result = await economy.mintDiamondsAtomic('user-123', 100);

            expect(result.status).toBe('ATOMIC_FAILED');
            expect(result.error).toBeDefined();
        });

        test('✅ Passes custom source and metadata', async () => {
            const mockResponse = {
                success: true,
                status: 'ATOMIC_SUCCESS',
                data: { amount: 50 }
            };

            const supabase = createMockSupabase({
                fn_mint_diamonds_secure: { data: mockResponse }
            });

            const economy = createEconomyFix(supabase);
            await economy.mintDiamondsAtomic('user-123', 50, {
                source: 'DAILY_CLAIM',
                metadata: { streak_day: 7 }
            });

            expect(supabase.rpc).toHaveBeenCalledWith('fn_mint_diamonds_secure', {
                target_user: 'user-123',
                mint_amount: 50,
                mint_source: 'DAILY_CLAIM',
                mint_metadata: { streak_day: 7 }
            });
        });
    });

    describe('burnDiamondsAtomic()', () => {

        test('✅ Calls fn_burn_diamonds_secure with correct params', async () => {
            const mockResponse = {
                success: true,
                status: 'ATOMIC_SUCCESS',
                data: {
                    amount: 25,
                    balance_before: 100,
                    balance_after: 75
                }
            };

            const supabase = createMockSupabase({
                fn_burn_diamonds_secure: { data: mockResponse }
            });

            const economy = createEconomyFix(supabase);
            const result = await economy.burnDiamondsAtomic('user-123', 25);

            expect(supabase.rpc).toHaveBeenCalledWith('fn_burn_diamonds_secure', {
                target_user: 'user-123',
                burn_amount: 25,
                burn_source: 'ARCADE_STAKE',
                burn_metadata: {}
            });

            expect(result.status).toBe('ATOMIC_SUCCESS');
            expect(result.data.balance_after).toBe(75);
        });

        test('✅ Returns ATOMIC_FAILED on insufficient funds', async () => {
            const mockResponse = {
                success: false,
                status: 'ATOMIC_FAILED',
                error: 'INSUFFICIENT_FUNDS',
                data: {
                    current_balance: 10,
                    required: 50,
                    shortfall: 40
                }
            };

            const supabase = createMockSupabase({
                fn_burn_diamonds_secure: { data: mockResponse }
            });

            const economy = createEconomyFix(supabase);
            const result = await economy.burnDiamondsAtomic('user-123', 50);

            expect(result.status).toBe('ATOMIC_FAILED');
            expect(result.error).toBe('INSUFFICIENT_FUNDS');
        });
    });

    describe('getBalanceFast()', () => {

        test('✅ Returns balance from fn_get_balance_fast', async () => {
            const mockResponse = {
                success: true,
                balance: 500,
                streak: 7,
                exists: true
            };

            const supabase = createMockSupabase({
                fn_get_balance_fast: { data: mockResponse }
            });

            const economy = createEconomyFix(supabase);
            const result = await economy.getBalanceFast('user-123');

            expect(result.balance).toBe(500);
            expect(result.streak).toBe(7);
            expect(result.exists).toBe(true);
        });

        test('✅ Returns zero balance for non-existent wallet', async () => {
            const mockResponse = {
                success: true,
                balance: 0,
                streak: 0,
                exists: false
            };

            const supabase = createMockSupabase({
                fn_get_balance_fast: { data: mockResponse }
            });

            const economy = createEconomyFix(supabase);
            const result = await economy.getBalanceFast('new-user');

            expect(result.balance).toBe(0);
            expect(result.exists).toBe(false);
        });
    });

    describe('createArcadeSession()', () => {

        test('✅ Creates session controller with stake/payout methods', () => {
            const supabase = createMockSupabase({});
            const economy = createEconomyFix(supabase);

            const session = economy.createArcadeSession('user-123', 25, 'SKILL_TRIAL');

            expect(typeof session.stake).toBe('function');
            expect(typeof session.payout).toBe('function');
            expect(typeof session.getState).toBe('function');
        });

        test('✅ Initial state is PENDING', () => {
            const supabase = createMockSupabase({});
            const economy = createEconomyFix(supabase);

            const session = economy.createArcadeSession('user-123', 25, 'SKILL_TRIAL');
            const state = session.getState();

            expect(state.sessionState).toBe('PENDING');
            expect(state.stakeResult).toBeNull();
        });
    });
});

// ═══════════════════════════════════════════════════════════
// 📋 TEST SUMMARY
// ═══════════════════════════════════════════════════════════

console.log(`
╔════════════════════════════════════════════════════════════╗
║     ⚡ ECONOMY FIX — TEST SUITE LOADED                     ║
║     Execute: npm test                                       ║
╚════════════════════════════════════════════════════════════╝
`);
