# 🎰 PokerBros-Style Table UI Rebuild
## Reference: PokerBros Mobile App
## Date: 2026-01-12

---

## 🎨 VISUAL DESIGN ANALYSIS

### Table Shape & Styling
- **Oval/Pill shape** table (not rectangular)
- **Gold rim lighting** effect around table edge
- **Dark felt texture** (diamond pattern on dark green/teal)
- **3D depth effect** with shadows
- **Dark blue background** with subtle diamond pattern

### Player Seats (6-max layout)
- **Circular avatars** with custom images (sharks, emojis, photos)
- **"+" button** when seat is empty
- **Player name** below avatar
- **Chip stack** in colored text (green/gold) below name
- **"D" dealer button** - gold circle with D
- **"SB" / "BB"** blind indicators
- **"New" badge** for recently joined players
- **Bet chip** displayed between player and pot

### Hero Section (Bottom Position)
- **Large hole cards** visible (bigger than opponents')
- **Cards fan out** slightly
- **Yellow highlight box** around hero seat
- **Timer indicator** (20s countdown with progress)

### Pot & Center
- **"POT"** label with amount
- **Community cards** row (when dealt)
- **Game info overlay**: "NLH", "CLASSIC HOLD'EM", "Blinds: 5/10"

### Action Buttons
- **Fold** (red button)
- **Check/Call** (blue button)
- **Raise** (orange button)
- When raising: **2X, 3X, 4X presets** + **Confirm**
- **+/- buttons** for fine-tuning bet amount

### Header Elements
- **Hamburger menu** (☰)
- **Jackpot display** (JACKPOT 000,139,381)
- **Challenges, Lucky Draw, Bonus** icons
- **Help (?)** button
- **Hand history** button
- **Table ID** number

### Slide-Out Menu
- Cashier
- Top Up
- Table Settings
- Sounds
- Vibrations (toggle)
- Share
- VIP
- Exit

### Stats Panel
- Real-time timer
- Game Name, Game ID, Table creation
- Blinds, Restriction info
- Profile Data: Buy-in, Winnings, VPIP
- Observers list

---

## 🚀 IMPLEMENTATION PHASES

### Phase 1: Table Visual Overhaul
- [ ] Create oval SVG table with gold rim glow
- [ ] Add dark felt texture with diamond pattern
- [ ] Implement 3D depth/shadow effect
- [ ] Add background diamond pattern

### Phase 2: Player Seat Redesign
- [ ] Circular avatar containers
- [ ] "+" button for empty seats
- [ ] Chip stack display styling
- [ ] Dealer button (D), SB/BB badges
- [ ] "New" player badge
- [ ] Bet chip display on table

### Phase 3: Hero Section
- [ ] Large card display for hero
- [ ] Yellow highlight box when hero's turn
- [ ] Action timer with visual countdown
- [ ] Card fan animation

### Phase 4: Action Controls
- [ ] Redesign Fold/Check/Raise buttons
- [ ] Add 2X, 3X, 4X, Pot, All-In presets
- [ ] +/- bet adjustment buttons
- [ ] Confirm button for raises

### Phase 5: Menu & Panels
- [ ] Slide-out hamburger menu
- [ ] Stats panel with real-time data
- [ ] Observers list
- [ ] Share functionality

### Phase 6: Polish
- [ ] Chip animations
- [ ] Card dealing animations
- [ ] Winner celebration effects
- [ ] Sound integration

---

## 📂 FILES TO CREATE/MODIFY

1. `src/poker/components/PokerTablePremium.tsx` - New premium table component
2. `src/poker/components/PlayerSeatPremium.tsx` - Redesigned seat component
3. `src/poker/components/ActionControls.tsx` - New betting controls
4. `src/poker/components/TableMenu.tsx` - Slide-out menu
5. `src/poker/components/StatsPanel.tsx` - Real-time stats
6. `src/styles/table-premium.css` - New table styles

---

## 🎯 STARTING NOW: Phase 1 - Table Visual
