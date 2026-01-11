/**
 * 🎰 ARCADE ROYALE LOGIC ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORB_07] Gameplay mechanics for Blitz GTO and 
 * Memory Poker wagered matches.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Features:
 * - Blitz GTO gameplay with time pressure
 * - Memory Poker pattern matching
 * - Wagered match settlement
 * - Streak multiplier integration
 * 
 * @target Orb 07 - Arcade Royale
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════
// ⚙️ ARCADE CONFIGURATION
// ═══════════════════════════════════════════════════════════

export const ARCADE_CONFIG = {
    // Game modes
    GAME_MODES: {
        BLITZ_GTO: {
            name: 'Blitz GTO',
            timePerQuestion: 5,  // seconds
            questionsPerRound: 10,
            baseMultiplier: 1.0,
            perfectBonus: 2.0
        },
        MEMORY_POKER: {
            name: 'Memory Poker',
            revealTime: 3,  // seconds
            matchesRequired: 6,
            baseMultiplier: 1.0,
            speedBonus: 1.5
        },
        RANGE_BLITZ: {
            name: 'Range Blitz',
            timeLimit: 30,
            rangesRequired: 5,
            baseMultiplier: 1.2
        },
        EV_CHALLENGE: {
            name: 'EV Challenge',
            calculationsRequired: 10,
            marginOfError: 0.05,
            baseMultiplier: 1.5
        }
    },

    // Scoring
    SCORING: {
        CORRECT: 100,
        PERFECT_SPEED: 50,
        STREAK_BONUS: 25,
        PENALTY_WRONG: -25
    },

    // Wager limits
    WAGER: {
        MIN: 10,
        MAX: 10000,
        BURN_RATE: 0.25  // 25% HARD LAW
    }
};

// ═══════════════════════════════════════════════════════════
// 🎰 ARCADE ROYALE LOGIC CLASS
// ═══════════════════════════════════════════════════════════

export class ArcadeRoyaleLogic {

    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('ARCADE_ERROR: Supabase client required');
        }
        this.supabase = supabaseClient;
    }

    // ═══════════════════════════════════════════════════════
    // 🎮 SESSION MANAGEMENT
    // ═══════════════════════════════════════════════════════

    /**
     * Start new arcade session
     * 
     * @param {object} sessionData - Session parameters
     * @returns {Promise<object>} Session start result
     */
    async startSession(sessionData) {
        const { userId, gameMode, wagerAmount } = sessionData;

        // Validate game mode
        if (!ARCADE_CONFIG.GAME_MODES[gameMode]) {
            return { success: false, error: 'INVALID_GAME_MODE' };
        }

        // Validate wager
        if (wagerAmount < ARCADE_CONFIG.WAGER.MIN || wagerAmount > ARCADE_CONFIG.WAGER.MAX) {
            return {
                success: false,
                error: 'INVALID_WAGER',
                limits: { min: ARCADE_CONFIG.WAGER.MIN, max: ARCADE_CONFIG.WAGER.MAX }
            };
        }

        // Calculate wager burn
        const burnAmount = Math.floor(wagerAmount * ARCADE_CONFIG.WAGER.BURN_RATE);
        const netWager = wagerAmount - burnAmount;

        const { data, error } = await this.supabase.rpc('fn_start_arcade_session', {
            p_user_id: userId,
            p_game_mode: gameMode,
            p_wager_amount: wagerAmount,
            p_burn_amount: burnAmount,
            p_net_wager: netWager
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    /**
     * End arcade session with results
     * 
     * @param {object} resultData - Session results
     * @returns {Promise<object>} Settlement result
     */
    async endSession(resultData) {
        const { sessionId, score, correct, total, perfectSpeed, streakBonus } = resultData;

        const { data, error } = await this.supabase.rpc('fn_end_arcade_session', {
            p_session_id: sessionId,
            p_score: score,
            p_correct: correct,
            p_total: total,
            p_perfect_speed: perfectSpeed || 0,
            p_streak_bonus: streakBonus || 0
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return typeof data === 'string' ? JSON.parse(data) : data;
    }

    // ═══════════════════════════════════════════════════════
    // 🧠 BLITZ GTO LOGIC
    // ═══════════════════════════════════════════════════════

    /**
     * Generate Blitz GTO question
     * 
     * @param {string} difficulty - Question difficulty
     * @returns {object} Question data
     */
    static generateBlitzGtoQuestion(difficulty = 'MEDIUM') {
        // Question types for GTO scenarios
        const types = ['PREFLOP_ACTION', 'POSTFLOP_BET_SIZE', 'FOLD_CALL_RAISE', 'RANGE_SELECTION'];
        const type = types[Math.floor(Math.random() * types.length)];

        const timeLimit = ARCADE_CONFIG.GAME_MODES.BLITZ_GTO.timePerQuestion;

        return {
            id: crypto.randomUUID ? crypto.randomUUID() : `q-${Date.now()}`,
            type,
            difficulty,
            timeLimit,
            generated: new Date().toISOString()
        };
    }

    /**
     * Score Blitz GTO answer
     * 
     * @param {object} answer - User's answer
     * @returns {object} Score result
     */
    static scoreBlitzGtoAnswer(answer) {
        const { correct, responseTimeMs, timeLimit } = answer;
        const scoring = ARCADE_CONFIG.SCORING;

        let score = 0;
        let breakdown = [];

        if (correct) {
            score += scoring.CORRECT;
            breakdown.push({ type: 'CORRECT', points: scoring.CORRECT });

            // Speed bonus if answered in under half the time
            if (responseTimeMs < (timeLimit * 1000 / 2)) {
                score += scoring.PERFECT_SPEED;
                breakdown.push({ type: 'PERFECT_SPEED', points: scoring.PERFECT_SPEED });
            }
        } else {
            score += scoring.PENALTY_WRONG;
            breakdown.push({ type: 'WRONG', points: scoring.PENALTY_WRONG });
        }

        return { score, breakdown, correct };
    }

    // ═══════════════════════════════════════════════════════
    // 🃏 MEMORY POKER LOGIC
    // ═══════════════════════════════════════════════════════

    /**
     * Generate Memory Poker board
     * 
     * @param {number} pairs - Number of pairs
     * @returns {object} Board data
     */
    static generateMemoryPokerBoard(pairs = 6) {
        const handTypes = [
            'AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'KQs',
            'AKo', 'AQo', 'KQo', 'JTs', 'T9s', 'QJs', '99', '88'
        ];

        // Select random hands for pairs
        const selectedHands = [];
        const shuffled = [...handTypes].sort(() => Math.random() - 0.5);
        for (let i = 0; i < pairs; i++) {
            selectedHands.push(shuffled[i], shuffled[i]);  // Add pair
        }

        // Shuffle the pairs
        const board = selectedHands.sort(() => Math.random() - 0.5);

        return {
            id: crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}`,
            pairs,
            cards: board.map((hand, idx) => ({
                position: idx,
                hand,
                revealed: false,
                matched: false
            })),
            revealTime: ARCADE_CONFIG.GAME_MODES.MEMORY_POKER.revealTime
        };
    }

    /**
     * Process Memory Poker match attempt
     * 
     * @param {object} attempt - Match attempt
     * @returns {object} Match result
     */
    static processMemoryMatch(attempt) {
        const { card1, card2, attemptTimeMs } = attempt;
        const isMatch = card1.hand === card2.hand;
        const scoring = ARCADE_CONFIG.SCORING;

        let score = 0;
        if (isMatch) {
            score += scoring.CORRECT;

            // Speed bonus for fast matches
            if (attemptTimeMs < 2000) {
                score += scoring.PERFECT_SPEED;
            }
        }

        return {
            isMatch,
            score,
            card1: { ...card1, revealed: true, matched: isMatch },
            card2: { ...card2, revealed: true, matched: isMatch }
        };
    }

    // ═══════════════════════════════════════════════════════
    // 💰 PAYOUT CALCULATION
    // ═══════════════════════════════════════════════════════

    /**
     * Calculate session payout
     * 
     * @param {object} session - Session data
     * @returns {object} Payout calculation
     */
    static calculatePayout(session) {
        const { netWager, score, maxScore, gameMode, streakMultiplier = 1.0 } = session;
        const modeConfig = ARCADE_CONFIG.GAME_MODES[gameMode];

        // Performance multiplier (0 to 2x based on score)
        const performance = maxScore > 0 ? score / maxScore : 0;
        const performanceMultiplier = performance * 2;  // 0% = 0x, 100% = 2x

        // Base payout
        let basePayout = Math.floor(netWager * performanceMultiplier);

        // Apply mode multiplier
        basePayout = Math.floor(basePayout * (modeConfig?.baseMultiplier || 1.0));

        // Apply streak multiplier (from RED silo)
        const finalPayout = Math.floor(basePayout * streakMultiplier);

        // Apply 25% burn to payout
        const payoutBurn = Math.floor(finalPayout * ARCADE_CONFIG.WAGER.BURN_RATE);
        const netPayout = finalPayout - payoutBurn;

        return {
            netWager,
            performance: `${(performance * 100).toFixed(1)}%`,
            performanceMultiplier,
            modeMultiplier: modeConfig?.baseMultiplier || 1.0,
            streakMultiplier,
            grossPayout: finalPayout,
            payoutBurn,
            netPayout,
            profit: netPayout - netWager
        };
    }

    // ═══════════════════════════════════════════════════════
    // 📊 SESSION HISTORY
    // ═══════════════════════════════════════════════════════

    /**
     * Get user's arcade history
     * 
     * @param {string} userId - User UUID
     * @param {number} limit - Max records
     * @returns {Promise<object>} Session history
     */
    async getSessionHistory(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('arcade_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        const stats = this.calculateStats(data || []);

        return {
            success: !error,
            sessions: data || [],
            stats
        };
    }

    /**
     * Calculate session statistics
     */
    calculateStats(sessions) {
        if (sessions.length === 0) return null;

        const totalWagered = sessions.reduce((s, e) => s + (e.wager_amount || 0), 0);
        const totalWon = sessions.reduce((s, e) => s + (e.net_payout || 0), 0);
        const wins = sessions.filter(s => (s.net_payout || 0) > (s.net_wager || 0)).length;

        return {
            totalSessions: sessions.length,
            totalWagered,
            totalWon,
            netResult: totalWon - totalWagered,
            winRate: `${((wins / sessions.length) * 100).toFixed(1)}%`
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════

export default ArcadeRoyaleLogic;
