# 🎯 Diamond Arena - Build Plan
## Date: 2026-01-12 | Project Manager: Antigravity

---

## 📊 Current State Analysis

### ✅ Completed Features
- [x] Core Poker Engine (Texas Hold'em)
- [x] PLO Variants (PLO, PLO5, PLO6, PLO8)
- [x] Omaha Hand Evaluation (High + Hi/Lo Split)
- [x] Simulation Mode (Offline Play vs Bots)
- [x] Multiplayer Infrastructure (Supabase Realtime)
- [x] RPC Functions (fn_seat_player, fn_leave_table)
- [x] UI: Lobby, Table, Betting Controls
- [x] 4-Color Deck Support
- [x] Pre-Action Buttons (Check/Fold, Call Any)
- [x] Production Deployment (Vercel + Supabase)

### 🔴 Critical Gaps (Blocking Features)
1. **Pot-Limit Betting Logic** - PLO games are using NO_LIMIT math (WRONG!)
2. **Game Host/Dealer Service** - No server-side game progression
3. **Authentication** - Login/Signup not wired to game

### 🟡 High Priority (Core Experience)
4. **Tournament System** - SNGs and MTTs
5. **Hand History Persistence** - Save/replay hands
6. **Player Stats Integration** - Track VPIP, PFR, etc.

### 🟢 Polish (User Delight)
7. **Chip Animations** - Pot movement, dealing cards
8. **Sound Effects** - Full audio integration
9. **Leaderboards** - Live rankings

---

## 🚀 Today's Build Queue

### Phase 1: Pot-Limit Betting (30 min)
**Priority: CRITICAL** - PLO games need correct pot-limit math

- [ ] Implement `calculatePotLimitMax()` in table-engine
- [ ] Update `getValidActions()` to use POT_LIMIT structure
- [ ] Test with PLO simulation

### Phase 2: Game Dealer Service (1 hour)
**Priority: CRITICAL** - Enable real multiplayer progression

- [ ] Create `GameDealerService` class
- [ ] Implement turn timer & auto-fold
- [ ] Broadcast state changes via Supabase Realtime
- [ ] Connect to PokerRoom component

### Phase 3: Authentication Flow (45 min)
**Priority: HIGH** - Gate real money features

- [ ] Wire Login/Signup modal to Supabase Auth
- [ ] Create user profile on first login
- [ ] Show authenticated state in header
- [ ] Protect table creation/seating

---

## 📈 Success Metrics
- [ ] PLO game with correct pot-limit max calculation
- [ ] 2+ players can play a complete hand online
- [ ] User can login and their balance persists

---

## 🔧 Execution Order
1. **Pot-Limit Betting** ← Starting NOW
2. Game Dealer Service
3. Authentication Flow

Let's build! 🚀
