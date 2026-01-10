/**
 * 🛰️ SOVEREIGN ORB SYNC ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for SOVEREIGN_ORB_SYNC (TASKS 41-43)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { SovereignOrbSyncEngine, ORB_SYNC_CONFIG } from '../engines/SovereignOrbSyncEngine.js';
import { jest } from '@jest/globals';

describe('🛰️ SovereignOrbSyncEngine (Tasks 41-43)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new SovereignOrbSyncEngine(null))
                .toThrow('ORB_SYNC_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new SovereignOrbSyncEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // ⚙️ CONFIGURATION VALIDATION
    // ═══════════════════════════════════════════════════════

    describe('Configuration', () => {

        test('✅ Diamond Arena is Orb 3', () => {
            expect(ORB_SYNC_CONFIG.ORBS.DIAMOND_ARENA.id).toBe(3);
        });

        test('✅ Arcade Royale is Orb 7', () => {
            expect(ORB_SYNC_CONFIG.ORBS.ARCADE_ROYALE.id).toBe(7);
        });

        test('✅ Arcade burn rate is 25% (HARD LAW)', () => {
            expect(ORB_SYNC_CONFIG.ARCADE_BURN.RATE).toBe(0.25);
        });

        test('✅ Arcade burn is enforced', () => {
            expect(ORB_SYNC_CONFIG.ARCADE_BURN.ENFORCED).toBe(true);
        });

        test('✅ LEGENDARY multiplier is 2.0x at 30 days', () => {
            expect(ORB_SYNC_CONFIG.ARENA_MULTIPLIERS.LEGENDARY.days).toBe(30);
            expect(ORB_SYNC_CONFIG.ARENA_MULTIPLIERS.LEGENDARY.value).toBe(2.00);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 💎 TASK 41: DIAMOND TREASURY SYNC
    // ═══════════════════════════════════════════════════════

    describe('Task 41: DIAMOND_TREASURY_SYNC', () => {

        test('✅ recordDiamondActivity calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        activity_id: 'activity-123',
                        pending_sync: true
                    },
                    error: null
                })
            };

            const engine = new SovereignOrbSyncEngine(mockSupabase);
            const result = await engine.recordDiamondActivity({
                userId: 'user-123',
                orbId: 3,
                activityType: 'ARENA_WIN',
                diamondsDelta: 100
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_record_diamond_activity', expect.any(Object));
            expect(result.success).toBe(true);
        });

        test('✅ syncActivityToWallet calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        transaction_id: 'tx-456'
                    },
                    error: null
                })
            };

            const engine = new SovereignOrbSyncEngine(mockSupabase);
            const result = await engine.syncActivityToWallet('activity-123');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_sync_activity_to_wallet', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 42: 25% BURN ENFORCER (Arcade)
    // ═══════════════════════════════════════════════════════

    describe('Task 42: 25_PERCENT_BURN_ENFORCER', () => {

        test('✅ calculateArcadeBurn: 100 → 75 net, 25 burned', () => {
            const result = SovereignOrbSyncEngine.calculateArcadeBurn(100);
            expect(result.grossAmount).toBe(100);
            expect(result.burnAmount).toBe(25);
            expect(result.netAmount).toBe(75);
            expect(result.burnRate).toBe('25%');
        });

        test('✅ calculateArcadeBurn: 1000 → 750 net, 250 burned', () => {
            const result = SovereignOrbSyncEngine.calculateArcadeBurn(1000);
            expect(result.grossAmount).toBe(1000);
            expect(result.burnAmount).toBe(250);
            expect(result.netAmount).toBe(750);
        });

        test('✅ processArcadeTransactionWithBurn calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        burn_id: 'burn-123',
                        transaction: { burn_amount: 25 }
                    },
                    error: null
                })
            };

            const engine = new SovereignOrbSyncEngine(mockSupabase);
            const result = await engine.processArcadeTransactionWithBurn({
                userId: 'user-123',
                txType: 'JACKPOT',
                grossAmount: 100
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_arcade_transaction_with_burn', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🔥 TASK 43: STREAK MULTIPLIER SYNC (Arena)
    // ═══════════════════════════════════════════════════════

    describe('Task 43: STREAK_MULTIPLIER_SYNC', () => {

        test('✅ calculateArenaMultiplier: 30 days = LEGENDARY 2.0x', () => {
            const result = SovereignOrbSyncEngine.calculateArenaMultiplier(100, 30);
            expect(result.tier).toBe('LEGENDARY');
            expect(result.multiplier).toBe(2.00);
            expect(result.final).toBe(200);
            expect(result.bonus).toBe(100);
            expect(result.emoji).toBe('👑🔥');
        });

        test('✅ calculateArenaMultiplier: 14 days = BLAZING 1.75x', () => {
            const result = SovereignOrbSyncEngine.calculateArenaMultiplier(100, 14);
            expect(result.tier).toBe('BLAZING');
            expect(result.multiplier).toBe(1.75);
            expect(result.final).toBe(175);
        });

        test('✅ calculateArenaMultiplier: 7 days = HOT 1.5x', () => {
            const result = SovereignOrbSyncEngine.calculateArenaMultiplier(100, 7);
            expect(result.tier).toBe('HOT');
            expect(result.multiplier).toBe(1.50);
            expect(result.final).toBe(150);
        });

        test('✅ calculateArenaMultiplier: 3 days = WARMING 1.2x', () => {
            const result = SovereignOrbSyncEngine.calculateArenaMultiplier(100, 3);
            expect(result.tier).toBe('WARMING');
            expect(result.multiplier).toBe(1.20);
            expect(result.final).toBe(120);
        });

        test('✅ calculateArenaMultiplier: 0 days = COLD 1.0x', () => {
            const result = SovereignOrbSyncEngine.calculateArenaMultiplier(100, 0);
            expect(result.tier).toBe('COLD');
            expect(result.multiplier).toBe(1.00);
            expect(result.final).toBe(100);
            expect(result.bonus).toBe(0);
        });

        test('✅ processArenaRewardWithStreak calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        multiplier_id: 'mult-123',
                        reward: { final: 200 }
                    },
                    error: null
                })
            };

            const engine = new SovereignOrbSyncEngine(mockSupabase);
            const result = await engine.processArenaRewardWithStreak({
                userId: 'user-123',
                baseReward: 100,
                arenaType: 'PVP'
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_arena_reward_with_streak', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 📊 STATUS METHODS
    // ═══════════════════════════════════════════════════════

    describe('Status Methods', () => {

        test('✅ getOrbSyncStatus returns structured data', async () => {
            const mockSupabase = {
                from: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                total_activities: 100,
                                synced_activities: 95,
                                arcade_burn_total: 5000,
                                total_streak_bonus: 2500
                            },
                            error: null
                        })
                    })
                })
            };

            const engine = new SovereignOrbSyncEngine(mockSupabase);
            const result = await engine.getOrbSyncStatus();

            expect(result.success).toBe(true);
            expect(result.status.task41_treasury).toBeDefined();
            expect(result.status.task42_arcadeBurn).toBeDefined();
            expect(result.status.task43_arenaMultiplier).toBeDefined();
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🛰️ SOVEREIGN ORB SYNC — TEST SUITE LOADED             ║
║     ORB_03_DIAMOND_ARENA & ORB_07_ARCADE (41-43)          ║
╚════════════════════════════════════════════════════════════╝
`);
