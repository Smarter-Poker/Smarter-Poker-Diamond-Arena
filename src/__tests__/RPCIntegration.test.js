/**
 * 🧪 RPC INTEGRATION — TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for Postgres RPC function interfaces.
 * These require a connected Supabase instance.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { jest } from '@jest/globals';
import { WalletService, TX_SOURCES } from '../services/WalletService.js';
import { StreakService, STREAK_CONFIG } from '../services/StreakService.js';

// ═══════════════════════════════════════════════════════════
// 🔌 MOCK SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════

const createMockSupabase = (rpcResponses = {}) => {
    const mockRpc = jest.fn((functionName, params) => {
        const response = rpcResponses[functionName];
        if (response?.error) {
            return Promise.resolve({ data: null, error: response.error });
        }
        return Promise.resolve({ data: response?.data || {}, error: null });
    });

    return {
        rpc: mockRpc,
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
            single: jest.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }))
        }))
    };
};

// ═══════════════════════════════════════════════════════════
// 💰 WALLET SERVICE RPC TESTS
// ═══════════════════════════════════════════════════════════

describe('💰 WalletService (RPC-Powered)', () => {

    describe('credit() via fn_mint_diamonds_atomic', () => {

        test('✅ Calls RPC with correct parameters', async () => {
            const mockResponse = {
                success: true,
                amount: 100,
                balance_before: 0,
                balance_after: 100,
                wallet_id: 'wallet-123',
                transaction_id: 'tx-456',
                wallet_created: true
            };

            const supabase = createMockSupabase({
                fn_mint_diamonds_atomic: { data: mockResponse }
            });

            const service = new WalletService(supabase);
            const result = await service.credit(
                'user-123',
                100,
                TX_SOURCES.SESSION_REWARD,
                { referenceId: 'session-789', metadata: { test: true } }
            );

            expect(supabase.rpc).toHaveBeenCalledWith('fn_mint_diamonds_atomic', {
                p_user_id: 'user-123',
                p_amount: 100,
                p_source: 'SESSION_REWARD',
                p_reference_id: 'session-789',
                p_reference_type: null,
                p_metadata: { test: true }
            });

            expect(result.success).toBe(true);
            expect(result.balanceAfter).toBe(100);
            expect(result.walletCreated).toBe(true);
        });

        test('✅ Handles RPC failure gracefully', async () => {
            const mockResponse = {
                success: false,
                error: 'INVALID_AMOUNT',
                message: 'Amount must be positive'
            };

            const supabase = createMockSupabase({
                fn_mint_diamonds_atomic: { data: mockResponse }
            });

            const service = new WalletService(supabase);
            const result = await service.credit('user-123', -10, TX_SOURCES.BONUS);

            expect(result.success).toBe(false);
            expect(result.error).toBe('INVALID_AMOUNT');
        });
    });

    describe('debit() via fn_burn_diamonds_atomic', () => {

        test('✅ Returns insufficient funds error from RPC', async () => {
            const mockResponse = {
                success: false,
                error: 'INSUFFICIENT_FUNDS',
                message: 'Balance 50 is less than 100',
                current_balance: 50,
                required_amount: 100,
                shortfall: 50
            };

            const supabase = createMockSupabase({
                fn_burn_diamonds_atomic: { data: mockResponse }
            });

            const service = new WalletService(supabase);
            const result = await service.debit('user-123', 100, TX_SOURCES.ARCADE_STAKE);

            expect(result.success).toBe(false);
            expect(result.error).toBe('INSUFFICIENT_FUNDS');
            expect(result.shortfall).toBe(50);
        });
    });

    describe('transfer() via fn_transfer_diamonds_atomic', () => {

        test('✅ Executes atomic transfer via RPC', async () => {
            const mockResponse = {
                success: true,
                amount: 50,
                from_user: 'user-A',
                to_user: 'user-B',
                debit_transaction: 'tx-1',
                credit_transaction: 'tx-2',
                sender_balance: 150,
                recipient_balance: 50
            };

            const supabase = createMockSupabase({
                fn_transfer_diamonds_atomic: { data: mockResponse }
            });

            const service = new WalletService(supabase);
            const result = await service.transfer('user-A', 'user-B', 50);

            expect(supabase.rpc).toHaveBeenCalledWith('fn_transfer_diamonds_atomic', {
                p_from_user_id: 'user-A',
                p_to_user_id: 'user-B',
                p_amount: 50,
                p_metadata: {}
            });

            expect(result.success).toBe(true);
            expect(result.senderBalance).toBe(150);
            expect(result.recipientBalance).toBe(50);
        });
    });

    describe('Arcade integration methods', () => {

        test('✅ stakeForArcade calls debit with correct source', async () => {
            const mockResponse = { success: true, amount: 25, balance_after: 75 };

            const supabase = createMockSupabase({
                fn_burn_diamonds_atomic: { data: mockResponse }
            });

            const service = new WalletService(supabase);
            await service.stakeForArcade('user-123', 25, 'SKILL_TRIAL', 'session-xyz');

            expect(supabase.rpc).toHaveBeenCalledWith('fn_burn_diamonds_atomic',
                expect.objectContaining({
                    p_source: 'ARCADE_STAKE',
                    p_reference_type: 'ARCADE_SESSION'
                })
            );
        });

        test('✅ payoutArcadeWin calls credit with correct source', async () => {
            const mockResponse = { success: true, amount: 50, balance_after: 150 };

            const supabase = createMockSupabase({
                fn_mint_diamonds_atomic: { data: mockResponse }
            });

            const service = new WalletService(supabase);
            await service.payoutArcadeWin('user-123', 50, 'session-xyz', { score: 95 });

            expect(supabase.rpc).toHaveBeenCalledWith('fn_mint_diamonds_atomic',
                expect.objectContaining({
                    p_source: 'ARCADE_WIN',
                    p_reference_type: 'ARCADE_SESSION'
                })
            );
        });
    });
});

// ═══════════════════════════════════════════════════════════
// 🔥 STREAK SERVICE RPC TESTS
// ═══════════════════════════════════════════════════════════

describe('🔥 StreakService (RPC-Powered)', () => {

    describe('getStreakStatus() via fn_get_streak_status', () => {

        test('✅ Returns formatted streak status from RPC', async () => {
            const mockResponse = {
                user_id: 'user-123',
                current_streak: 7,
                longest_streak: 14,
                last_claim: '2026-01-09T12:00:00Z',
                hours_since_claim: 24,
                hours_until_expiry: 24,
                hours_until_eligible: 0,
                status: 'ACTIVE',
                can_claim: true,
                tier: '🔥🔥 Hot',
                multiplier: 1.50,
                balance: 500
            };

            const supabase = createMockSupabase({
                fn_get_streak_status: { data: mockResponse }
            });

            const service = new StreakService(supabase);
            const result = await service.getStreakStatus('user-123');

            expect(supabase.rpc).toHaveBeenCalledWith('fn_get_streak_status', {
                p_user_id: 'user-123'
            });

            expect(result.currentStreak).toBe(7);
            expect(result.canClaim).toBe(true);
            expect(result.tier.label).toBe('🔥🔥 Hot');
            expect(result.tier.multiplier).toBe(1.50);
        });
    });

    describe('claimDailyReward() via fn_claim_daily_reward', () => {

        test('✅ Processes successful claim from RPC', async () => {
            const mockResponse = {
                success: true,
                claim: {
                    total_diamonds: 12,
                    base_reward: 5,
                    streak_bonus: 2,
                    comeback_bonus: 0,
                    milestone_bonus: null
                },
                streak: {
                    previous: 6,
                    current: 7,
                    longest: 14,
                    continued: true,
                    tier: '🔥🔥 Hot',
                    multiplier: 1.50
                },
                wallet: {
                    new_balance: 512,
                    transaction_id: 'tx-abc'
                }
            };

            const supabase = createMockSupabase({
                fn_claim_daily_reward: { data: mockResponse }
            });

            const service = new StreakService(supabase);
            const result = await service.claimDailyReward('user-123');

            expect(supabase.rpc).toHaveBeenCalledWith('fn_claim_daily_reward', {
                p_user_id: 'user-123',
                p_base_reward: STREAK_CONFIG.BASE_DAILY_REWARD,
                p_comeback_bonus: STREAK_CONFIG.COMEBACK_BONUS
            });

            expect(result.success).toBe(true);
            expect(result.claim.totalDiamonds).toBe(12);
            expect(result.streak.newStreak).toBe(7);
            expect(result.streak.continued).toBe(true);
        });

        test('✅ Returns error when claim too soon', async () => {
            const mockResponse = {
                success: false,
                error: 'TOO_SOON',
                message: 'Please wait 8 more hours',
                hours_until_eligible: 8,
                current_streak: 5,
                balance: 200
            };

            const supabase = createMockSupabase({
                fn_claim_daily_reward: { data: mockResponse }
            });

            const service = new StreakService(supabase);
            const result = await service.claimDailyReward('user-123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('TOO_SOON');
            expect(result.hoursUntilEligible).toBe(8);
        });

        test('✅ Includes milestone bonus when hit', async () => {
            const mockResponse = {
                success: true,
                claim: {
                    total_diamonds: 30,
                    base_reward: 5,
                    streak_bonus: 5,
                    comeback_bonus: 0,
                    milestone_bonus: { day: 7, multiplier: 2.0, tier: 'WEEK' }
                },
                streak: {
                    previous: 6,
                    current: 7,
                    longest: 7,
                    continued: true,
                    tier: '🔥🔥 Hot',
                    multiplier: 1.50
                },
                wallet: {
                    new_balance: 230,
                    transaction_id: 'tx-milestone'
                }
            };

            const supabase = createMockSupabase({
                fn_claim_daily_reward: { data: mockResponse }
            });

            const service = new StreakService(supabase);
            const result = await service.claimDailyReward('user-123');

            expect(result.claim.milestoneBonus).not.toBeNull();
            expect(result.claim.milestoneBonus.multiplier).toBe(2.0);
            expect(result.claim.milestoneBonus.tier).toBe('WEEK');
        });
    });
});

// ═══════════════════════════════════════════════════════════
// 📋 TEST SUMMARY
// ═══════════════════════════════════════════════════════════

console.log(`
╔════════════════════════════════════════════════════════════╗
║     💎 RPC INTEGRATION — TEST SUITE LOADED                ║
║     Execute: npm test                                       ║
╚════════════════════════════════════════════════════════════╝
`);
