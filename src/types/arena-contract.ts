/**
 * 💎 THE DIAMOND VAULT — GLOBAL STATE CONTRACT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * TypeScript interfaces for Diamond Arena users.
 * Tracks XP, Diamond Multipliers, Daily Streaks.
 * Enforces 85% Mastery Gate for level progression.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 HARD LAW CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * HARD LAW: 85% Mastery Gate
 * Players MUST achieve 85% accuracy to advance to the next level.
 * This value is immutable and enforced across all training modes.
 */
export const MASTERY_GATE_THRESHOLD = 0.85;

/**
 * HARD LAW: 25% Burn Rate
 * All marketplace and arcade transactions burn 25% of diamonds.
 */
export const BURN_RATE = 0.25;

/**
 * HARD LAW: Streak Multipliers
 * Fixed multiplier values that cannot be modified.
 */
export const STREAK_MULTIPLIERS = {
    COLD: { minDays: 0, maxDays: 2, multiplier: 1.00, label: '❄️ No Streak' },
    WARMING: { minDays: 3, maxDays: 6, multiplier: 1.20, label: '🔥 3-Day Streak' },
    HOT: { minDays: 7, maxDays: 13, multiplier: 1.50, label: '🔥🔥 7-Day Streak' },
    BLAZING: { minDays: 14, maxDays: 29, multiplier: 1.75, label: '🔥🔥🔥 Blazing' },
    LEGENDARY: { minDays: 30, maxDays: Infinity, multiplier: 2.00, label: '👑 30-Day Legend' },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ USER & PROFILE INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Core Arena User contract
 */
export interface ArenaUser {
    id: string;
    email: string;
    username: string;
    avatarUrl?: string;
    createdAt: Date;
    lastActiveAt: Date;
}

/**
 * XP & Progression state
 */
export interface XPState {
    /** Total XP earned (IMMUTABLE - can never decrease) */
    xpTotal: number;

    /** Current level (1-100) */
    level: number;

    /** XP required for next level */
    xpToNextLevel: number;

    /** Progress percentage to next level (0-100) */
    levelProgress: number;

    /** Skill tier derived from level */
    skillTier: SkillTier;
}

/**
 * Diamond currency state
 */
export interface DiamondState {
    /** Current diamond balance */
    balance: number;

    /** Lifetime diamonds earned */
    lifetimeEarned: number;

    /** Lifetime diamonds spent */
    lifetimeSpent: number;

    /** Lifetime diamonds burned (25% burn law) */
    lifetimeBurned: number;
}

/**
 * Streak & multiplier state
 */
export interface StreakState {
    /** Current consecutive login days */
    streakDays: number;

    /** Current multiplier value */
    multiplier: number;

    /** Streak tier name */
    streakTier: keyof typeof STREAK_MULTIPLIERS;

    /** Streak tier label with emoji */
    streakLabel: string;

    /** Days until next tier */
    daysToNextTier: number;

    /** Last activity timestamp */
    lastActivityAt: Date;

    /** Has logged in today */
    hasLoggedInToday: boolean;
}

/**
 * Mastery Gate state (85% HARD LAW)
 */
export interface MasteryState {
    /** Current mastery rate (0-1) */
    masteryRate: number;

    /** Has achieved 85% mastery for current level */
    hasMastery: boolean;

    /** Number of questions answered correctly */
    correctAnswers: number;

    /** Total questions attempted */
    totalAnswers: number;

    /** Current level being trained */
    currentTrainingLevel: number;

    /** Can advance to next level */
    canAdvance: boolean;

    /** Mastery percentage required (always 85) */
    requiredMastery: number;
}

/**
 * Full Arena User with all state contracts
 */
export interface FullArenaUser extends ArenaUser {
    xp: XPState;
    diamonds: DiamondState;
    streak: StreakState;
    mastery: MasteryState;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎮 TRAINING & LEVEL INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Training level configuration
 */
export interface TrainingLevel {
    id: string;
    levelNumber: number;
    name: string;
    description: string;

    /** Difficulty multiplier (1.0 - 3.0) */
    difficulty: number;

    /** Minimum score to pass (HARD LAW: 0.85) */
    minScore: typeof MASTERY_GATE_THRESHOLD;

    /** Questions per session */
    questionsCount: number;

    /** XP reward for completion */
    xpReward: number;

    /** Diamond reward for completion */
    diamondReward: number;

    /** Is level locked */
    isLocked: boolean;

    /** Has been completed */
    isCompleted: boolean;

    /** Best score achieved */
    bestScore: number | null;
}

/**
 * Training session state
 */
export interface TrainingSession {
    id: string;
    levelId: string;
    userId: string;
    startedAt: Date;
    completedAt?: Date;

    /** Current question index */
    currentQuestion: number;

    /** Total questions in session */
    totalQuestions: number;

    /** Correct answers so far */
    correctCount: number;

    /** Current accuracy rate */
    currentAccuracy: number;

    /** Is passing (>= 85%) */
    isPassing: boolean;

    /** Session status */
    status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
}

/**
 * Training answer result
 */
export interface TrainingAnswer {
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;

    /** GTO explanation */
    gtoExplanation: string;

    /** EV difference from optimal */
    evDelta: number;

    /** Time taken (ms) */
    responseTimeMs: number;

    /** Was a "leak" detected */
    isLeak: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 SKILL TIERS
// ═══════════════════════════════════════════════════════════════════════════

export type SkillTier =
    | 'NOVICE'
    | 'APPRENTICE'
    | 'JOURNEYMAN'
    | 'EXPERT'
    | 'MASTER'
    | 'GRANDMASTER'
    | 'LEGEND';

export const SKILL_TIER_THRESHOLDS: Record<SkillTier, { minLevel: number; icon: string; color: string }> = {
    NOVICE: { minLevel: 1, icon: '🌱', color: '#888888' },
    APPRENTICE: { minLevel: 5, icon: '🥉', color: '#CD7F32' },
    JOURNEYMAN: { minLevel: 15, icon: '🥈', color: '#C0C0C0' },
    EXPERT: { minLevel: 30, icon: '🥇', color: '#FFD700' },
    MASTER: { minLevel: 50, icon: '💎', color: '#00E0FF' },
    GRANDMASTER: { minLevel: 75, icon: '👑', color: '#9400D3' },
    LEGEND: { minLevel: 100, icon: '🏆', color: '#FF3E3E' },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 ARENA ACTIONS (State Mutations)
// ═══════════════════════════════════════════════════════════════════════════

export interface ArenaActions {
    // XP Actions
    addXP: (amount: number, source: string) => Promise<void>;

    // Diamond Actions
    addDiamonds: (amount: number, source: string, applyMultiplier?: boolean) => Promise<void>;
    spendDiamonds: (amount: number, purpose: string) => Promise<boolean>;

    // Streak Actions
    updateStreak: () => Promise<void>;

    // Training Actions
    startTrainingSession: (levelId: string) => Promise<TrainingSession>;
    submitAnswer: (sessionId: string, answer: TrainingAnswer) => Promise<void>;
    completeSession: (sessionId: string) => Promise<{ passed: boolean; xpEarned: number; diamondsEarned: number }>;

    // Mastery Actions
    checkMasteryGate: () => boolean;
    unlockNextLevel: () => Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate skill tier from level
 */
export function getSkillTier(level: number): SkillTier {
    const tiers = Object.entries(SKILL_TIER_THRESHOLDS).reverse();
    for (const [tier, config] of tiers) {
        if (level >= config.minLevel) {
            return tier as SkillTier;
        }
    }
    return 'NOVICE';
}

/**
 * Calculate streak multiplier from days
 */
export function getStreakMultiplier(days: number): { multiplier: number; tier: keyof typeof STREAK_MULTIPLIERS; label: string } {
    for (const [tier, config] of Object.entries(STREAK_MULTIPLIERS)) {
        if (days >= config.minDays && days <= config.maxDays) {
            return {
                multiplier: config.multiplier,
                tier: tier as keyof typeof STREAK_MULTIPLIERS,
                label: config.label,
            };
        }
    }
    return { multiplier: 1.0, tier: 'COLD', label: STREAK_MULTIPLIERS.COLD.label };
}

/**
 * Check if mastery gate is passed
 */
export function checkMasteryGate(correctAnswers: number, totalAnswers: number): boolean {
    if (totalAnswers === 0) return false;
    return (correctAnswers / totalAnswers) >= MASTERY_GATE_THRESHOLD;
}

/**
 * Calculate XP required for a given level
 */
export function getXPForLevel(level: number): number {
    // Exponential curve: 100 * level^1.5
    return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Calculate level from total XP
 */
export function getLevelFromXP(totalXP: number): { level: number; xpInLevel: number; xpToNext: number; progress: number } {
    let level = 1;
    let xpRemaining = totalXP;

    while (true) {
        const xpRequired = getXPForLevel(level);
        if (xpRemaining < xpRequired) {
            const progress = (xpRemaining / xpRequired) * 100;
            return {
                level,
                xpInLevel: xpRemaining,
                xpToNext: xpRequired - xpRemaining,
                progress: Math.floor(progress),
            };
        }
        xpRemaining -= xpRequired;
        level++;

        // Cap at level 100
        if (level > 100) {
            return { level: 100, xpInLevel: 0, xpToNext: 0, progress: 100 };
        }
    }
}

/**
 * Apply burn rate to amount
 */
export function applyBurnRate(amount: number): { netAmount: number; burnedAmount: number } {
    const burnedAmount = Math.floor(amount * BURN_RATE);
    return {
        netAmount: amount - burnedAmount,
        burnedAmount,
    };
}

/**
 * Create default mastery state
 */
export function createDefaultMasteryState(): MasteryState {
    return {
        masteryRate: 0,
        hasMastery: false,
        correctAnswers: 0,
        totalAnswers: 0,
        currentTrainingLevel: 1,
        canAdvance: false,
        requiredMastery: MASTERY_GATE_THRESHOLD * 100, // 85
    };
}

/**
 * Create default streak state
 */
export function createDefaultStreakState(): StreakState {
    return {
        streakDays: 0,
        multiplier: 1.0,
        streakTier: 'COLD',
        streakLabel: STREAK_MULTIPLIERS.COLD.label,
        daysToNextTier: 3,
        lastActivityAt: new Date(),
        hasLoggedInToday: true,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
    MASTERY_GATE_THRESHOLD,
    BURN_RATE,
    STREAK_MULTIPLIERS,
    SKILL_TIER_THRESHOLDS,
    getSkillTier,
    getStreakMultiplier,
    checkMasteryGate,
    getXPForLevel,
    getLevelFromXP,
    applyBurnRate,
    createDefaultMasteryState,
    createDefaultStreakState,
};
