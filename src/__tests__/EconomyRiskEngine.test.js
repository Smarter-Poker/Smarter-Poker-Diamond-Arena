/**
 * 💱 ECONOMY & RISK ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for ECONOMY & RISK (TASKS 51-54)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { EconomyRiskEngine, ECONOMY_RISK_CONFIG } from '../engines/EconomyRiskEngine.js';
import { jest } from '@jest/globals';

describe('💱 EconomyRiskEngine (Tasks 51-54)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new EconomyRiskEngine(null))
                .toThrow('ECONOMY_RISK_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new EconomyRiskEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // ⚙️ CONFIGURATION
    // ═══════════════════════════════════════════════════════

    describe('Configuration', () => {

        test('✅ RNG is provably fair', () => {
            expect(ECONOMY_RISK_CONFIG.RNG.PROVABLY_FAIR).toBe(true);
            expect(ECONOMY_RISK_CONFIG.RNG.ALGORITHM).toBe('SHA-256');
        });

        test('✅ Rakeback has 5 tiers', () => {
            expect(ECONOMY_RISK_CONFIG.RAKEBACK_TIERS).toHaveLength(5);
        });

        test('✅ LEGENDARY_RAKEBACK is 5% at 30 days', () => {
            const legendary = ECONOMY_RISK_CONFIG.RAKEBACK_TIERS.find(t => t.name === 'LEGENDARY_RAKEBACK');
            expect(legendary.minStreak).toBe(30);
            expect(legendary.percent).toBe(5.00);
        });

        test('✅ XP to Diamond rate is 0.01 (100 XP = 1 Diamond)', () => {
            expect(ECONOMY_RISK_CONFIG.SWAP_RATES.XP_TO_DIAMOND.rate).toBe(0.01);
        });

        test('✅ Burn transparency is public and anonymized', () => {
            expect(ECONOMY_RISK_CONFIG.BURN_TRANSPARENCY.PUBLIC).toBe(true);
            expect(ECONOMY_RISK_CONFIG.BURN_TRANSPARENCY.ANONYMIZED).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🎲 TASK 51: ARCADE RNG ORACLE
    // ═══════════════════════════════════════════════════════

    describe('Task 51: ARCADE_RNG_ORACLE', () => {

        test('✅ generateServerSeed creates valid seed and hash', () => {
            const result = EconomyRiskEngine.generateServerSeed();
            expect(result.serverSeed).toHaveLength(64);  // 32 bytes hex
            expect(result.serverSeedHash).toHaveLength(64);  // SHA-256 hex
            expect(result.serverSeed).not.toBe(result.serverSeedHash);
        });

        test('✅ generateRngLocal produces deterministic results', () => {
            const result1 = EconomyRiskEngine.generateRngLocal('server123', 'client456', 0);
            const result2 = EconomyRiskEngine.generateRngLocal('server123', 'client456', 0);

            expect(result1.rollValue).toBe(result2.rollValue);
            expect(result1.finalHash).toBe(result2.finalHash);
        });

        test('✅ Different nonce produces different roll', () => {
            const result1 = EconomyRiskEngine.generateRngLocal('server123', 'client456', 0);
            const result2 = EconomyRiskEngine.generateRngLocal('server123', 'client456', 1);

            expect(result1.rollValue).not.toBe(result2.rollValue);
        });

        test('✅ Roll value is between 0 and 1', () => {
            for (let i = 0; i < 10; i++) {
                const { serverSeed } = EconomyRiskEngine.generateServerSeed();
                const result = EconomyRiskEngine.generateRngLocal(serverSeed, 'test', i);
                expect(result.rollValue).toBeGreaterThanOrEqual(0);
                expect(result.rollValue).toBeLessThan(1);
            }
        });

        test('✅ generateRngSeed calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, seed_id: 'seed-123', roll: { value: 0.5 } },
                    error: null
                })
            };

            const engine = new EconomyRiskEngine(mockSupabase);
            const result = await engine.generateRngSeed({
                sessionId: 'session-123',
                gameMode: 'SURVIVAL',
                userId: 'user-123'
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_generate_rng_seed', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 💰 TASK 52: DIAMOND ARENA RAKEBACK
    // ═══════════════════════════════════════════════════════

    describe('Task 52: DIAMOND_ARENA_RAKEBACK', () => {

        test('✅ calculateRakebackLocal: 0 streak = 0% rakeback', () => {
            const result = EconomyRiskEngine.calculateRakebackLocal(100, 0);
            expect(result.percent).toBe(0);
            expect(result.rakebackAmount).toBe(0);
            expect(result.eligible).toBe(false);
        });

        test('✅ calculateRakebackLocal: 7 days = 1% BRONZE', () => {
            const result = EconomyRiskEngine.calculateRakebackLocal(100, 7);
            expect(result.tier).toBe('BRONZE_RAKEBACK');
            expect(result.percent).toBe(1.00);
            expect(result.rakebackAmount).toBe(1);
        });

        test('✅ calculateRakebackLocal: 14 days = 2.5% SILVER', () => {
            const result = EconomyRiskEngine.calculateRakebackLocal(1000, 14);
            expect(result.tier).toBe('SILVER_RAKEBACK');
            expect(result.percent).toBe(2.50);
            expect(result.rakebackAmount).toBe(25);
        });

        test('✅ calculateRakebackLocal: 30 days = 5% LEGENDARY', () => {
            const result = EconomyRiskEngine.calculateRakebackLocal(1000, 30);
            expect(result.tier).toBe('LEGENDARY_RAKEBACK');
            expect(result.percent).toBe(5.00);
            expect(result.rakebackAmount).toBe(50);
            expect(result.eligible).toBe(true);
        });

        test('✅ calculateRakeback calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, earned: { rakeback_amount: 50 } },
                    error: null
                })
            };

            const engine = new EconomyRiskEngine(mockSupabase);
            const result = await engine.calculateRakeback({
                userId: 'user-123',
                feeSource: 'ARENA_ENTRY',
                feeAmount: 1000
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_calculate_rakeback', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 53: BURN VAULT TRANSPARENCY
    // ═══════════════════════════════════════════════════════

    describe('Task 53: BURN_VAULT_TRANSPARENCY', () => {

        test('✅ Burn transparency config is public', () => {
            expect(ECONOMY_RISK_CONFIG.BURN_TRANSPARENCY.PUBLIC).toBe(true);
        });

        test('✅ Burn transparency is anonymized for privacy', () => {
            expect(ECONOMY_RISK_CONFIG.BURN_TRANSPARENCY.ANONYMIZED).toBe(true);
        });

        test('✅ getBurnTransparency returns data', async () => {
            const mockSupabase = {
                from: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue({
                            data: [{ id: 'burn-1', burn_amount: 100 }],
                            error: null
                        })
                    })
                })
            };

            const engine = new EconomyRiskEngine(mockSupabase);
            const result = await engine.getBurnTransparency(10);

            expect(result.success).toBe(true);
            expect(result.burns).toHaveLength(1);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 💱 TASK 54: MULTI-CURRENCY SWAP
    // ═══════════════════════════════════════════════════════

    describe('Task 54: MULTI_CURRENCY_ATOMIC_SWAP', () => {

        test('✅ calculateSwapPreview: 1000 XP → 9 Diamond (5% fee)', () => {
            const result = EconomyRiskEngine.calculateSwapPreview('XP', 'DIAMOND', 1000);
            expect(result.success).toBe(true);
            expect(result.input).toBe(1000);
            expect(result.fee).toBe(50);  // 5% of 1000
            expect(result.output).toBe(9);  // (1000 - 50) * 0.01 = 9.5 → 9
        });

        test('✅ calculateSwapPreview: 100 Diamond → 100 Arena Ticket (no fee)', () => {
            const result = EconomyRiskEngine.calculateSwapPreview('DIAMOND', 'ARENA_TICKET', 100);
            expect(result.success).toBe(true);
            expect(result.fee).toBe(0);
            expect(result.output).toBe(100);
        });

        test('✅ calculateSwapPreview: Invalid pair returns error', () => {
            const result = EconomyRiskEngine.calculateSwapPreview('GOLD', 'SILVER', 100);
            expect(result.success).toBe(false);
            expect(result.error).toBe('SWAP_PAIR_NOT_SUPPORTED');
        });

        test('✅ executeCurrencySwap calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, swap_id: 'swap-123', swap: { output: 10 } },
                    error: null
                })
            };

            const engine = new EconomyRiskEngine(mockSupabase);
            const result = await engine.executeCurrencySwap({
                userId: 'user-123',
                fromCurrency: 'XP',
                toCurrency: 'DIAMOND',
                amount: 1000
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_execute_currency_swap', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     💱 ECONOMY & RISK — TEST SUITE LOADED                  ║
║     SOVEREIGN_MAPPING: 51-54                               ║
╚════════════════════════════════════════════════════════════╝
`);
