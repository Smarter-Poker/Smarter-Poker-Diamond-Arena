![CI](https://github.com/Smarter-Poker/Smarter-Poker-Diamond-Arena/actions/workflows/ci.yml/badge.svg)

# 💎 DIAMOND ECONOMY RAILS

> Virtual Currency Mint & Streak Math System for **Smarter.Poker**

## 🛡️ SOVEREIGN_SEAL_STATUS: APPLIED

**Mapping Phase: 15/15 — 100% COMPLETE**

| Phase | Name | Status |
|:------|:-----|:-------|
| 13 | ATOMIC_LEDGER_INTEGRITY | ✅ MAPPED |
| 14 | 25_PERCENT_MARKETPLACE_BURN_LAW | ✅ MAPPED |
| 15 | STREAK_MULTIPLIER_DYNAMIC_HOOK | ✅ MAPPED |

## 🎯 Overview

This module implements the Diamond Economy system for:
- **Orb #7 (Arcade)**: Skill-based wagering with virtual currency
- **Orb #10 (Marketplace)**: Store & exchange economy

### 🔒 Hard Laws Enforced

| Law | Description |
|:----|:------------|
| **ATOMIC_LEDGER_INTEGRITY** | No transaction without `previous_balance` → `new_balance` verification |
| **25_PERCENT_BURN** | Marketplace: 75% to Seller, 25% to BURN_VAULT |
| **STREAK_MULTIPLIER** | 3-Day (1.2x), 7-Day (1.5x), 30-Day (2.0x) for ALL diamonds |
| **85_PERCENT_MASTERY_GATE** | Requires 85% accuracy for diamond rewards |

## ⚡ RPC-Powered Architecture

All diamond operations execute via **Postgres RPC functions** directly on database metal:

```
┌─────────────────────┐     ┌────────────────────────────────────┐
│   JavaScript Layer  │     │     Postgres RPC Functions         │
│                     │     │                                    │
│  WalletService ─────┼────▶│ fn_mint_diamonds_atomic()          │
│  StreakService ─────┼────▶│ fn_burn_diamonds_atomic()          │
│                     │     │ fn_claim_daily_reward()            │
│                     │     │ fn_transfer_diamonds_atomic()      │
└─────────────────────┘     └────────────────────────────────────┘
                                           │
                            ┌──────────────┴──────────────┐
                            │  pg_cron Scheduled Jobs     │
                            │  • Hourly streak expiration │
                            │  • Daily analytics snapshot │
                            │  • Weekly leaderboard       │
                            └─────────────────────────────┘
```

### Benefits
- **Zero network round-trips** — Single RPC call per operation
- **ACID transactions** — Wallet + Transaction atomically committed
- **Row-level locking** — `FOR UPDATE` prevents race conditions
- **Internal scheduling** — `pg_cron` eliminates external API calls

## 📦 Core Components

### 1. DiamondMintEngine (JavaScript)
Client-side streak multiplier calculations.

```javascript
import { DiamondMintEngine } from './src/index.js';

// Calculate reward with streak multiplier
const result = DiamondMintEngine.calculateReward(100, 7);
// → { finalAmount: 150, multiplier: 1.5, tier: { label: '🔥🔥 Hot' } }
```

### 2. RPC Functions (Postgres)

| Function | Purpose |
|:---------|:--------|
| `fn_mint_diamonds_atomic()` | Credit diamonds with transaction log |
| `fn_burn_diamonds_atomic()` | Debit diamonds with insufficient-funds check |
| `fn_transfer_diamonds_atomic()` | Atomic P2P transfer |
| `fn_claim_daily_reward()` | Daily streak claim with multipliers |
| `fn_get_streak_status()` | Read-only streak status |
| `fn_mint_session_reward()` | Training session completion reward |
| `fn_arcade_stake()` | Arcade entry stake |
| `fn_arcade_payout()` | Arcade win payout |
| `fn_store_purchase()` | Marketplace purchase |
| `fn_store_refund()` | Order refund |

### 3. Streak Tiers

| Tier | Days | Multiplier | Label |
|:-----|:-----|:-----------|:------|
| COLD | 0 | 1.00x | ❄️ Cold |
| WARMING | 1-2 | 1.10x | 🌡️ Warming |
| WARM | 3-6 | 1.25x | 🔥 Warm |
| HOT | 7-13 | 1.50x | 🔥🔥 Hot |
| BLAZING | 14-29 | 1.75x | 🔥🔥🔥 Blazing |
| LEGENDARY | 30+ | 2.00x | 👑 Legendary |

### 4. Milestone Bonuses

| Day | Multiplier | Tier |
|:----|:-----------|:-----|
| 7 | 2.0x | WEEK |
| 14 | 2.5x | BIWEEK |
| 30 | 3.0x | MONTH |
| 100 | 5.0x | CENTURY |

## 🗄️ Database Schema

### Core Tables
- `wallets` — User balance + streak data
- `transactions` — Immutable ledger with balance snapshots

### Analytics Tables
- `streak_maintenance_log` — Audit log for scheduled jobs
- `streak_analytics_snapshots` — Daily tier distribution

### pg_cron Jobs
```sql
-- Expires broken streaks (hourly)
SELECT cron.schedule('process_expired_streaks', '0 * * * *', ...);

-- Daily analytics snapshot (midnight UTC)
SELECT cron.schedule('daily_streak_analytics', '0 0 * * *', ...);

-- Weekly leaderboard (Sunday midnight)
SELECT cron.schedule('weekly_leaderboard_snapshot', '0 0 * * 0', ...);
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start demo
npm start
```

## 📁 Migration Order

Run these in Supabase SQL Editor or via migration tool:

1. `001_create_wallets.sql` — Wallet table + RLS
2. `002_create_transactions.sql` — Transaction ledger
3. `003_atomic_mint_rpc.sql` — Core RPC functions
4. `004_daily_claim_rpc.sql` — Streak claim logic
5. `005_pg_cron_streak_resets.sql` — Scheduled jobs
6. `006_domain_rpc_functions.sql` — Domain-specific RPCs

## 💻 Usage Examples

### Daily Claim
```javascript
import { StreakService } from './src/index.js';

const streakService = new StreakService(supabaseClient);
const result = await streakService.claimDailyReward(userId);

if (result.success) {
    console.log(`Earned ${result.claim.totalDiamonds} 💎`);
    console.log(`Streak: ${result.streak.newStreak} days`);
}
```

### Arcade Flow
```javascript
import { WalletService } from './src/index.js';

const wallet = new WalletService(supabaseClient);

// Stake for arcade entry
const stake = await wallet.stakeForArcade(userId, 25, 'SKILL_TRIAL', sessionId);
if (!stake.success) {
    // Handle insufficient funds
    return showError(stake.message);
}

// ... player completes arcade game ...

// Award winnings
const payout = await wallet.payoutArcadeWin(userId, winAmount, sessionId, gameResult);
```

## 📐 Architecture Alignment

This implementation aligns with:
- **Smarter.Poker Global Progression System** (Streak-based scaling)
- **Skill Economy Engine** (Arcade integration)
- **Sovereign Wall** (RLS-enforced data isolation)

---

**©️ Smarter.Poker — Diamond Arcade Division**
