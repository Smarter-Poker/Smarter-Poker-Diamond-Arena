/**
 * 👑 YELLOW FINAL SEAL ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for YELLOW_FINAL_SOVEREIGN_SEAL (TASKS 25-30)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { YellowFinalSealEngine, FINAL_SEAL_CONFIG } from '../engines/YellowFinalSealEngine.js';
import { jest } from '@jest/globals';

describe('👑 YellowFinalSealEngine (Tasks 25-30)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new YellowFinalSealEngine(null))
                .toThrow('FINAL_SEAL_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowFinalSealEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔐 TASK 25: BURN PROTOCOL SEAL
    // ═══════════════════════════════════════════════════════

    describe('Task 25: 25_PERCENT_BURN_PROTOCOL_SEAL', () => {

        test('✅ HARD LAW: Burn rate is 0.25 (25%)', () => {
            expect(FINAL_SEAL_CONFIG.BURN_PROTOCOL.RATE).toBe(0.25);
        });

        test('✅ IMMUTABLE: Protocol is sealed', () => {
            expect(FINAL_SEAL_CONFIG.BURN_PROTOCOL.SEALED).toBe(true);
        });

        test('✅ IMMUTABLE: Protocol marked immutable', () => {
            expect(FINAL_SEAL_CONFIG.BURN_PROTOCOL.IMMUTABLE).toBe(true);
        });

        test('✅ getBurnRate always returns 0.25', () => {
            expect(YellowFinalSealEngine.getBurnRate()).toBe(0.25);
        });

        test('✅ verifyBurnProtocolSeal calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        protocol: '25_PERCENT_BURN_PROTOCOL',
                        status: 'LOCKED_PRODUCTION',
                        is_locked: true
                    },
                    error: null
                })
            };

            const engine = new YellowFinalSealEngine(mockSupabase);
            const result = await engine.verifyBurnProtocolSeal();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_verify_burn_protocol_seal');
            expect(result.is_locked).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📊 TASK 26: ATOMIC LEDGER RECONCILIATION
    // ═══════════════════════════════════════════════════════

    describe('Task 26: ATOMIC_LEDGER_RECONCILIATION', () => {

        test('✅ Trigger threshold is 100 transactions', () => {
            expect(FINAL_SEAL_CONFIG.RECONCILIATION.TRIGGER_THRESHOLD).toBe(100);
        });

        test('✅ Auto-reconciliation is enabled', () => {
            expect(FINAL_SEAL_CONFIG.RECONCILIATION.AUTO_ENABLED).toBe(true);
        });

        test('✅ runFinalAudit calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        all_passed: true,
                        final_audit: {}
                    },
                    error: null
                })
            };

            const engine = new YellowFinalSealEngine(mockSupabase);
            const result = await engine.runFinalAudit();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_final_audit_reconciliation');
            expect(result.all_passed).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 27: STREAK MULTIPLIER BATTLE HOOK
    // ═══════════════════════════════════════════════════════

    describe('Task 27: STREAK_MULTIPLIER_BATTLE_HOOK', () => {

        test('✅ Mastery threshold is 0.85 (85%)', () => {
            expect(FINAL_SEAL_CONFIG.BATTLE_HOOKS.MASTERY_THRESHOLD).toBe(0.85);
        });

        test('✅ LEGENDARY requires 30 days for 2.0x', () => {
            const legendary = FINAL_SEAL_CONFIG.BATTLE_HOOKS.MULTIPLIERS.LEGENDARY;
            expect(legendary.days).toBe(30);
            expect(legendary.value).toBe(2.00);
        });

        test('✅ calculateBattleHookReward: 30 days = LEGENDARY 2.0x', () => {
            const result = YellowFinalSealEngine.calculateBattleHookReward(100, 30);
            expect(result.tier).toBe('LEGENDARY');
            expect(result.multiplier).toBe(2.00);
            expect(result.final).toBe(200);
        });

        test('✅ calculateBattleHookReward: 7 days = HOT 1.5x', () => {
            const result = YellowFinalSealEngine.calculateBattleHookReward(100, 7);
            expect(result.tier).toBe('HOT');
            expect(result.multiplier).toBe(1.50);
            expect(result.final).toBe(150);
        });

        test('✅ calculateBattleHookReward: 0 days = COLD 1.0x', () => {
            const result = YellowFinalSealEngine.calculateBattleHookReward(100, 0);
            expect(result.tier).toBe('COLD');
            expect(result.multiplier).toBe(1.00);
            expect(result.final).toBe(100);
        });

        test('✅ executeStreakBattleHook fails below 85% accuracy', async () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new YellowFinalSealEngine(mockSupabase);

            const result = await engine.executeStreakBattleHook({
                userId: 'user-123',
                greenSignal: 'TRAINING',
                baseReward: 100,
                accuracy: 0.70
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('MASTERY_GATE_FAILED');
        });

        test('✅ executeStreakBattleHook calls RPC for valid accuracy', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        hook_id: 'hook-123',
                        reward: { final: 150 }
                    },
                    error: null
                })
            };

            const engine = new YellowFinalSealEngine(mockSupabase);
            const result = await engine.executeStreakBattleHook({
                userId: 'user-123',
                greenSignal: 'TRAINING',
                baseReward: 100,
                accuracy: 0.90
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_execute_streak_battle_hook', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🏪 TASK 28: MARKETPLACE VAULT
    // ═══════════════════════════════════════════════════════

    describe('Task 28: MARKETPLACE_VAULT_INIT', () => {

        test('✅ Marketplace burn rate is 0.25 (25%)', () => {
            expect(FINAL_SEAL_CONFIG.MARKETPLACE.BURN_RATE).toBe(0.25);
        });

        test('✅ Seller rate is 0.75 (75%)', () => {
            expect(FINAL_SEAL_CONFIG.MARKETPLACE.SELLER_RATE).toBe(0.75);
        });

        test('✅ marketplacePurchase calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        purchase_id: 'purchase-123',
                        transaction: { burn_amount: 25 }
                    },
                    error: null
                })
            };

            const engine = new YellowFinalSealEngine(mockSupabase);
            const result = await engine.marketplacePurchase('item-123', 'buyer-456');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_marketplace_purchase', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📊 TASK 29: DEFLATION TICKER
    // ═══════════════════════════════════════════════════════

    describe('Task 29: ECONOMY_DEFLATION_TICKER', () => {

        test('✅ Refresh interval is 60000ms (1 minute)', () => {
            expect(FINAL_SEAL_CONFIG.DEFLATION.REFRESH_INTERVAL_MS).toBe(60000);
        });

        test('✅ getDeflationTicker calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        ticker: { total_burned: 50000 },
                        deflation: { rate: '5.2%' }
                    },
                    error: null
                })
            };

            const engine = new YellowFinalSealEngine(mockSupabase);
            const result = await engine.getDeflationTicker();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_deflation_ticker');
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 👑 TASK 30: SOVEREIGN SEAL
    // ═══════════════════════════════════════════════════════

    describe('Task 30: SOVEREIGN_SEAL', () => {

        test('✅ Silo name is YELLOW_DIAMOND_ECONOMY', () => {
            expect(FINAL_SEAL_CONFIG.SOVEREIGN.SILO_NAME).toBe('YELLOW_DIAMOND_ECONOMY');
        });

        test('✅ Total tasks is 30', () => {
            expect(FINAL_SEAL_CONFIG.SOVEREIGN.TOTAL_TASKS).toBe(30);
        });

        test('✅ Status is LOCKED_PRODUCTION', () => {
            expect(FINAL_SEAL_CONFIG.SOVEREIGN.STATUS).toBe('LOCKED_PRODUCTION');
        });

        test('✅ getSovereignSealStatus calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        sovereign_seal: {
                            silo: 'YELLOW_DIAMOND_ECONOMY',
                            status: 'LOCKED_PRODUCTION',
                            production_locked: true
                        }
                    },
                    error: null
                })
            };

            const engine = new YellowFinalSealEngine(mockSupabase);
            const result = await engine.getSovereignSealStatus();

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_sovereign_seal_status');
            expect(result.sovereign_seal.production_locked).toBe(true);
        });

        test('✅ isProductionLocked returns true when locked', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        sovereign_seal: { production_locked: true }
                    },
                    error: null
                })
            };

            const engine = new YellowFinalSealEngine(mockSupabase);
            const result = await engine.isProductionLocked();

            expect(result).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔍 FULL VERIFICATION
    // ═══════════════════════════════════════════════════════

    describe('Full System Verification', () => {

        test('✅ runFullVerification returns combined status', async () => {
            const mockSupabase = {
                rpc: jest.fn()
                    .mockResolvedValueOnce({ data: { is_locked: true }, error: null })
                    .mockResolvedValueOnce({ data: { all_passed: true }, error: null })
                    .mockResolvedValueOnce({ data: { sovereign_seal: { production_locked: true } }, error: null })
                    .mockResolvedValueOnce({ data: { success: true }, error: null })
            };

            const engine = new YellowFinalSealEngine(mockSupabase);
            const result = await engine.runFullVerification();

            expect(result.success).toBe(true);
            expect(result.all_passed).toBe(true);
            expect(result.status).toBe('LOCKED_PRODUCTION');
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     👑 YELLOW FINAL SEAL — TEST SUITE LOADED              ║
║     MILITARY_PAYLOAD: YELLOW_FINAL_SOVEREIGN_SEAL (25-30) ║
╚════════════════════════════════════════════════════════════╝
`);
