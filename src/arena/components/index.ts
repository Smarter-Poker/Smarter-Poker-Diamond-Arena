/**
 * 🎮 DIAMOND ARENA — COMPONENT INDEX
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Barrel exports for all arena components.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// Core Orb
export { DiamondOrb } from './DiamondOrb';
export type { DiamondOrbProps, OrbState, OrbStatus } from './DiamondOrb';

// Study Chart
export { StudyChart } from './StudyChart';
export type {
    StudyChartProps,
    RangeData,
    HandData,
    HandCategory,
    LeakSignal,
    Position,
} from './StudyChart';

// Training Question
export { TrainingQuestion } from './TrainingQuestion';
export type { TrainingQuestionProps } from './TrainingQuestion';

// Level Progression
export { LevelProgression } from './LevelProgression';
export type { LevelProgressionProps, LevelData } from './LevelProgression';

// Session Summary
export { SessionSummary } from './SessionSummary';
export type { SessionSummaryProps } from './SessionSummary';
