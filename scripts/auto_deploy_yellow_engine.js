/**
 * 🛰️ YELLOW ENGINE AUTO-DEPLOY SCRIPT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ANTIGRAVITY_EXECUTION: Orders 13-15
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Deploys:
 * - Order 13: diamond_ledger + burn_vault (Atomic Ledger)
 * - Order 14: 25% Burn Law RPC functions
 * - Order 15: Streak Oracle connection to RED
 * 
 * Usage: node scripts/auto_deploy_yellow_engine.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════
// 🔧 CONFIGURATION
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kuklfnapbkmacvwxktbh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error(`
╔════════════════════════════════════════════════════════════╗
║  ❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not set              ║
║                                                            ║
║  Run with:                                                 ║
║  export SUPABASE_SERVICE_ROLE_KEY="your-service-key"      ║
║  node scripts/auto_deploy_yellow_engine.js                ║
╚════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

// ═══════════════════════════════════════════════════════════
// 📋 MIGRATION FILES TO DEPLOY
// ═══════════════════════════════════════════════════════════

const MIGRATIONS = [
    {
        order: 13,
        name: 'ATOMIC_LEDGER_INTEGRITY',
        file: '012_diamond_ledger_integrity.sql',
        description: 'Deploy diamond_ledger view + integrity trigger'
    },
    {
        order: 14,
        name: '25_PERCENT_BURN_LAW',
        file: '013_marketplace_burn_law.sql',
        description: 'Activate fn_execute_burn_transfer with 75/25 split'
    },
    {
        order: 15,
        name: 'YELLOW_ENGINE_SEAL',
        file: '014_yellow_engine_final_seal.sql',
        description: 'Apply Sovereign Seal to Yellow Engine'
    }
];

// ═══════════════════════════════════════════════════════════
// 🚀 AUTO-DEPLOY FUNCTION
// ═══════════════════════════════════════════════════════════

async function deployMigration(migration) {
    const filePath = join(__dirname, '..', 'src', 'db', 'migrations', migration.file);

    console.log(`\n📦 ORDER ${migration.order}: ${migration.name}`);
    console.log(`   └─ ${migration.description}`);
    console.log(`   └─ File: ${migration.file}`);

    try {
        const sql = readFileSync(filePath, 'utf-8');

        // Execute via Supabase SQL
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            // If exec_sql doesn't exist, try direct query (requires admin access)
            console.log(`   ⚠️  RPC method not available, manual deployment required`);
            console.log(`   📋 SQL Preview (first 200 chars):`);
            console.log(`   ${sql.substring(0, 200).replace(/\n/g, '\n   ')}...`);
            return { success: false, manual: true };
        }

        console.log(`   ✅ DEPLOYED SUCCESSFULLY`);
        return { success: true };

    } catch (err) {
        console.log(`   ❌ ERROR: ${err.message}`);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════
// 🔥 VERIFY BURN VAULT EXISTS
// ═══════════════════════════════════════════════════════════

async function verifyBurnVault() {
    console.log(`\n🔥 VERIFYING BURN_VAULT...`);

    const { data, error } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', '00000000-0000-0000-0000-000000000000')
        .single();

    if (error || !data) {
        console.log(`   ⚠️  BURN_VAULT wallet not found - will be created by migration`);
        return false;
    }

    console.log(`   ✅ BURN_VAULT exists`);
    console.log(`   └─ Wallet ID: ${data.id}`);
    console.log(`   └─ Current Balance: ${data.balance} 💎`);
    return true;
}

// ═══════════════════════════════════════════════════════════
// 📊 VERIFY DIAMOND LEDGER VIEW
// ═══════════════════════════════════════════════════════════

async function verifyDiamondLedger() {
    console.log(`\n📊 VERIFYING DIAMOND_LEDGER VIEW...`);

    const { data, error } = await supabase
        .from('diamond_ledger')
        .select('ledger_entry_id, transaction_type, amount')
        .limit(5);

    if (error) {
        console.log(`   ⚠️  diamond_ledger view not accessible: ${error.message}`);
        return false;
    }

    console.log(`   ✅ diamond_ledger view accessible`);
    console.log(`   └─ Sample entries: ${data?.length || 0}`);
    return true;
}

// ═══════════════════════════════════════════════════════════
// 🔴 VERIFY RED SYNC (Identity DNA Connection)
// ═══════════════════════════════════════════════════════════

async function verifyRedSync() {
    console.log(`\n🔴 VERIFYING RED SYNC (Identity DNA)...`);

    // Check if profiles table exists (from Identity DNA Engine)
    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

    if (profilesError) {
        console.log(`   ⚠️  profiles table not found (RED Engine not deployed)`);
        console.log(`   └─ Falling back to wallets.current_streak`);
        return { redAvailable: false, fallback: 'wallets' };
    }

    console.log(`   ✅ RED Engine (profiles) connected`);
    console.log(`   └─ Streak Oracle will sync from: profiles.current_streak`);
    return { redAvailable: true, fallback: null };
}

// ═══════════════════════════════════════════════════════════
// 🛡️ VERIFY SEAL STATUS
// ═══════════════════════════════════════════════════════════

async function verifySealStatus() {
    console.log(`\n🛡️ VERIFYING SOVEREIGN SEAL...`);

    const { data, error } = await supabase.rpc('fn_verify_yellow_engine_seal');

    if (error) {
        console.log(`   ⚠️  Seal verification function not available`);
        return null;
    }

    const seal = typeof data === 'string' ? JSON.parse(data) : data;

    console.log(`   ✅ Seal Status: ${seal.seal_status}`);
    console.log(`   └─ Phase 13: ${seal.phase_13?.status || 'UNKNOWN'}`);
    console.log(`   └─ Phase 14: ${seal.phase_14?.status || 'UNKNOWN'}`);
    console.log(`   └─ Phase 15: ${seal.phase_15?.status || 'UNKNOWN'}`);

    return seal;
}

// ═══════════════════════════════════════════════════════════
// 🚀 MAIN EXECUTION
// ═══════════════════════════════════════════════════════════

async function main() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🛰️ ANTIGRAVITY_EXECUTION: YELLOW_AUTO_PILOT          ║
║     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║
║     STATUS: AUTO_PILOT_ACTIVE 🚀                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

    console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
    console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);

    // ═══════════════════════════════════════════════════════
    // STEP 1: Deploy Migrations
    // ═══════════════════════════════════════════════════════

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📦 DEPLOYING MIGRATIONS`);
    console.log(`${'═'.repeat(60)}`);

    const results = [];
    for (const migration of MIGRATIONS) {
        const result = await deployMigration(migration);
        results.push({ ...migration, ...result });
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: Verify Deployments
    // ═══════════════════════════════════════════════════════

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔍 VERIFYING DEPLOYMENTS`);
    console.log(`${'═'.repeat(60)}`);

    await verifyBurnVault();
    await verifyDiamondLedger();
    const redStatus = await verifyRedSync();
    const sealStatus = await verifySealStatus();

    // ═══════════════════════════════════════════════════════
    // STEP 3: Final Report
    // ═══════════════════════════════════════════════════════

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 AUTO-PILOT MISSION REPORT`);
    console.log(`${'═'.repeat(60)}`);

    const successful = results.filter(r => r.success).length;
    const needsManual = results.filter(r => r.manual).length;
    const failed = results.filter(r => !r.success && !r.manual).length;

    console.log(`
┌────────────────────────────────────────────────────────────┐
│  ORDER 13: ATOMIC_LEDGER_INTEGRITY                        │
│  └─ diamond_ledger VIEW: ${results[0]?.success ? '✅ DEPLOYED' : '⚠️  PENDING'}
│  └─ trg_enforce_ledger_integrity: ${results[0]?.success ? '✅ ACTIVE' : '⚠️  PENDING'}
├────────────────────────────────────────────────────────────┤
│  ORDER 14: 25_PERCENT_BURN_LAW                            │
│  └─ fn_execute_burn_transfer: ${results[1]?.success ? '✅ DEPLOYED' : '⚠️  PENDING'}
│  └─ BURN_VAULT (00...0000): ${results[1]?.success ? '✅ READY' : '⚠️  PENDING'}
├────────────────────────────────────────────────────────────┤
│  ORDER 15: STREAK_REWARD_ORACLE_SYNC                      │
│  └─ RED Engine (profiles): ${redStatus.redAvailable ? '✅ CONNECTED' : '⚠️  FALLBACK'}
│  └─ Streak Source: ${redStatus.redAvailable ? 'profiles.current_streak' : 'wallets.current_streak'}
│  └─ Multipliers: 1.2x (3d) | 1.5x (7d) | 2.0x (30d)       │
├────────────────────────────────────────────────────────────┤
│  SOVEREIGN_SEAL: ${sealStatus?.seal_status || 'PENDING'}
└────────────────────────────────────────────────────────────┘
`);

    if (needsManual > 0) {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║  ⚠️  MANUAL DEPLOYMENT REQUIRED                           ║
║                                                            ║
║  Copy SQL files to Supabase SQL Editor:                   ║
║  1. 012_diamond_ledger_integrity.sql                      ║
║  2. 013_marketplace_burn_law.sql                          ║
║  3. 014_yellow_engine_final_seal.sql                      ║
║                                                            ║
║  Or run via Supabase CLI:                                 ║
║  supabase db push                                          ║
╚════════════════════════════════════════════════════════════╝
`);
    }

    console.log(`\n✅ AUTO_PILOT_EXECUTION_COMPLETE`);
    console.log(`⏱️  Completed: ${new Date().toISOString()}\n`);
}

main().catch(console.error);
