/**
 * 💎 DIAMOND ECONOMY RAILS — ENTRY POINT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Orb #7 (Arcade) | Orb #10 (Marketplace)
 * 
 * Virtual Currency Mint & Streak Math System
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════

// 💎 Yellow Foundation (Tasks 1-3)
export {
    YellowFoundationEngine,
    FOUNDATION_CONFIG
} from './engines/YellowFoundationEngine.js';

// 🛡️ Yellow Active Logic (Tasks 4-6)
export {
    YellowActiveLogicEngine,
    ACTIVE_LOGIC_CONFIG
} from './engines/YellowActiveLogicEngine.js';

// 🎰 Yellow Addiction Engine (Tasks 7-9)
export {
    YellowAddictionEngine,
    ADDICTION_ENGINE_CONFIG
} from './engines/YellowAddictionEngine.js';

// 🚌 Yellow Master Bus (Tasks 10-12)
export {
    YellowMasterBusEngine,
    MASTER_BUS_CONFIG
} from './engines/YellowMasterBusEngine.js';

// ⚡ Yellow Integration Strike (Tasks 16-18)
export {
    YellowIntegrationStrikeEngine,
    INTEGRATION_STRIKE_CONFIG
} from './engines/YellowIntegrationStrikeEngine.js';

// ✨ Yellow Visual Addiction (Tasks 19-21)
export {
    YellowVisualAddictionEngine,
    VISUAL_ADDICTION_CONFIG
} from './engines/YellowVisualAddictionEngine.js';

// Core Engine
export {
    DiamondMintEngine,
    STREAK_TIERS
} from './engines/DiamondMintEngine.js';

// Services
export {
    WalletService,
    TX_SOURCES
} from './services/WalletService.js';

export {
    StreakService,
    STREAK_CONFIG
} from './services/StreakService.js';

// ⚡ Economy Fix (Database-Level Minting)
export {
    createEconomyFix,
    getEconomyFix
} from './EconomyFix.js';

// 🔥 Streak Bonus Engine (Tier-Based Multipliers)
export {
    StreakBonusEngine,
    STREAK_TIERS_V2
} from './engines/StreakBonusEngine.js';

// 🔥 Burn Vault Service (25% Marketplace Burn)
export {
    BurnVaultService,
    BURN_CONFIG
} from './services/BurnVaultService.js';

// 🎮 Arcade Escrow Service (Wagering Vault)
export {
    ArcadeEscrowService,
    ESCROW_STATUS
} from './services/ArcadeEscrowService.js';

// 🎓 Training Rewards Service (85% Threshold)
export {
    TrainingRewardsService,
    TRAINING_CONFIG
} from './services/TrainingRewardsService.js';

// 🧮 Reward Calculator (Streak Dynamic Hook - Phase 15)
export {
    RewardCalculator,
    STREAK_MULTIPLIERS
} from './engines/RewardCalculator.js';

// 🔮 Streak Reward Oracle (RED Sync - Order 15)
export {
    StreakRewardOracle,
    ORACLE_CONFIG
} from './services/StreakRewardOracle.js';

// ═══════════════════════════════════════════════════════════
// 🎯 QUICK START DEMO
// ═══════════════════════════════════════════════════════════

import { DiamondMintEngine } from './engines/DiamondMintEngine.js';

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     💎 DIAMOND ECONOMY RAILS — v1.0.0                     ║
║     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║
║     Orb #7 (Arcade) | Orb #10 (Marketplace)               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

// Demo: Streak Multiplier Calculations
console.log('📊 STREAK MULTIPLIER DEMO:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const testCases = [
    { base: 100, days: 0, expected: '1.00x' },
    { base: 100, days: 3, expected: '1.25x' },
    { base: 100, days: 7, expected: '1.50x' },
    { base: 100, days: 14, expected: '1.75x' },
    { base: 100, days: 30, expected: '2.00x' }
];

testCases.forEach(({ base, days, expected }) => {
    const result = DiamondMintEngine.calculateReward(base, days);
    console.log(
        `  ${result.tier.label.padEnd(15)} | ` +
        `Day ${String(days).padStart(2)} | ` +
        `${base} 💎 × ${result.multiplier.toFixed(2)} = ${result.finalAmount} 💎`
    );
});

console.log('\n✅ System ready. Import modules to integrate with Supabase.');
