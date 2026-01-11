/**
 * ❓ THE TRAINING QUESTION — GTO SCENARIO CARD
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Displays poker scenarios with hand, board, and action options.
 * Integrates with useTrainingSession for answer submission.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Question } from '../../hooks/useTrainingSession';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 CARD SUITS & STYLING
// ═══════════════════════════════════════════════════════════════════════════

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
    's': { symbol: '♠', color: '#1a1a2e' },
    'h': { symbol: '♥', color: '#e63946' },
    'd': { symbol: '♦', color: '#00b4d8' },
    'c': { symbol: '♣', color: '#2d6a4f' },
};

const ACTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    FOLD: { bg: 'rgba(100, 100, 100, 0.2)', border: 'rgba(100, 100, 100, 0.4)', text: '#888888' },
    CHECK: { bg: 'rgba(100, 100, 100, 0.2)', border: 'rgba(100, 100, 100, 0.4)', text: '#AAAAAA' },
    CALL: { bg: 'rgba(0, 224, 255, 0.2)', border: 'rgba(0, 224, 255, 0.4)', text: '#00E0FF' },
    BET: { bg: 'rgba(0, 255, 148, 0.2)', border: 'rgba(0, 255, 148, 0.4)', text: '#00FF94' },
    RAISE: { bg: 'rgba(255, 184, 0, 0.2)', border: 'rgba(255, 184, 0, 0.4)', text: '#FFB800' },
    ALLIN: { bg: 'rgba(255, 62, 62, 0.2)', border: 'rgba(255, 62, 62, 0.4)', text: '#FF3E3E' },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface TrainingQuestionProps {
    question: Question;
    questionNumber: number;
    totalQuestions: number;
    timeLimit?: number;
    onAnswer: (answer: string) => void;
    onTimeout?: () => void;
    showResult?: boolean;
    result?: {
        isCorrect: boolean;
        correctAnswer: string;
        evDelta: number;
        explanation: string;
    };
    disabled?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🃏 CARD DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const CardDisplay: React.FC<{ card: string; size?: 'sm' | 'md' | 'lg' }> = ({ card, size = 'md' }) => {
    const rank = card.slice(0, -1);
    const suit = card.slice(-1).toLowerCase();
    const suitData = SUIT_SYMBOLS[suit] || { symbol: '?', color: '#666' };

    const sizes = {
        sm: { width: 36, height: 50, fontSize: 14 },
        md: { width: 48, height: 68, fontSize: 18 },
        lg: { width: 64, height: 90, fontSize: 24 },
    };

    const s = sizes[size];

    return (
        <motion.div
            initial={{ rotateY: 180, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
                width: s.width,
                height: s.height,
                background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F0F0 100%)',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '2px solid rgba(255,255,255,0.2)',
            }}
        >
            <span style={{ fontSize: s.fontSize, fontWeight: 700, color: suitData.color }}>
                {rank}
            </span>
            <span style={{ fontSize: s.fontSize * 0.9, color: suitData.color }}>
                {suitData.symbol}
            </span>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// ⏱️ TIMER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Timer: React.FC<{ seconds: number; maxSeconds: number; onTimeout: () => void }> = ({
    seconds,
    maxSeconds,
    onTimeout,
}) => {
    const progress = seconds / maxSeconds;
    const isLow = seconds <= 5;

    useEffect(() => {
        if (seconds <= 0) {
            onTimeout();
        }
    }, [seconds, onTimeout]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
                animate={isLow ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    color: isLow ? '#FF3E3E' : '#FFB800',
                    background: isLow ? 'rgba(255, 62, 62, 0.2)' : 'rgba(255, 184, 0, 0.2)',
                    border: `2px solid ${isLow ? '#FF3E3E' : '#FFB800'}`,
                }}
            >
                {seconds}
            </motion.div>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: `${progress * 100}%` }}
                    style={{
                        height: '100%',
                        background: isLow
                            ? 'linear-gradient(90deg, #FF3E3E, #FF6B6B)'
                            : 'linear-gradient(90deg, #FFB800, #FFD700)',
                        borderRadius: 3,
                    }}
                />
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 ACTION BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ActionButtonProps {
    action: string;
    onClick: () => void;
    disabled: boolean;
    isSelected: boolean;
    isCorrect?: boolean;
    isRevealed: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
    action,
    onClick,
    disabled,
    isSelected,
    isCorrect,
    isRevealed,
}) => {
    const actionKey = action.toUpperCase().split(' ')[0]; // Extract base action
    const colors = ACTION_COLORS[actionKey] || ACTION_COLORS.BET;

    let bgColor = colors.bg;
    let borderColor = colors.border;

    if (isRevealed) {
        if (isCorrect) {
            bgColor = 'rgba(0, 255, 148, 0.3)';
            borderColor = '#00FF94';
        } else if (isSelected) {
            bgColor = 'rgba(255, 62, 62, 0.3)';
            borderColor = '#FF3E3E';
        }
    } else if (isSelected) {
        borderColor = '#FFB800';
    }

    return (
        <motion.button
            whileHover={!disabled ? { scale: 1.02, y: -2 } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            onClick={onClick}
            disabled={disabled}
            style={{
                width: '100%',
                padding: '16px 20px',
                background: bgColor,
                border: `2px solid ${borderColor}`,
                borderRadius: 12,
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: disabled && !isRevealed ? 0.5 : 1,
                transition: 'all 0.2s ease',
            }}
        >
            <span style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
                {action}
            </span>

            {isRevealed && (
                <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{ fontSize: 18 }}
                >
                    {isCorrect ? '✅' : isSelected ? '❌' : ''}
                </motion.span>
            )}
        </motion.button>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 MAIN TRAINING QUESTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const TrainingQuestion: React.FC<TrainingQuestionProps> = ({
    question,
    questionNumber,
    totalQuestions,
    timeLimit = 30,
    onAnswer,
    onTimeout,
    showResult = false,
    result,
    disabled = false,
}) => {
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(timeLimit);

    // Timer countdown
    useEffect(() => {
        if (disabled || showResult) return;

        const interval = setInterval(() => {
            setTimeRemaining(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [disabled, showResult]);

    // Reset on new question
    useEffect(() => {
        setSelectedAnswer(null);
        setTimeRemaining(timeLimit);
    }, [question.id, timeLimit]);

    const handleAnswer = useCallback((answer: string) => {
        if (disabled || showResult) return;
        setSelectedAnswer(answer);
        onAnswer(answer);
    }, [disabled, showResult, onAnswer]);

    const handleTimeout = useCallback(() => {
        if (!selectedAnswer && onTimeout) {
            onTimeout();
        }
    }, [selectedAnswer, onTimeout]);

    // Parse available actions
    const actions = [question.gtoAnswer, ...question.alternateLines].filter(Boolean);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
                background: 'rgba(5, 5, 7, 0.95)',
                border: '1px solid rgba(255, 184, 0, 0.2)',
                borderRadius: 20,
                padding: 28,
                maxWidth: 600,
                width: '100%',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.5)',
                        letterSpacing: '0.1em',
                    }}>
                        QUESTION {questionNumber} OF {totalQuestions}
                    </span>
                </div>

                {!showResult && (
                    <div style={{ width: 150 }}>
                        <Timer seconds={timeRemaining} maxSeconds={timeLimit} onTimeout={handleTimeout} />
                    </div>
                )}
            </div>

            {/* Scenario Info */}
            <div style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                marginBottom: 20,
                padding: 16,
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 12,
            }}>
                <div style={{
                    padding: '6px 12px',
                    background: 'rgba(255, 184, 0, 0.1)',
                    border: '1px solid rgba(255, 184, 0, 0.3)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#FFB800',
                }}>
                    {question.position}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Pot: <span style={{ color: '#FFB800', fontWeight: 600 }}>{question.potSize} BB</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
                    Stack: <span style={{ color: '#00E0FF', fontWeight: 600 }}>{question.stackSize} BB</span>
                </div>
            </div>

            {/* Your Hand */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 8, letterSpacing: '0.1em' }}>
                    YOUR HAND
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {question.hand.match(/.{2}/g)?.map((card, i) => (
                        <CardDisplay key={i} card={card} size="md" />
                    ))}
                </div>
            </div>

            {/* Board */}
            {question.board && question.board.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 8, letterSpacing: '0.1em' }}>
                        BOARD
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {question.board.map((card, i) => (
                            <CardDisplay key={i} card={card} size="sm" />
                        ))}
                    </div>
                </div>
            )}

            {/* Action Prompt */}
            <div style={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: 16,
                padding: 12,
                background: 'rgba(255, 184, 0, 0.05)',
                borderRadius: 8,
                borderLeft: '3px solid #FFB800',
            }}>
                {question.action}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {actions.map((action) => (
                    <ActionButton
                        key={action}
                        action={action}
                        onClick={() => handleAnswer(action)}
                        disabled={disabled || showResult}
                        isSelected={selectedAnswer === action}
                        isCorrect={result?.correctAnswer === action}
                        isRevealed={showResult}
                    />
                ))}
            </div>

            {/* Result Explanation */}
            <AnimatePresence>
                {showResult && result && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                            marginTop: 20,
                            padding: 16,
                            background: result.isCorrect
                                ? 'rgba(0, 255, 148, 0.1)'
                                : 'rgba(255, 62, 62, 0.1)',
                            border: `1px solid ${result.isCorrect ? 'rgba(0, 255, 148, 0.3)' : 'rgba(255, 62, 62, 0.3)'}`,
                            borderRadius: 12,
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 8,
                            color: result.isCorrect ? '#00FF94' : '#FF3E3E',
                            fontWeight: 600,
                        }}>
                            {result.isCorrect ? '✅ Correct!' : `❌ Incorrect — EV Loss: ${result.evDelta.toFixed(2)} BB`}
                        </div>
                        <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', margin: 0, lineHeight: 1.5 }}>
                            {result.explanation}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default TrainingQuestion;
