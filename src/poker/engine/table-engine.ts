/**
 * 🎰 POKER TABLE ENGINE — GAME STATE MACHINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Full Texas Hold'em game logic with proper betting rounds,
 * side pot calculations, and showdown handling.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type {
    Card,
    Player,
    PlayerAction,
    ActionType,
    TableState,
    TableConfig,
    Street,
    Pot,
    HandHistoryEntry,
    EvaluatedHand,
} from '../types/poker';
import { Deck } from './deck';
import { evaluateHand, determineWinners } from './hand-evaluator';

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 TABLE ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class PokerTableEngine {
    private state: TableState;
    private deck: Deck;
    private eventListeners: Map<string, ((event: any) => void)[]> = new Map();

    constructor(config: TableConfig) {
        this.deck = new Deck();
        this.state = {
            config,
            seats: new Array(config.tableSize).fill(null),
            handNumber: 0,
            street: 'WAITING',
            dealerSeat: 0,
            smallBlindSeat: 0,
            bigBlindSeat: 0,
            communityCards: [],
            deck: [],
            pots: [],
            currentBet: 0,
            minRaise: config.bigBlind,
            activePlayerSeat: null,
            lastAggressorSeat: null,
            actionTimeout: null,
            handHistory: [],
            isRunning: true,
            isPaused: false,
            spectatorCount: 0,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📊 STATE GETTERS
    // ═══════════════════════════════════════════════════════════════════════

    getState(): TableState {
        return { ...this.state };
    }

    getPublicState(): Omit<TableState, 'deck'> {
        const { deck, ...publicState } = this.state;
        // Hide other players' hole cards
        const seats = this.state.seats.map(player => {
            if (!player) return null;
            return {
                ...player,
                holeCards: player.isHero ? player.holeCards : null,
            };
        });
        return { ...publicState, seats };
    }

    getPlayerState(playerId: string): Omit<TableState, 'deck'> {
        const { deck, ...publicState } = this.state;
        // Show only this player's hole cards (unless showdown)
        const seats = this.state.seats.map(player => {
            if (!player) return null;
            const showCards = player.id === playerId || this.state.street === 'SHOWDOWN';
            return {
                ...player,
                holeCards: showCards ? player.holeCards : null,
                isHero: player.id === playerId,
            };
        });
        return { ...publicState, seats };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 👤 SEAT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    seatPlayer(player: Omit<Player, 'seatNumber'>, seatNumber: number): boolean {
        if (seatNumber < 1 || seatNumber > this.state.config.tableSize) {
            return false;
        }

        const seatIndex = seatNumber - 1;
        if (this.state.seats[seatIndex] !== null) {
            return false; // Seat taken
        }

        if (player.chipStack < this.state.config.minBuyIn) {
            return false; // Insufficient buy-in
        }

        if (player.chipStack > this.state.config.maxBuyIn) {
            return false; // Exceeds max buy-in
        }

        this.state.seats[seatIndex] = {
            ...player,
            seatNumber,
            currentBet: 0,
            totalBetThisHand: 0,
            holeCards: null,
            status: 'WAITING',
            isDealer: false,
            isTurn: false,
            timeBank: 30,
        };

        this.emit('PLAYER_JOINED', { player: this.state.seats[seatIndex] });
        return true;
    }

    removePlayer(seatNumber: number): Player | null {
        const seatIndex = seatNumber - 1;
        const player = this.state.seats[seatIndex];

        if (!player) return null;

        this.state.seats[seatIndex] = null;
        this.emit('PLAYER_LEFT', { player });

        return player;
    }

    getSeatedPlayers(): Player[] {
        return this.state.seats.filter((p): p is Player => p !== null);
    }

    getActivePlayers(): Player[] {
        return this.getSeatedPlayers().filter(
            p => p.status === 'ACTIVE' || p.status === 'ALL_IN'
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎬 HAND LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    canStartHand(): boolean {
        const waitingPlayers = this.getSeatedPlayers().filter(
            p => p.status === 'WAITING' && p.chipStack > 0
        );
        return waitingPlayers.length >= 2 && this.state.street === 'WAITING';
    }

    startNewHand(): boolean {
        if (!this.canStartHand()) return false;

        // Reset for new hand
        this.state.handNumber++;
        this.state.handHistory = [];
        this.state.communityCards = [];
        this.state.pots = [{ amount: 0, eligiblePlayers: [], isMainPot: true, isClosed: false }];
        this.state.currentBet = 0;
        this.state.minRaise = this.state.config.bigBlind;
        this.state.lastAggressorSeat = null;

        // Prepare deck
        this.deck.reset();
        this.deck.shuffle();

        // Activate players
        const playersInHand: Player[] = [];
        for (const player of this.state.seats) {
            if (player && player.status === 'WAITING' && player.chipStack > 0) {
                player.status = 'ACTIVE';
                player.currentBet = 0;
                player.totalBetThisHand = 0;
                player.holeCards = null;
                player.lastAction = undefined;
                playersInHand.push(player);
            }
        }

        // Set up eligible players for main pot
        this.state.pots[0].eligiblePlayers = playersInHand.map(p => p.id);

        // Move dealer button
        this.advanceDealer();

        // Set blinds positions
        this.setBlindPositions();

        // Post blinds
        this.postBlinds();

        // Deal hole cards
        this.dealHoleCards();

        // Set first to act
        this.state.street = 'PREFLOP';
        this.setNextToAct();

        this.logHistory('SYSTEM', undefined, undefined, undefined, 'Hand started');

        return true;
    }

    private advanceDealer(): void {
        const seatedPlayers = this.getSeatedPlayers();
        if (seatedPlayers.length === 0) return;

        // Clear current dealer
        for (const player of this.state.seats) {
            if (player) player.isDealer = false;
        }

        // Find next dealer
        let dealerIndex = this.state.dealerSeat;
        do {
            dealerIndex = (dealerIndex % this.state.config.tableSize) + 1;
        } while (!this.state.seats[dealerIndex - 1]?.status);

        this.state.dealerSeat = dealerIndex;
        const dealer = this.state.seats[dealerIndex - 1];
        if (dealer) dealer.isDealer = true;
    }

    private setBlindPositions(): void {
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length === 2) {
            // Heads-up: dealer is SB
            this.state.smallBlindSeat = this.state.dealerSeat;
            this.state.bigBlindSeat = this.getNextActiveSeat(this.state.dealerSeat);
        } else {
            // Normal: SB is left of dealer
            this.state.smallBlindSeat = this.getNextActiveSeat(this.state.dealerSeat);
            this.state.bigBlindSeat = this.getNextActiveSeat(this.state.smallBlindSeat);
        }
    }

    private postBlinds(): void {
        const sb = this.state.seats[this.state.smallBlindSeat - 1];
        const bb = this.state.seats[this.state.bigBlindSeat - 1];

        if (sb) {
            const sbAmount = Math.min(sb.chipStack, this.state.config.smallBlind);
            this.placeBet(sb, sbAmount);
            this.logHistory('ACTION', sb.id, 'BET', sbAmount);
        }

        if (bb) {
            const bbAmount = Math.min(bb.chipStack, this.state.config.bigBlind);
            this.placeBet(bb, bbAmount);
            this.state.currentBet = bbAmount;
            this.logHistory('ACTION', bb.id, 'BET', bbAmount);
        }
    }

    private dealHoleCards(): void {
        // Deal 2 cards to each active player
        for (let round = 0; round < 2; round++) {
            for (const player of this.state.seats) {
                if (player && player.status === 'ACTIVE') {
                    const card = this.deck.deal();
                    if (card) {
                        player.holeCards = player.holeCards || [];
                        player.holeCards.push(card);
                    }
                }
            }
        }

        this.logHistory('CARD_DEALT', undefined, undefined, undefined, undefined, 'Hole cards dealt');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 PLAYER ACTIONS
    // ═══════════════════════════════════════════════════════════════════════

    getValidActions(seatNumber: number): { action: ActionType; minAmount?: number; maxAmount?: number }[] {
        const player = this.state.seats[seatNumber - 1];
        if (!player || !player.isTurn || player.status !== 'ACTIVE') {
            return [];
        }

        const actions: { action: ActionType; minAmount?: number; maxAmount?: number }[] = [];
        const toCall = this.state.currentBet - player.currentBet;

        // Can always fold (unless nothing to call)
        if (toCall > 0) {
            actions.push({ action: 'FOLD' });
        }

        // Check (if nothing to call)
        if (toCall === 0) {
            actions.push({ action: 'CHECK' });
        }

        // Call (if there's a bet to match)
        if (toCall > 0 && toCall < player.chipStack) {
            actions.push({ action: 'CALL', minAmount: toCall, maxAmount: toCall });
        }

        // Bet (if no current bet)
        if (this.state.currentBet === 0) {
            actions.push({
                action: 'BET',
                minAmount: this.state.config.bigBlind,
                maxAmount: player.chipStack,
            });
        }

        // Raise (if there's a bet)
        if (this.state.currentBet > 0 && player.chipStack > toCall) {
            const minRaise = this.state.currentBet + this.state.minRaise;
            actions.push({
                action: 'RAISE',
                minAmount: minRaise,
                maxAmount: player.chipStack + player.currentBet,
            });
        }

        // All-in (always available if has chips)
        if (player.chipStack > 0) {
            actions.push({
                action: 'ALL_IN',
                minAmount: player.chipStack,
                maxAmount: player.chipStack,
            });
        }

        return actions;
    }

    processAction(seatNumber: number, action: ActionType, amount?: number): boolean {
        const player = this.state.seats[seatNumber - 1];
        if (!player || !player.isTurn) return false;

        const validActions = this.getValidActions(seatNumber);
        const isValid = validActions.some(a => a.action === action);
        if (!isValid) return false;

        switch (action) {
            case 'FOLD':
                player.status = 'FOLDED';
                player.lastAction = { type: 'FOLD', timestamp: new Date() };
                this.logHistory('ACTION', player.id, 'FOLD');
                break;

            case 'CHECK':
                player.lastAction = { type: 'CHECK', timestamp: new Date() };
                this.logHistory('ACTION', player.id, 'CHECK');
                break;

            case 'CALL': {
                const toCall = Math.min(
                    this.state.currentBet - player.currentBet,
                    player.chipStack
                );
                this.placeBet(player, toCall);
                player.lastAction = { type: 'CALL', amount: toCall, timestamp: new Date() };
                this.logHistory('ACTION', player.id, 'CALL', toCall);

                if (player.chipStack === 0) {
                    player.status = 'ALL_IN';
                }
                break;
            }

            case 'BET':
            case 'RAISE': {
                const betAmount = amount || this.state.config.bigBlind;
                const totalBet = action === 'RAISE' ? betAmount : betAmount + player.currentBet;
                const actualBet = totalBet - player.currentBet;

                this.state.minRaise = totalBet - this.state.currentBet;
                this.state.currentBet = totalBet;
                this.state.lastAggressorSeat = seatNumber;

                this.placeBet(player, actualBet);
                player.lastAction = { type: action, amount: totalBet, timestamp: new Date() };
                this.logHistory('ACTION', player.id, action, totalBet);
                break;
            }

            case 'ALL_IN': {
                const allInAmount = player.chipStack;
                const newTotal = player.currentBet + allInAmount;

                if (newTotal > this.state.currentBet) {
                    this.state.minRaise = newTotal - this.state.currentBet;
                    this.state.currentBet = newTotal;
                    this.state.lastAggressorSeat = seatNumber;
                }

                this.placeBet(player, allInAmount);
                player.status = 'ALL_IN';
                player.lastAction = { type: 'ALL_IN', amount: allInAmount, timestamp: new Date() };
                this.logHistory('ACTION', player.id, 'ALL_IN', allInAmount);
                break;
            }
        }

        this.emit('PLAYER_ACTION', { player, action, amount });

        // Check if betting round is complete
        if (this.isBettingRoundComplete()) {
            this.advanceStreet();
        } else {
            this.setNextToAct();
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 💰 POT MANAGEMENT & SIDE POTS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Deducts chips from player but DEFERS adding to pot structure until end of round.
     * Updates 'currentBet' and 'totalBetThisHand'.
     */
    private placeBet(player: Player, amount: number): void {
        const actualAmount = Math.min(amount, player.chipStack);
        player.chipStack -= actualAmount;
        player.currentBet += actualAmount;
        player.totalBetThisHand += actualAmount;

        // Note: We do NOT add to state.pots[] here directly for logical splitting.
        // However, for VISUAL purposes (showing pot grow), we can treat pots[0] as the "active pile"
        // But true reconciliation happens in collectBets().
        // For simplicity in UI, we can accumulate loosely in pots[0] but clear/rebuild in collectBets.
        if (this.state.pots.length > 0) {
            // Find the latest open pot or just the last one
            const lastPot = this.state.pots[this.state.pots.length - 1];
            if (!lastPot.isClosed) {
                lastPot.amount += actualAmount;
            }
        }
    }

    /**
     * Consolidates all betting action from the current street into Main and Side Pots.
     * Handles complex multi-way all-in scenarios.
     */
    private collectBets(): void {
        const contributors = this.state.seats.filter(p => p && p.currentBet > 0) as Player[];
        if (contributors.length === 0) return;

        // 1. Remove the "visual" accumulation from placeBet to prevent double counting
        // We will rebuild the pot structure for this round's bets.
        let totalStreetBets = 0;
        contributors.forEach(p => totalStreetBets += p.currentBet);

        // Subtract this "loose" money from the display pot (usually pots[last]) to redistribute it properly
        // This is a bit hacky but ensures we transition from "Simple Display" to "Strict Logic"
        if (this.state.pots.length > 0) {
            this.state.pots[this.state.pots.length - 1].amount -= totalStreetBets;
            if (this.state.pots[this.state.pots.length - 1].amount < 0) {
                // Should not happen if logic is tight
                this.state.pots[this.state.pots.length - 1].amount = 0;
            }
        }

        // 2. Sort contributors by bet amount (ascending) to identify "tiers"
        contributors.sort((a, b) => a.currentBet - b.currentBet);

        let previouslyProcessedBet = 0;

        for (const player of contributors) {
            const betForThisLevel = player.currentBet - previouslyProcessedBet;
            if (betForThisLevel <= 0) continue;

            // Find all players who bet *at least* this amount (including this player)
            // Since they are sorted, it is this player and everyone after.
            const participatingPlayers = contributors.filter(p => p.currentBet >= player.currentBet);

            // Calculate how much money goes into the pot at this "level"
            const potContribution = betForThisLevel * participatingPlayers.length;

            // 3. Find or Create the Active Pot
            // We look for the last pot. If it's closed (capped by a previous all-in), we make a new one.
            let activePot = this.state.pots[this.state.pots.length - 1];

            // If no pots exist or last one is closed, create new
            if (!activePot || activePot.isClosed) {
                activePot = {
                    amount: 0,
                    eligiblePlayers: participatingPlayers.map(p => p.id),
                    isMainPot: this.state.pots.length === 0,
                    isClosed: false
                };
                this.state.pots.push(activePot);
            } else {
                // If it's open, ensure current participants are eligible (should be intersected/unioned?)
                // Actually, eligiblePlayers is usually set at creation.
                // For Side Pots, we just add money here.
            }

            activePot.amount += potContribution;

            // 4. Handle Capping (All-In)
            // If this player is All-In, they cannot win any MORE money than this level.
            // So we CLOSE this pot. Future bets (higher amounts) go to a NEW pot.
            if (player.status === 'ALL_IN') {
                activePot.isClosed = true;

                // Ensure only eligible players are listed (strictly those who contributed to this level)
                // Filter out anyone who folded? No, `contributors` only has active/all-in/folded players who bet.
                // But `eligiblePlayers` tracks who can WIN.

                // Important: Update eligiblePlayers to intersection of current eligible & participants?
                // Or just trust the initialization logic?
                // Let's ensure eligiblePlayers is correct for the closed pot.

                // Next pot candidates: Everyone who bet MORE than this player
                const remainingPlayers = participatingPlayers.filter(p => p.id !== player.id && p.currentBet > player.currentBet);

                if (remainingPlayers.length > 0) {
                    // Create the NEXT side pot immediately for the overflow
                    this.state.pots.push({
                        amount: 0,
                        eligiblePlayers: remainingPlayers.map(p => p.id),
                        isMainPot: false,
                        isClosed: false
                    });
                }
            }

            previouslyProcessedBet = player.currentBet;
        }

        // 5. Reset current bets for next street
        for (const player of this.state.seats) {
            if (player) player.currentBet = 0;
        }
        this.state.currentBet = 0;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 TURN MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    private getNextActiveSeat(fromSeat: number): number {
        let current = fromSeat;
        for (let i = 0; i < this.state.config.tableSize; i++) {
            current = (current % this.state.config.tableSize) + 1;
            const player = this.state.seats[current - 1];
            if (player && (player.status === 'ACTIVE' || player.status === 'ALL_IN')) {
                return current;
            }
        }
        return fromSeat;
    }

    private setNextToAct(): void {
        // Clear current turn
        for (const player of this.state.seats) {
            if (player) player.isTurn = false;
        }

        if (this.state.street === 'WAITING' || this.state.street === 'SHOWDOWN') {
            this.state.activePlayerSeat = null;
            return;
        }

        // Find next player who needs to act
        let startSeat: number;

        if (this.state.street === 'PREFLOP') {
            // UTG is after BB
            startSeat = this.state.activePlayerSeat || this.state.bigBlindSeat;
        } else {
            // After flop, start from SB (or first active after dealer)
            startSeat = this.state.activePlayerSeat || this.state.dealerSeat;
        }

        let nextSeat = this.getNextActiveSeat(startSeat);
        const player = this.state.seats[nextSeat - 1];

        if (player && player.status === 'ACTIVE') {
            player.isTurn = true;
            this.state.activePlayerSeat = nextSeat;
            this.state.actionTimeout = new Date(Date.now() + this.state.config.timeLimit * 1000);
            this.emit('PLAYER_TURN', { player, timeout: this.state.actionTimeout });
        }
    }

    private isBettingRoundComplete(): boolean {
        const activePlayers = this.getActivePlayers().filter(p => p.status === 'ACTIVE');

        // All but one folded
        if (activePlayers.length <= 1) return true;

        // Everyone has matched the current bet or is all-in
        for (const player of activePlayers) {
            if (player.status === 'ACTIVE') {
                // Player hasn't acted yet
                if (!player.lastAction) return false;
                // Player hasn't matched current bet
                if (player.currentBet < this.state.currentBet) return false;
            }
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎴 STREET PROGRESSION
    // ═══════════════════════════════════════════════════════════════════════

    private advanceStreet(): void {
        // 1. Process all bets into pots first
        this.collectBets();

        // Check for early winner (all folded)
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length === 1) {
            this.awardPot(activePlayers[0]);
            this.endHand();
            return;
        }

        // All players all-in - run out remaining streets
        const playersStillActing = activePlayers.filter(p => p.status === 'ACTIVE');
        const runOut = playersStillActing.length <= 1;

        // Reset betting for new street
        for (const player of this.state.seats) {
            if (player) {
                player.currentBet = 0;
                player.lastAction = undefined;
            }
        }
        this.state.currentBet = 0;
        this.state.minRaise = this.state.config.bigBlind;
        this.state.activePlayerSeat = null;

        switch (this.state.street) {
            case 'PREFLOP':
                this.dealFlop();
                this.state.street = 'FLOP';
                break;
            case 'FLOP':
                this.dealTurn();
                this.state.street = 'TURN';
                break;
            case 'TURN':
                this.dealRiver();
                this.state.street = 'RIVER';
                break;
            case 'RIVER':
                this.goToShowdown();
                return;
        }

        this.logHistory('STREET_CHANGE', undefined, undefined, undefined, this.state.communityCards,
            `${this.state.street} dealt`);
        this.emit('STREET_CHANGED', { street: this.state.street, cards: this.state.communityCards });

        if (!runOut) {
            this.setNextToAct();
        } else {
            // Run out remaining cards automatically
            // Add a small delay for visual purity
            setTimeout(() => this.advanceStreet(), 1000);
        }
    }

    private dealFlop(): void {
        this.deck.burn();
        const cards = this.deck.dealMultiple(3);
        this.state.communityCards.push(...cards);
    }

    private dealTurn(): void {
        this.deck.burn();
        const card = this.deck.deal();
        if (card) this.state.communityCards.push(card);
    }

    private dealRiver(): void {
        this.deck.burn();
        const card = this.deck.deal();
        if (card) this.state.communityCards.push(card);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🏆 SHOWDOWN & POT DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════

    private goToShowdown(): void {
        this.state.street = 'SHOWDOWN';
        this.logHistory('STREET_CHANGE', undefined, undefined, undefined, undefined, 'Showdown');

        // Evaluate all hands
        const contenders: { id: string; player: Player; hand: EvaluatedHand }[] = [];

        for (const player of this.getSeatedPlayers()) {
            // Include anyone who is NOT folded and who has cards
            if (player.status !== 'FOLDED' && player.status !== 'SITTING_OUT' && player.status !== 'WAITING' && player.holeCards) {
                const allCards = [...player.holeCards, ...this.state.communityCards];
                const hand = evaluateHand(allCards);
                contenders.push({ id: player.id, player, hand });
            }
        }

        const allWinners: any[] = [];
        let totalDistributed = 0;

        // Iterate through all pots (Main + Side Pots)
        this.state.pots.forEach((pot, potIndex) => {
            if (pot.amount === 0) return;

            // Filter contenders eligible for this specific pot
            const potContenders = contenders.filter(c => pot.eligiblePlayers.includes(c.id));

            if (potContenders.length === 0) {
                console.error(`Pot ${potIndex} has no eligible contenders.`);
                return;
            }

            // Determine winner(s) just for this pot
            const winnerData = determineWinners(potContenders.map(c => ({ id: c.id, hand: c.hand })));
            const potWinners = potContenders.filter(c => winnerData.some(w => w.id === c.id));

            if (potWinners.length === 0) return;

            const winAmount = Math.floor(pot.amount / potWinners.length);
            const remainder = pot.amount % potWinners.length;

            potWinners.forEach((winner, index) => {
                const prize = winAmount + (index === 0 ? remainder : 0);
                winner.player.chipStack += prize;
                totalDistributed += prize;

                this.logHistory('WINNER', winner.player.id, undefined, prize, undefined,
                    `${winner.player.username} wins ${prize} from ${pot.isMainPot ? 'Main Pot' : 'Side Pot #' + potIndex} with ${winner.hand.description}`);

                allWinners.push({ ...winner, prize, potIndex, handDescription: winner.hand.description });
            });
        });

        this.emit('HAND_COMPLETE', { winners: allWinners, pot: totalDistributed });
        this.endHand();
    }

    private awardPot(winner: Player): void {
        const totalAmount = this.state.pots.reduce((sum, pot) => sum + pot.amount, 0);
        winner.chipStack += totalAmount;

        this.logHistory('WINNER', winner.id, undefined, totalAmount, undefined,
            `${winner.username} wins ${totalAmount} (others folded)`);
        this.emit('HAND_COMPLETE', { winners: [winner], pot: totalAmount });
    }

    private endHand(): void {
        // Reset player statuses
        for (const player of this.state.seats) {
            if (player) {
                player.holeCards = null;
                player.currentBet = 0;
                player.totalBetThisHand = 0;
                player.lastAction = undefined;
                player.isTurn = false;

                if (player.chipStack === 0) {
                    player.status = 'WAITING'; // Busted
                } else if (player.status !== 'SITTING_OUT') {
                    player.status = 'WAITING';
                }
            }
        }

        this.state.street = 'WAITING';
        this.state.pots = [];
        this.state.communityCards = [];
        this.state.currentBet = 0;
        this.state.activePlayerSeat = null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📜 HISTORY & EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    private logHistory(
        type: HandHistoryEntry['type'],
        playerId?: string,
        action?: ActionType,
        amount?: number,
        cards?: Card[],
        message?: string
    ): void {
        this.state.handHistory.push({
            handId: `${this.state.config.id}-${this.state.handNumber}`,
            timestamp: new Date(),
            type,
            playerId,
            action,
            amount,
            cards,
            message,
        });
    }

    private emit(type: string, data: any): void {
        const listeners = this.eventListeners.get(type) || [];
        for (const listener of listeners) {
            listener({ type, tableId: this.state.config.id, handNumber: this.state.handNumber, data });
        }
    }

    on(event: string, callback: (data: any) => void): void {
        const listeners = this.eventListeners.get(event) || [];
        listeners.push(callback);
        this.eventListeners.set(event, listeners);
    }

    off(event: string, callback: (data: any) => void): void {
        const listeners = this.eventListeners.get(event) || [];
        this.eventListeners.set(event, listeners.filter(l => l !== callback));
    }
}

export default PokerTableEngine;
