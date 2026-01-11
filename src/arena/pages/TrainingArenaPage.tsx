/**
 * 🎮 TRAINING ARENA PAGE — INTEGRATED TRAINING EXPERIENCE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Complete training page combining all arena components.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import { DiamondOrb, type OrbState } from '../components/DiamondOrb';
import { TrainingQuestion } from '../components/TrainingQuestion';
import { LevelProgression, type LevelData } from '../components/LevelProgression';
import { SessionSummary } from '../components/SessionSummary';
import { StudyChart, type RangeData, type LeakSignal } from '../components/StudyChart';

// Hooks
import {
    useTrainingSession,
    useCurrentQuestion,
    useSessionStatus,
    useMasteryRate,
    useCanAdvance,
    useSessionStats,
    useLeaks,
    type Question,
} from '../../hooks/useTrainingSession';

// Types
import { useFeedback } from '../../components/ArenaFeedback';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

type PageView = 'levels' | 'training' | 'summary' | 'study';

interface TrainingArenaPageProps {
    userId: string;
    initialLevel?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 MOCK DATA (Replace with Supabase in production)
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_LEVELS: LevelData[] = Array.from({ length: 10 }, (_, i) => ({
    id: `level_${i + 1}`,
    number: i + 1,
    name: ['Opening Basics', 'Position Play', 'Bet Sizing', 'Continuation Bets',
        '3-Bet Ranges', 'Check-Raising', 'Turn Play', 'River Decisions',
        'Bluff Catching', 'GTO Mastery'][i],
    description: `Master ${['fundamental opening ranges', 'positional awareness',
        'optimal bet sizes', 'c-bet strategy', '3-bet construction',
        'check-raise spots', 'turn barrel decisions', 'river value/bluffs',
        'bluff catching frequencies', 'GTO equilibrium play'][i]}`,
    isLocked: i > 0,
    isCompleted: false,
    bestScore: null,
    xpReward: 100 + (i * 25),
    diamondReward: 20 + (i * 5),
    difficulty: (['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'HARD',
        'HARD', 'EXPERT', 'EXPERT', 'MASTER', 'MASTER'] as const)[i],
}));

const MOCK_QUESTIONS: Question[] = Array.from({ length: 20 }, (_, i) => ({
    id: `q_${i + 1}`,
    scenarioId: `scenario_${i + 1}`,
    position: (['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'] as const)[i % 6],
    hand: ['AKs', 'QQx', 'JTs', 'AQo', 'KJs', '99x', 'ATs', 'KQs', 'TT', 'AJo'][i % 10],
    board: i % 3 === 0 ? [] : ['Kh', '7d', '2c', '5s', '9h'].slice(0, (i % 3) + 2),
    potSize: 10 + (i * 2),
    stackSize: 100,
    action: 'What is the GTO play here?',
    gtoAnswer: ['Raise 3x', 'Call', 'Fold', 'Bet 50%', 'Check'][i % 5],
    alternateLines: ['Raise 2.5x', 'Raise 4x', 'All-in'].slice(0, 2),
    evValues: { 'Raise 3x': 2.5, 'Call': 1.2, 'Fold': 0, 'Bet 50%': 1.8, 'Check': 0.5 },
    difficulty: 1 + (i % 3),
}));

const MOCK_RANGE: RangeData = {
    'AA': { hand: 'AA', category: 'RAISE', frequency: 100 },
    'KK': { hand: 'KK', category: 'RAISE', frequency: 100 },
    'QQ': { hand: 'QQ', category: 'RAISE', frequency: 100 },
    'JJ': { hand: 'JJ', category: 'RAISE', frequency: 100 },
    'AKs': { hand: 'AKs', category: 'RAISE', frequency: 100 },
    'AKo': { hand: 'AKo', category: 'RAISE', frequency: 100 },
    'AQs': { hand: 'AQs', category: 'RAISE', frequency: 100 },
    'AQo': { hand: 'AQo', category: 'MIXED', frequency: 70 },
    'TT': { hand: 'TT', category: 'RAISE', frequency: 100 },
    '99': { hand: '99', category: 'MIXED', frequency: 60 },
    '88': { hand: '88', category: 'CALL', frequency: 100 },
    'KQs': { hand: 'KQs', category: 'RAISE', frequency: 100 },
    'KQo': { hand: 'KQo', category: 'FOLD', frequency: 100 },
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 MAIN TRAINING ARENA PAGE
// ═══════════════════════════════════════════════════════════════════════════

export const TrainingArenaPage: React.FC<TrainingArenaPageProps> = ({
    userId,
    initialLevel = 1,
}) => {
    // State
    const [view, setView] = useState<PageView>('levels');
    const [levels, setLevels] = useState<LevelData[]>(MOCK_LEVELS);
    const [currentLevelData, setCurrentLevelData] = useState<LevelData | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [lastResult, setLastResult] = useState<any>(null);

    // Hooks
    const {
        initSession,
        submitAnswer,
        nextQuestion,
        getSessionSummary,
        resetSession,
        markQuestionsAsSeen,
    } = useTrainingSession();

    const currentQuestion = useCurrentQuestion();
    const status = useSessionStatus();
    const masteryRate = useMasteryRate();
    const canAdvance = useCanAdvance();
    const stats = useSessionStats();
    const leaks = useLeaks();

    const feedback = useFeedback?.() || null;

    // Orb state
    const orbState: OrbState = {
        status: status === 'active' ? 'active' : status === 'completed' ? 'success' : 'idle',
        level: currentLevelData?.number || 1,
        xp: 0,
        xpToNext: 100,
        multiplier: 1.0,
        streakDays: 0,
        masteryRate: masteryRate,
        diamondBalance: 0,
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🎮 HANDLERS
    // ═══════════════════════════════════════════════════════════════════════

    const handleLevelSelect = useCallback((level: LevelData) => {
        if (!level.isLocked) {
            setCurrentLevelData(level);
        }
    }, []);

    const handleStartTraining = useCallback(() => {
        if (!currentLevelData) return;

        initSession(currentLevelData.id, userId, MOCK_QUESTIONS);
        setView('training');
        setShowResult(false);
    }, [currentLevelData, userId, initSession]);

    const handleAnswer = useCallback((answer: string) => {
        const result = submitAnswer(answer);
        setLastResult(result);
        setShowResult(true);

        // Show feedback
        if (feedback) {
            if (result.isCorrect) {
                feedback.showXPToast?.(10, 'Correct answer!');
            } else {
                feedback.showGTOFeedback?.(false, result.gtoExplanation);
            }
        }

        // Auto-advance after delay
        setTimeout(() => {
            setShowResult(false);
            const hasNext = nextQuestion();

            if (!hasNext) {
                // Session complete
                setView('summary');
                markQuestionsAsSeen(MOCK_QUESTIONS.map(q => q.id));
            }
        }, 2500);
    }, [submitAnswer, nextQuestion, feedback, markQuestionsAsSeen]);

    const handleTimeout = useCallback(() => {
        // Auto-submit on timeout (counts as incorrect)
        handleAnswer('TIMEOUT');
    }, [handleAnswer]);

    const handleContinue = useCallback(() => {
        // Unlock next level
        const currentIndex = levels.findIndex(l => l.id === currentLevelData?.id);
        if (currentIndex >= 0 && currentIndex < levels.length - 1) {
            const updatedLevels = [...levels];
            updatedLevels[currentIndex].isCompleted = true;
            updatedLevels[currentIndex].bestScore = masteryRate * 100;
            updatedLevels[currentIndex + 1].isLocked = false;
            setLevels(updatedLevels);
            setCurrentLevelData(updatedLevels[currentIndex + 1]);
        }

        resetSession();
        setView('levels');

        // Show level up
        if (feedback) {
            feedback.showLevelUpOverlay?.(
                (currentLevelData?.number || 0) + 1,
                stats.correctAnswers * 10 + 50,
                ['New training scenarios unlocked']
            );
        }
    }, [levels, currentLevelData, masteryRate, resetSession, feedback, stats]);

    const handleRetry = useCallback(() => {
        resetSession();
        handleStartTraining();
    }, [resetSession, handleStartTraining]);

    const handleStudyLeaks = useCallback(() => {
        setView('study');
    }, []);

    const handleBackToLevels = useCallback(() => {
        resetSession();
        setView('levels');
    }, [resetSession]);

    // Convert leaks to LeakSignal format
    const leakSignals: LeakSignal[] = leaks.map(leak => ({
        id: leak.hand,
        hand: leak.hand,
        mistakeCount: leak.mistakeCount,
        totalAttempts: leak.totalSeen,
        avgEvLoss: leak.avgEvLoss,
        lastMistakeAt: leak.lastMistakeAt || new Date(),
        isActive: leak.mistakeCount >= 2,
    }));

    // ═══════════════════════════════════════════════════════════════════════
    // 🎨 RENDER
    // ═══════════════════════════════════════════════════════════════════════

    return (
        <div style={{
            minHeight: '100vh',
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
        }}>
            {/* Diamond Orb (Always Visible) */}
            <div style={{ marginBottom: 48 }}>
                <DiamondOrb
                    state={orbState}
                    onActivate={view === 'levels' && currentLevelData ? handleStartTraining : undefined}
                    showParticles={status === 'active'}
                />
            </div>

            {/* Page Views */}
            <AnimatePresence mode="wait">
                {/* Level Selection */}
                {view === 'levels' && (
                    <motion.div
                        key="levels"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{ width: '100%', maxWidth: 600 }}
                    >
                        <LevelProgression
                            levels={levels}
                            currentLevel={currentLevelData?.number || 1}
                            onLevelSelect={handleLevelSelect}
                            userMasteryRate={masteryRate * 100}
                        />
                    </motion.div>
                )}

                {/* Training */}
                {view === 'training' && currentQuestion && (
                    <motion.div
                        key="training"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{ width: '100%', maxWidth: 600 }}
                    >
                        {/* Progress Bar */}
                        <div style={{
                            marginBottom: 24,
                            padding: 16,
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: 12,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                    Question {stats.correctAnswers + stats.incorrectAnswers + 1} of 20
                                </span>
                                <span style={{ fontSize: 12, color: masteryRate >= 0.85 ? '#00FF94' : '#FFB800' }}>
                                    Accuracy: {(masteryRate * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                                <motion.div
                                    animate={{ width: `${((stats.correctAnswers + stats.incorrectAnswers) / 20) * 100}%` }}
                                    style={{
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #FFB800, #FF8C00)',
                                        borderRadius: 2,
                                    }}
                                />
                            </div>
                        </div>

                        <TrainingQuestion
                            question={currentQuestion}
                            questionNumber={stats.correctAnswers + stats.incorrectAnswers + 1}
                            totalQuestions={20}
                            onAnswer={handleAnswer}
                            onTimeout={handleTimeout}
                            showResult={showResult}
                            result={lastResult ? {
                                isCorrect: lastResult.isCorrect,
                                correctAnswer: lastResult.correctAnswer,
                                evDelta: lastResult.evDelta,
                                explanation: lastResult.gtoExplanation,
                            } : undefined}
                            disabled={showResult}
                        />

                        {/* Back Button */}
                        <button
                            onClick={handleBackToLevels}
                            style={{
                                marginTop: 16,
                                padding: '10px 20px',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 8,
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 12,
                                cursor: 'pointer',
                            }}
                        >
                            ← Back to Levels
                        </button>
                    </motion.div>
                )}

                {/* Summary */}
                {view === 'summary' && (
                    <motion.div
                        key="summary"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{ width: '100%', maxWidth: 600 }}
                    >
                        <SessionSummary
                            stats={stats}
                            masteryRate={masteryRate * 100}
                            canAdvance={canAdvance}
                            leaks={leaks}
                            xpEarned={getSessionSummary().xpEarned}
                            diamondsEarned={getSessionSummary().diamondsEarned}
                            levelName={currentLevelData?.name || 'Unknown'}
                            levelNumber={currentLevelData?.number || 1}
                            onContinue={handleContinue}
                            onRetry={handleRetry}
                            onStudyLeaks={handleStudyLeaks}
                        />
                    </motion.div>
                )}

                {/* Study Charts */}
                {view === 'study' && (
                    <motion.div
                        key="study"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        style={{ width: '100%', maxWidth: 700 }}
                    >
                        <button
                            onClick={() => setView('summary')}
                            style={{
                                marginBottom: 16,
                                padding: '10px 20px',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 8,
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: 12,
                                cursor: 'pointer',
                            }}
                        >
                            ← Back to Summary
                        </button>

                        <StudyChart
                            title="Opening Range Study"
                            subtitle="Review hands that caused leaks"
                            range={MOCK_RANGE}
                            leakSignals={leakSignals}
                            position="BTN"
                            scenario="You are on the Button facing a fold to you. What hands should you open?"
                            showLeaks={true}
                            highlightedHands={leaks.map(l => l.hand)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default TrainingArenaPage;
