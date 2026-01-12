# 🎰 Diamond Arena — Full PokerBros Clone Build Plan
## Date: 2026-01-12

---

## 🎯 USER REQUIREMENTS

1. **Separate Cash Games & Tournaments** — Distinct lobbies/flows
2. **Tournament Registration** — Game Details page with countdown, registration, prize pool
3. **Cash Game Buy-In** — Min/Max slider, Auto Rebuy, balance check
4. **Hand Replay System** — Shareable links like PokerBros (s.pokerbros.net)
5. **No "Create Table"** — Tables pre-created by Smarter.Poker admins
6. **Hub-to-Arena Auth Handshake** — No double login, pass session from hub
7. **Full React Implementation** — All features must be React components

---

## 📸 REFERENCE UI ANALYSIS

### 1️⃣ Tournament Registration (Game Details)
**Header:**
- Back button (<<)
- "Game Details" title
- Tab bar: Detail | Entries | Ranking | Unions | Tables | Rewards

**Tournament Info:**
- Name: "15K GTD✨WEEKNIGHT✨+ 65 (11)"
- ID: 43522103
- Description: "15K GTD NLH WEEKNIGHT / 65 BUY-IN / REBUY / NO ADD-ON"

**Countdown Timer:**
- Large digital clock (04:02:16)
- Start date/time: 2026-01-12 19:00:00
- Stats row: Blinds Up (10:00) | Late Registration (level 15) | Current Level (0)
- Stats row: Remaining Players (13/13) | Avg Stack (48K) | Early Bird (LVL 2/+20% chip)

**Details List:**
- Game Type: NLH (9 max)
- Buy-in: 65(58.50 + 6.50) [Re-entry badge]
- Prize Pool: 15K [FT DEAL badge]
- Entries: 13 | Entries Range: 5-7K
- Re-entry: 65 (x No Limit) | Add-on: No Add-on
- Starting Chips: 40K | Big Blind Ante: No
- Blind Structure: Standard [? help icon]

**Actions:**
- Share button (orange outline)
- Register button (orange filled)

### 2️⃣ Tournament Sign-Up Modal
- Title: "Sign Up" with X close button
- Entry Fee: 65 (58.50 + 6.50)
- Start time: 2026-01-12 19:00:00
- Warning: "Cannot unregister within 1 minute of the start time"
- Cancel button (orange outline)
- Confirm button (orange filled)

### 3️⃣ Cash Game Buy-In Modal
- Title: "BUY-IN" with countdown "59s (Close)" and X button
- Min/Max display: 12 (Min) — 12 (current) — 25 (Max)
- Slider with spade icon
- Account Balance: 25.00
- Auto Rebuy checkbox: "When your stack drops to 0% of the initial buy-in, it will be automatically replenished."
- "Buy Chips" button (orange)

### 4️⃣ Hand Replay Detail
**Header:**
- "HAND DETAIL" title
- Favorite star icon, Play video icon
- Timestamp: 2026-01-12 14:51:23
- Hand number: 5/10
- Serial Number: SN: 2049883074
- Share button with arrow

**Hand Info:**
- Main Pot: 2,265

**Player Rows (each row):**
- Position badge (UTG, BTN, SB, BB, MP, CO)
- Player name
- Hole cards (2 cards)
- Hand ranking (if applicable: "One Pair", "Two Pair")
- Community cards (5 cards)
- Result (+/- amount, colored green/red)
- "Main pot" label

**Controls:**
- Scrubber: 1/1 with slider
- Navigation arrows (< >)
- Diamond icon on slider
- Bottom tabs: Hand Summary | Hand Detail
- "all Any" button

---

## 🏗️ IMPLEMENTATION PHASES

### Phase 1: Hub Authentication Handshake
- [ ] Create `useHubAuth` hook to receive session from parent iframe
- [ ] Implement `postMessage` listener for auth token from hub
- [ ] Store session in context, skip login if valid
- [ ] Add fallback for direct access (redirect to hub)

### Phase 2: Lobby Restructure  
- [ ] Remove "Create Table" button
- [ ] Create `CashGamesLobby` component
- [ ] Create `TournamentsLobby` component
- [ ] Add top-level tab navigation: Cash Games | Tournaments
- [ ] Fetch tables from Supabase (admin-created only)

### Phase 3: Tournament Registration
- [ ] Create `TournamentDetailsPage` component
- [ ] Tab bar: Detail | Entries | Ranking | Unions | Tables | Rewards
- [ ] Countdown timer component
- [ ] Tournament info display
- [ ] Create `TournamentSignUpModal`
- [ ] Registration API integration

### Phase 4: Cash Game Buy-In
- [ ] Create `CashBuyInModal` component
- [ ] Min/Max slider with balance check
- [ ] Auto Rebuy checkbox
- [ ] Balance display
- [ ] Seat reservation flow

### Phase 5: Hand Replay System
- [ ] Design `hand_replays` Supabase table
- [ ] Create shareable URL format: `s.smarter.poker/h/{handId}`
- [ ] Create `HandReplayPage` component
- [ ] Hand summary view
- [ ] Hand detail view with player rows
- [ ] Playback scrubber with step-through
- [ ] Share functionality
- [ ] Video replay animation mode

---

## 📁 NEW FILES TO CREATE

### Components
```
src/poker/components/
├── lobby/
│   ├── CashGamesLobby.tsx
│   ├── TournamentsLobby.tsx
│   └── LobbyTabs.tsx
├── tournament/
│   ├── TournamentDetailsPage.tsx
│   ├── TournamentSignUpModal.tsx
│   ├── TournamentCountdown.tsx
│   ├── TournamentInfoList.tsx
│   └── TournamentTabBar.tsx
├── cash/
│   ├── CashBuyInModal.tsx
│   └── CashTableCard.tsx
├── replay/
│   ├── HandReplayPage.tsx
│   ├── HandSummaryView.tsx
│   ├── HandDetailView.tsx
│   ├── ReplayPlayerRow.tsx
│   └── ReplayScrubber.tsx
└── auth/
    └── HubAuthProvider.tsx
```

### Hooks
```
src/poker/hooks/
├── useHubAuth.ts
├── useTournament.ts
└── useHandReplay.ts
```

---

## 🚀 STARTING NOW: Phase 1 — Hub Auth Handshake
