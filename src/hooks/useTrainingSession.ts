/**
 * 🎮 THE TRAINING SESSION — MASTERY STATE MACHINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Session handler for training games with Hard Law enforcement.
 * 
 * HARD LAWS:
 * • 20 questions per level
 * • 85% correct to advance
 * • No repeated questions on retries
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
    MASTERY_GATE_THRESHOLD,
    checkMasteryGate,
    type TrainingSession,
    type TrainingAnswer,
    type TrainingLevel,
} from '../types/arena-contract';

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 HARD LAW CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const QUESTIONS_PER_LEVEL = 20;           // HARD LAW: Always 20 questions
const MASTERY_THRESHOLD = 0.85;           // HARD LAW: 85% to advance
const MAX_RETRY_QUESTION_OVERLAP = 0.3;   // Max 30% overlap on retries

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface Question {
    id: string;
    scenarioId: string;
    position: string;
    hand: string;
    board: string[];
    potSize: number;
    stackSize: number;
    action: string;
    gtoAnswer: string;
    alternateLines: string[];
    evValues: Record<string, number>;
    difficulty: number;
}

export interface SessionStats {
    totalQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    currentStreak: number;
    bestStreak: number;
    avgResponseTime: number;
    totalEvLoss: number;
}

export interface LeakData {
    hand: string;
    mistakeCount: number;
    totalSeen: number;
    avgEvLoss: number;
    lastMistakeAt: Date | null;
}

export interface TrainingSessionState {
    // Session Info
    sessionId: string | null;
    levelId: string | null;
    userId: string | null;
    status: 'idle' | 'loading' | 'active' | 'paused' | 'completed' | 'failed';

    // Question Pool
    questions: Question[];
    currentQuestionIndex: number;
    answeredQuestionIds: Set<string>;

    // Answers
    answers: TrainingAnswer[];

    // Stats
    stats: SessionStats;

    // Mastery
    isLevelComplete: boolean;
    canAdvance: boolean;
    masteryRate: number;

    // Leak Detection
    leaks: Map<string, LeakData>;

    // Previously Seen (for no-repeat law)
    previouslySeenQuestionIds: Set<string>;

    // Timing
    sessionStartedAt: Date | null;
    currentQuestionStartedAt: Date | null;
}

export interface TrainingSessionActions {
    // Session Lifecycle
    initSession: (levelId: string, userId: string, questions: Question[]) => void;
    resetSession: () => void;
    pauseSession: () => void;
    resumeSession: () => void;

    // Question Flow
    getCurrentQuestion: () => Question | null;
    submitAnswer: (userAnswer: string) => TrainingAnswer;
    nextQuestion: () => boolean;

    // Mastery Check
    checkMastery: () => { passed: boolean; rate: number; required: number };

    // Leak Detection
    getLeaks: () => LeakData[];
    getHandLeakScore: (hand: string) => number;

    // Stats
    getSessionSummary: () => {
        stats: SessionStats;
        canAdvance: boolean;
        masteryRate: number;
        leaks: LeakData[];
        xpEarned: number;
        diamondsEarned: number;
    };

    // No-Repeat Enforcement
    filterUsedQuestions: (questions: Question[]) => Question[];
    markQuestionsAsSeen: (questionIds: string[]) => void;
}

type TrainingStore = TrainingSessionState & TrainingSessionActions;

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════

const initialState: TrainingSessionState = {
    sessionId: null,
    levelId: null,
    userId: null,
    status: 'idle',
    questions: [],
    currentQuestionIndex: 0,
    answeredQuestionIds: new Set(),
    answers: [],
    stats: {
        totalQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        currentStreak: 0,
        bestStreak: 0,
        avgResponseTime: 0,
        totalEvLoss: 0,
    },
    isLevelComplete: false,
    canAdvance: false,
    masteryRate: 0,
    leaks: new Map(),
    previouslySeenQuestionIds: new Set(),
    sessionStartedAt: null,
    currentQuestionStartedAt: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// 🏪 ZUSTAND STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useTrainingSession = create<TrainingStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            // ═══════════════════════════════════════════════════════════════════
            // 🎬 SESSION LIFECYCLE
            // ═══════════════════════════════════════════════════════════════════

            initSession: (levelId, userId, questions) => {
                const state = get();

                // HARD LAW: Filter out previously seen questions
                const filteredQuestions = state.filterUsedQuestions(questions);

                // Ensure we have exactly 20 questions (HARD LAW)
                const sessionQuestions = filteredQuestions.slice(0, QUESTIONS_PER_LEVEL);

                if (sessionQuestions.length < QUESTIONS_PER_LEVEL) {
                    console.warn(`⚠️ TRAINING: Only ${sessionQuestions.length} unique questions available. Recycling allowed.`);
                }

                set({
                    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    levelId,
                    userId,
                    status: 'active',
                    questions: sessionQuestions,
                    currentQuestionIndex: 0,
                    answeredQuestionIds: new Set(),
                    answers: [],
                    stats: {
                        totalQuestions: sessionQuestions.length,
                        correctAnswers: 0,
                        incorrectAnswers: 0,
                        currentStreak: 0,
                        bestStreak: 0,
                        avgResponseTime: 0,
                        totalEvLoss: 0,
                    },
                    isLevelComplete: false,
                    canAdvance: false,
                    masteryRate: 0,
                    sessionStartedAt: new Date(),
                    currentQuestionStartedAt: new Date(),
                });
            },

            resetSession: () => {
                set({
                    ...initialState,
                    previouslySeenQuestionIds: get().previouslySeenQuestionIds,
                    leaks: get().leaks,
                });
            },

            pauseSession: () => {
                set({ status: 'paused' });
            },

            resumeSession: () => {
                set({
                    status: 'active',
                    currentQuestionStartedAt: new Date(),
                });
            },

            // ═══════════════════════════════════════════════════════════════════
            // ❓ QUESTION FLOW
            // ═══════════════════════════════════════════════════════════════════

            getCurrentQuestion: () => {
                const { questions, currentQuestionIndex, status } = get();
                if (status !== 'active' || currentQuestionIndex >= questions.length) {
                    return null;
                }
                return questions[currentQuestionIndex];
            },

            submitAnswer: (userAnswer) => {
                const state = get();
                const question = state.getCurrentQuestion();

                if (!question) {
                    throw new Error('No active question');
                }

                const responseTime = state.currentQuestionStartedAt
                    ? Date.now() - state.currentQuestionStartedAt.getTime()
                    : 0;

                const isCorrect = userAnswer === question.gtoAnswer;
                const evDelta = isCorrect
                    ? 0
                    : (question.evValues[question.gtoAnswer] || 0) - (question.evValues[userAnswer] || 0);

                const answer: TrainingAnswer = {
                    questionId: question.id,
                    userAnswer,
                    correctAnswer: question.gtoAnswer,
                    isCorrect,
                    gtoExplanation: `GTO play is ${question.gtoAnswer}. Alternatives: ${question.alternateLines.join(', ')}`,
                    evDelta: Math.abs(evDelta),
                    responseTimeMs: responseTime,
                    isLeak: !isCorrect && state.getHandLeakScore(question.hand) >= 2,
                };

                // Update stats
                const newStats = { ...state.stats };
                newStats.totalQuestions = state.stats.totalQuestions;

                if (isCorrect) {
                    newStats.correctAnswers++;
                    newStats.currentStreak++;
                    newStats.bestStreak = Math.max(newStats.bestStreak, newStats.currentStreak);
                } else {
                    newStats.incorrectAnswers++;
                    newStats.currentStreak = 0;
                    newStats.totalEvLoss += Math.abs(evDelta);
                }

                // Update average response time
                const totalResponses = newStats.correctAnswers + newStats.incorrectAnswers;
                newStats.avgResponseTime =
                    ((newStats.avgResponseTime * (totalResponses - 1)) + responseTime) / totalResponses;

                // Update leaks
                const newLeaks = new Map(state.leaks);
                const existingLeak = newLeaks.get(question.hand) || {
                    hand: question.hand,
                    mistakeCount: 0,
                    totalSeen: 0,
                    avgEvLoss: 0,
                    lastMistakeAt: null,
                };

                existingLeak.totalSeen++;
                if (!isCorrect) {
                    existingLeak.mistakeCount++;
                    existingLeak.avgEvLoss =
                        ((existingLeak.avgEvLoss * (existingLeak.mistakeCount - 1)) + Math.abs(evDelta)) /
                        existingLeak.mistakeCount;
                    existingLeak.lastMistakeAt = new Date();
                }
                newLeaks.set(question.hand, existingLeak);

                // Calculate mastery rate
                const masteryRate = newStats.correctAnswers /
                    (newStats.correctAnswers + newStats.incorrectAnswers);

                // Check if level complete
                const questionsAnswered = newStats.correctAnswers + newStats.incorrectAnswers;
                const isComplete = questionsAnswered >= QUESTIONS_PER_LEVEL;
                const canAdvance = isComplete && masteryRate >= MASTERY_THRESHOLD;

                set({
                    answers: [...state.answers, answer],
                    answeredQuestionIds: new Set([...state.answeredQuestionIds, question.id]),
                    stats: newStats,
                    masteryRate,
                    isLevelComplete: isComplete,
                    canAdvance,
                    leaks: newLeaks,
                    status: isComplete ? (canAdvance ? 'completed' : 'failed') : 'active',
                });

                return answer;
            },

            nextQuestion: () => {
                const state = get();
                const nextIndex = state.currentQuestionIndex + 1;

                if (nextIndex >= state.questions.length) {
                    return false;
                }

                set({
                    currentQuestionIndex: nextIndex,
                    currentQuestionStartedAt: new Date(),
                });

                return true;
            },

            // ═══════════════════════════════════════════════════════════════════
            // ✅ MASTERY CHECK
            // ═══════════════════════════════════════════════════════════════════

            checkMastery: () => {
                const { stats } = get();
                const totalAnswered = stats.correctAnswers + stats.incorrectAnswers;
                const rate = totalAnswered > 0 ? stats.correctAnswers / totalAnswered : 0;

                return {
                    passed: rate >= MASTERY_THRESHOLD,
                    rate: rate * 100,
                    required: MASTERY_THRESHOLD * 100,
                };
            },

            // ═══════════════════════════════════════════════════════════════════
            // 🔴 LEAK DETECTION
            // ═══════════════════════════════════════════════════════════════════

            getLeaks: () => {
                const { leaks } = get();
                return Array.from(leaks.values())
                    .filter(leak => leak.mistakeCount >= 2)
                    .sort((a, b) => b.mistakeCount - a.mistakeCount);
            },

            getHandLeakScore: (hand) => {
                const { leaks } = get();
                const leak = leaks.get(hand);
                return leak ? leak.mistakeCount : 0;
            },

            // ═══════════════════════════════════════════════════════════════════
            // 📊 SESSION SUMMARY
            // ═══════════════════════════════════════════════════════════════════

            getSessionSummary: () => {
                const state = get();
                const leaks = state.getLeaks();

                // Calculate rewards
                const baseXP = state.canAdvance ? 100 : 25;
                const streakBonus = Math.floor(state.stats.bestStreak * 5);
                const accuracyBonus = Math.floor(state.masteryRate * 50);
                const xpEarned = baseXP + streakBonus + accuracyBonus;

                const baseDiamonds = state.canAdvance ? 20 : 5;
                const diamondsEarned = baseDiamonds;

                return {
                    stats: state.stats,
                    canAdvance: state.canAdvance,
                    masteryRate: state.masteryRate * 100,
                    leaks,
                    xpEarned,
                    diamondsEarned,
                };
            },

            // ═══════════════════════════════════════════════════════════════════
            // 🚫 NO-REPEAT ENFORCEMENT
            // ═══════════════════════════════════════════════════════════════════

            filterUsedQuestions: (questions) => {
                const { previouslySeenQuestionIds } = get();

                // Filter out previously seen questions
                const unseenQuestions = questions.filter(q => !previouslySeenQuestionIds.has(q.id));

                // If we don't have enough unseen questions, allow some overlap
                if (unseenQuestions.length < QUESTIONS_PER_LEVEL) {
                    const neededCount = QUESTIONS_PER_LEVEL - unseenQuestions.length;
                    const maxOverlap = Math.floor(QUESTIONS_PER_LEVEL * MAX_RETRY_QUESTION_OVERLAP);
                    const overlapCount = Math.min(neededCount, maxOverlap);

                    // Add some seen questions if necessary (least recently seen first)
                    const seenQuestions = questions
                        .filter(q => previouslySeenQuestionIds.has(q.id))
                        .slice(0, overlapCount);

                    return [...unseenQuestions, ...seenQuestions];
                }

                return unseenQuestions;
            },

            markQuestionsAsSeen: (questionIds) => {
                set(state => ({
                    previouslySeenQuestionIds: new Set([...state.previouslySeenQuestionIds, ...questionIds]),
                }));
            },
        }),
        {
            name: 'arena-training-session',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                previouslySeenQuestionIds: Array.from(state.previouslySeenQuestionIds),
                leaks: Array.from(state.leaks.entries()),
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Convert arrays back to Sets/Maps
                    state.previouslySeenQuestionIds = new Set(state.previouslySeenQuestionIds as unknown as string[]);
                    state.leaks = new Map(state.leaks as unknown as [string, LeakData][]);
                }
            },
        }
    )
);

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 SELECTOR HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export const useCurrentQuestion = () => useTrainingSession(state => state.getCurrentQuestion());
export const useSessionStats = () => useTrainingSession(state => state.stats);
export const useMasteryRate = () => useTrainingSession(state => state.masteryRate);
export const useCanAdvance = () => useTrainingSession(state => state.canAdvance);
export const useSessionStatus = () => useTrainingSession(state => state.status);
export const useLeaks = () => useTrainingSession(state => state.getLeaks());

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default useTrainingSession;
