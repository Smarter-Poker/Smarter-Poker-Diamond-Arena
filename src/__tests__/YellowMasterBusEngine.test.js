/**
 * 🚌 YELLOW MASTER BUS ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for YELLOW_MASTER_BUS (TASKS 10-12)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { YellowMasterBusEngine, MASTER_BUS_CONFIG } from '../engines/YellowMasterBusEngine.js';
import { jest } from '@jest/globals';

describe('🚌 YellowMasterBusEngine (Tasks 10-12)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new YellowMasterBusEngine(null))
                .toThrow('MASTER_BUS_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowMasterBusEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 10: 25% BURN MIGRATION
    // ═══════════════════════════════════════════════════════

    describe('Task 10: THE 25_PERCENT_BURN_MIGRATION', () => {

        test('✅ HARD LAW: Burn rate is 25%', () => {
            expect(MASTER_BUS_CONFIG.BURN.RATE).toBe(0.25);
        });

        test('✅ HARD LAW: Seller rate is 75%', () => {
            expect(MASTER_BUS_CONFIG.BURN.SELLER_RATE).toBe(0.75);
        });

        test('✅ Burn vault user is defined', () => {
            expect(MASTER_BUS_CONFIG.BURN.VAULT_USER).toBe('00000000-0000-0000-0000-000000000000');
        });

        test('✅ calculateBurnSplit: 100 diamonds = 25 burn, 75 seller', () => {
            const result = YellowMasterBusEngine.calculateBurnSplit(100);

            expect(result.saleAmount).toBe(100);
            expect(result.burnAmount).toBe(25);
            expect(result.sellerReceives).toBe(75);
            expect(result.hardLaw).toBe('25_PERCENT_BURN_MIGRATION');
        });

        test('✅ calculateBurnSplit: 40 diamonds = 10 burn, 30 seller', () => {
            const result = YellowMasterBusEngine.calculateBurnSplit(40);

            expect(result.burnAmount).toBe(10);
            expect(result.sellerReceives).toBe(30);
        });

        test('✅ Minimum 1 diamond burn for sales >= 4', () => {
            const result = YellowMasterBusEngine.calculateBurnSplit(4);

            expect(result.burnAmount).toBe(1);
            expect(result.sellerReceives).toBe(3);
        });

        test('✅ executeMarketplaceBurn calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        status: 'BURN_EXECUTED',
                        transaction: { burn_amount: 25 }
                    },
                    error: null
                })
            };

            const engine = new YellowMasterBusEngine(mockSupabase);
            const result = await engine.executeMarketplaceBurn({
                sellerId: 'seller-123',
                buyerId: 'buyer-456',
                saleAmount: 100
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_execute_marketplace_burn', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🛡️ TASK 11: ATOMIC LEDGER SECURITY SHIELD
    // ═══════════════════════════════════════════════════════

    describe('Task 11: ATOMIC_LEDGER_SECURITY_SHIELD', () => {

        test('✅ Integrity check is enabled by default', () => {
            expect(MASTER_BUS_CONFIG.SECURITY.INTEGRITY_CHECK_ENABLED).toBe(true);
        });

        test('✅ Variance tolerance is 0 (HARD LAW)', () => {
            expect(MASTER_BUS_CONFIG.SECURITY.VARIANCE_TOLERANCE).toBe(0);
        });

        test('✅ verifyWalletIntegrity calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        verified: true,
                        status: 'INTEGRITY_VALID',
                        wallet: { current_balance: 100 },
                        ledger: { calculated_balance: 100 }
                    },
                    error: null
                })
            };

            const engine = new YellowMasterBusEngine(mockSupabase);
            const result = await engine.verifyWalletIntegrity('user-123');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('rpc_verify_wallet_integrity', {
                p_user_id: 'user-123'
            });
            expect(result.verified).toBe(true);
            expect(result.status).toBe('INTEGRITY_VALID');
        });

        test('✅ Integrity violation detected correctly', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        verified: false,
                        status: 'INTEGRITY_VIOLATION',
                        wallet: { current_balance: 110 },
                        ledger: { calculated_balance: 100 },
                        variance: { amount: 10, direction: 'WALLET_OVER' }
                    },
                    error: null
                })
            };

            const engine = new YellowMasterBusEngine(mockSupabase);
            const result = await engine.verifyWalletIntegrity('user-123');

            expect(result.verified).toBe(false);
            expect(result.status).toBe('INTEGRITY_VIOLATION');
        });

        test('✅ verifyBatchIntegrity processes multiple users', async () => {
            const mockSupabase = {
                rpc: jest.fn()
                    .mockResolvedValueOnce({ data: { verified: true, status: 'INTEGRITY_VALID' }, error: null })
                    .mockResolvedValueOnce({ data: { verified: true, status: 'INTEGRITY_VALID' }, error: null })
                    .mockResolvedValueOnce({ data: { verified: false, status: 'INTEGRITY_VIOLATION' }, error: null })
            };

            const engine = new YellowMasterBusEngine(mockSupabase);
            const result = await engine.verifyBatchIntegrity(['user-1', 'user-2', 'user-3']);

            expect(result.summary.total).toBe(3);
            expect(result.summary.valid).toBe(2);
            expect(result.summary.invalid).toBe(1);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔄 TASK 12: STREAK MULTIPLIER DYNAMIC SYNC
    // ═══════════════════════════════════════════════════════

    describe('Task 12: STREAK_MULTIPLIER_DYNAMIC_SYNC', () => {

        test('✅ HARD LAW: 3-Day multiplier is 1.20', () => {
            expect(MASTER_BUS_CONFIG.STREAK_SYNC.MULTIPLIERS.DAY_3).toBe(1.20);
        });

        test('✅ HARD LAW: 7-Day multiplier is 1.50', () => {
            expect(MASTER_BUS_CONFIG.STREAK_SYNC.MULTIPLIERS.DAY_7).toBe(1.50);
        });

        test('✅ HARD LAW: 30-Day multiplier is 2.00', () => {
            expect(MASTER_BUS_CONFIG.STREAK_SYNC.MULTIPLIERS.DAY_30).toBe(2.00);
        });

        test('✅ Primary source is RED (profiles)', () => {
            expect(MASTER_BUS_CONFIG.STREAK_SYNC.PRIMARY_SOURCE).toBe('profiles');
        });

        test('✅ getMultiplierForStreak: Day 0 = COLD, 1.0x', () => {
            const result = YellowMasterBusEngine.getMultiplierForStreak(0);
            expect(result.tier).toBe('COLD');
            expect(result.multiplier).toBe(1.00);
        });

        test('✅ getMultiplierForStreak: Day 3 = WARMING, 1.2x', () => {
            const result = YellowMasterBusEngine.getMultiplierForStreak(3);
            expect(result.tier).toBe('WARMING');
            expect(result.multiplier).toBe(1.20);
        });

        test('✅ getMultiplierForStreak: Day 7 = HOT, 1.5x', () => {
            const result = YellowMasterBusEngine.getMultiplierForStreak(7);
            expect(result.tier).toBe('HOT');
            expect(result.multiplier).toBe(1.50);
        });

        test('✅ getMultiplierForStreak: Day 30 = LEGENDARY, 2.0x', () => {
            const result = YellowMasterBusEngine.getMultiplierForStreak(30);
            expect(result.tier).toBe('LEGENDARY');
            expect(result.multiplier).toBe(2.00);
        });

        test('✅ previewGreenSignal: Below 85% not eligible', () => {
            const result = YellowMasterBusEngine.previewGreenSignal(10, 7, 0.80);
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('MASTERY_GATE_FAILED');
        });

        test('✅ previewGreenSignal: 85% with streak applies multiplier', () => {
            const result = YellowMasterBusEngine.previewGreenSignal(10, 7, 0.90);
            expect(result.eligible).toBe(true);
            expect(result.multiplier).toBe(1.50);
            expect(result.finalReward).toBe(15);
            expect(result.streakBonus).toBe(5);
        });

        test('✅ syncStreakFromRed calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        sync: { source_silo: 'RED', streak_days: 7 },
                        multiplier: { tier: 'HOT', value: 1.50 },
                        reward: { base_reward: 10, final_reward: 15 }
                    },
                    error: null
                })
            };

            const engine = new YellowMasterBusEngine(mockSupabase);
            const result = await engine.syncStreakFromRed('user-123', 10);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_sync_streak_from_red', {
                p_user_id: 'user-123',
                p_base_reward: 10,
                p_green_signal: 'TRAINING_REWARD'
            });
            expect(result.sync.source_silo).toBe('RED');
        });

        test('✅ processGreenRewardSignal fails locally for low accuracy', async () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowMasterBusEngine(mockSupabase);

            const result = await engine.processGreenRewardSignal('user-123', 10, 0.70);

            expect(mockSupabase.rpc).not.toHaveBeenCalled();
            expect(result.success).toBe(false);
            expect(result.error).toBe('MASTERY_GATE_FAILED');
        });

        test('✅ processGreenRewardSignal calls RPC on valid accuracy', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        status: 'GREEN_SIGNAL_PROCESSED',
                        reward: { final_reward: 15 }
                    },
                    error: null
                })
            };

            const engine = new YellowMasterBusEngine(mockSupabase);
            const result = await engine.processGreenRewardSignal('user-123', 10, 0.90);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_process_green_reward_signal', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // ⚙️ CONFIGURATION VALIDATION
    // ═══════════════════════════════════════════════════════

    describe('Configuration Validation', () => {

        test('✅ GREEN signals list is defined', () => {
            const signals = MASTER_BUS_CONFIG.STREAK_SYNC.GREEN_SIGNALS;
            expect(signals).toContain('TRAINING_REWARD');
            expect(signals).toContain('SESSION_REWARD');
            expect(signals.length).toBeGreaterThanOrEqual(4);
        });

        test('✅ Burn + Seller rates sum to 100%', () => {
            const sum = MASTER_BUS_CONFIG.BURN.RATE + MASTER_BUS_CONFIG.BURN.SELLER_RATE;
            expect(sum).toBe(1.00);
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🚌 YELLOW MASTER BUS ENGINE — TEST SUITE LOADED       ║
║     MILITARY_PAYLOAD: YELLOW_MASTER_BUS (10-12)           ║
╚════════════════════════════════════════════════════════════╝
`);
