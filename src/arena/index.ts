/**
 * 🎮 DIAMOND ARENA — MAIN INDEX
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Master exports for the Diamond Arena training system.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// Components
export * from './components';

// Re-export training session hook
export {
    useTrainingSession,
    useCurrentQuestion,
    useSessionStats,
    useMasteryRate,
    useCanAdvance,
    useSessionStatus,
    useLeaks,
} from '../hooks/useTrainingSession';

export type {
    Question,
    SessionStats,
    LeakData,
    TrainingSessionState,
    TrainingSessionActions,
} from '../hooks/useTrainingSession';
