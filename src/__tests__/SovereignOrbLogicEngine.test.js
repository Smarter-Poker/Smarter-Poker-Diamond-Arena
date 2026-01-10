/**
 * 🛰️ SOVEREIGN ORB LOGIC ENGINE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Tests for SOVEREIGN_ORB_LOGIC (TASKS 44-46)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { SovereignOrbLogicEngine, ORB_LOGIC_CONFIG } from '../engines/SovereignOrbLogicEngine.js';
import { jest } from '@jest/globals';

describe('🛰️ SovereignOrbLogicEngine (Tasks 44-46)', () => {

    // ═══════════════════════════════════════════════════════
    // 🛠️ INITIALIZATION
    // ═══════════════════════════════════════════════════════

    describe('Initialization', () => {

        test('✅ Throws error without supabase client', () => {
            expect(() => new SovereignOrbLogicEngine(null))
                .toThrow('ORB_LOGIC_ERROR');
        });

        test('✅ Creates engine with valid supabase client', () => {
            const mockSupabase = { rpc: jest.fn() };
            const engine = new SovereignOrbLogicEngine(mockSupabase);
            expect(engine).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════
    // ⚙️ CONFIGURATION
    // ═══════════════════════════════════════════════════════

    describe('Configuration', () => {

        test('✅ Arena has 6 tiers', () => {
            expect(ORB_LOGIC_CONFIG.ARENA_TIERS).toHaveLength(6);
        });

        test('✅ BRONZE_ARENA requires 0 XP', () => {
            expect(ORB_LOGIC_CONFIG.ARENA_TIERS[0].minXp).toBe(0);
        });

        test('✅ LEGENDARY_ARENA requires 100,000 XP', () => {
            const legendary = ORB_LOGIC_CONFIG.ARENA_TIERS.find(t => t.name === 'LEGENDARY_ARENA');
            expect(legendary.minXp).toBe(100000);
        });

        test('✅ Arcade wager burn rate is 25%', () => {
            expect(ORB_LOGIC_CONFIG.ARCADE_WAGER.BURN_RATE).toBe(0.25);
        });

        test('✅ Marketplace burn rate is 25%', () => {
            expect(ORB_LOGIC_CONFIG.MARKETPLACE_BURN_RATE).toBe(0.25);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🎯 TASK 44: ARENA STAKES
    // ═══════════════════════════════════════════════════════

    describe('Task 44: ORB_03_DIAMOND_ARENA_STAKES', () => {

        test('✅ calculateArenaTierFromXp: 0 XP = BRONZE', () => {
            const result = SovereignOrbLogicEngine.calculateArenaTierFromXp(0);
            expect(result.tier.name).toBe('BRONZE_ARENA');
            expect(result.tier.level).toBe(1);
        });

        test('✅ calculateArenaTierFromXp: 5000 XP = GOLD', () => {
            const result = SovereignOrbLogicEngine.calculateArenaTierFromXp(5000);
            expect(result.tier.name).toBe('GOLD_ARENA');
            expect(result.tier.level).toBe(3);
        });

        test('✅ calculateArenaTierFromXp: 50000 XP = DIAMOND', () => {
            const result = SovereignOrbLogicEngine.calculateArenaTierFromXp(50000);
            expect(result.tier.name).toBe('DIAMOND_ARENA');
        });

        test('✅ calculateArenaTierFromXp: 100000 XP = LEGENDARY', () => {
            const result = SovereignOrbLogicEngine.calculateArenaTierFromXp(100000);
            expect(result.tier.name).toBe('LEGENDARY_ARENA');
            expect(result.tier.icon).toBe('👑');
        });

        test('✅ getArenaAccessTier calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, current_tier: { level: 3, name: 'GOLD_ARENA' } },
                    error: null
                })
            };

            const engine = new SovereignOrbLogicEngine(mockSupabase);
            const result = await engine.getArenaAccessTier('user-123');

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_get_arena_access_tier', expect.any(Object));
            expect(result.success).toBe(true);
        });

        test('✅ requestArenaAccess calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, session_id: 'session-123' },
                    error: null
                })
            };

            const engine = new SovereignOrbLogicEngine(mockSupabase);
            const result = await engine.requestArenaAccess({
                userId: 'user-123',
                tierLevel: 3,
                stakeAmount: 500
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_request_arena_access', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🎰 TASK 45: ARCADE WAGER ENGINE
    // ═══════════════════════════════════════════════════════

    describe('Task 45: ORB_07_ARCADE_WAGER_ENGINE', () => {

        test('✅ calculateWagerBurn: 100 → 25 burned, 75 to pool', () => {
            const result = SovereignOrbLogicEngine.calculateWagerBurn(100);
            expect(result.wagerAmount).toBe(100);
            expect(result.wagerBurn).toBe(25);
            expect(result.netWager).toBe(75);
        });

        test('✅ calculateWagerBurn: 1000 → 250 burned', () => {
            const result = SovereignOrbLogicEngine.calculateWagerBurn(1000);
            expect(result.wagerBurn).toBe(250);
            expect(result.netWager).toBe(750);
        });

        test('✅ calculateFullWagerCycle: WIN scenario', () => {
            const result = SovereignOrbLogicEngine.calculateFullWagerCycle(100, 200);
            expect(result.wager.burned).toBe(25);
            expect(result.payout.burned).toBe(50);
            expect(result.totalBurned).toBe(75);
            expect(result.payout.received).toBe(150);
            expect(result.outcome).toBe('WIN');
        });

        test('✅ calculateFullWagerCycle: LOSS scenario', () => {
            const result = SovereignOrbLogicEngine.calculateFullWagerCycle(100, 0);
            expect(result.wager.burned).toBe(25);
            expect(result.payout.received).toBe(0);
            expect(result.outcome).toBe('LOSS');
        });

        test('✅ placeArcadeWager calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, wager_id: 'wager-123' },
                    error: null
                })
            };

            const engine = new SovereignOrbLogicEngine(mockSupabase);
            const result = await engine.placeArcadeWager({
                userId: 'user-123',
                gameMode: 'SURVIVAL',
                wagerAmount: 100
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_place_arcade_wager', expect.any(Object));
            expect(result.success).toBe(true);
        });

        test('✅ settleArcadeWager calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: { success: true, settlement: { outcome: 'WIN' } },
                    error: null
                })
            };

            const engine = new SovereignOrbLogicEngine(mockSupabase);
            const result = await engine.settleArcadeWager({
                wagerId: 'wager-123',
                outcome: 'WIN',
                payoutAmount: 200
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_settle_arcade_wager', expect.any(Object));
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════
    // 🏪 TASK 46: MARKETPLACE ENGINE
    // ═══════════════════════════════════════════════════════

    describe('Task 46: ORB_10_MARKETPLACE_ENGINE', () => {

        test('✅ calculateMarketplaceSplit: 100 → 25 burned, 75 to seller', () => {
            const result = SovereignOrbLogicEngine.calculateMarketplaceSplit(100);
            expect(result.salePrice).toBe(100);
            expect(result.burnAmount).toBe(25);
            expect(result.sellerReceives).toBe(75);
        });

        test('✅ calculateMarketplaceSplit: 1000 → 250 burned', () => {
            const result = SovereignOrbLogicEngine.calculateMarketplaceSplit(1000);
            expect(result.burnAmount).toBe(250);
            expect(result.sellerReceives).toBe(750);
        });

        test('✅ executeAuctionSale calls RPC', async () => {
            const mockSupabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: {
                        success: true,
                        sale_id: 'sale-123',
                        activity_ledger: { buyer_entry: 'a1', seller_entry: 'a2' }
                    },
                    error: null
                })
            };

            const engine = new SovereignOrbLogicEngine(mockSupabase);
            const result = await engine.executeAuctionSale({
                listingId: 'listing-123',
                buyerId: 'buyer-456',
                salePrice: 500,
                saleType: 'BUYOUT'
            });

            expect(mockSupabase.rpc).toHaveBeenCalledWith('fn_execute_auction_sale', expect.any(Object));
            expect(result.success).toBe(true);
            expect(result.activity_ledger).toBeDefined();
        });

        test('✅ Auction types are valid', () => {
            expect(ORB_LOGIC_CONFIG.AUCTION_TYPES).toContain('FIXED');
            expect(ORB_LOGIC_CONFIG.AUCTION_TYPES).toContain('BID');
            expect(ORB_LOGIC_CONFIG.AUCTION_TYPES).toContain('DUTCH');
        });
    });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🛰️ SOVEREIGN ORB LOGIC — TEST SUITE LOADED            ║
║     ORBS 03, 07, 10 (Tasks 44-46)                          ║
╚════════════════════════════════════════════════════════════╝
`);
