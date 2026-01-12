/**
 * 📜 HAND HISTORY PANEL — Game Action Replay
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Displays history of hands played with actions, cards, and results.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActionType, Card } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 📜 TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HandAction {
    playerId: string;
    playerName: string;
    action: ActionType;
    amount?: number;
    street: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
    timestamp: Date;
}

interface HandSummary {
    handId: string;
    handNumber: number;
    timestamp: Date;
    potSize: number;
    winnerId: string;
    winnerName: string;
    winningHand?: string;
    heroCards?: [Card, Card];
    communityCards?: Card[];
    actions: HandAction[];
    result: 'WON' | 'LOST' | 'SPLIT';
    amountWon?: number;
    amountLost?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📜 HAND HISTORY PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface HandHistoryPanelProps {
    hands: HandSummary[];
    heroId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const HandHistoryPanel: React.FC<HandHistoryPanelProps> = ({
    hands,
    heroId,
    isOpen,
    onClose,
}) => {
    const [selectedHand, setSelectedHand] = useState<HandSummary | null>(null);
    const [filter, setFilter] = useState<'ALL' | 'WON' | 'LOST'>('ALL');

    const filteredHands = hands.filter(hand => {
        if (filter === 'ALL') return true;
        return hand.result === filter;
    });

    // Calculate stats
    const totalHands = hands.length;
    const wonHands = hands.filter(h => h.result === 'WON').length;
    const totalWinnings = hands.reduce((sum, h) => sum + (h.amountWon || 0), 0);
    const totalLosses = hands.reduce((sum, h) => sum + (h.amountLost || 0), 0);
    const netProfit = totalWinnings - totalLosses;

    const formatCard = (card: Card): string => {
        const suits: Record<string, string> = { 'SPADES': '♠', 'HEARTS': '♥', 'DIAMONDS': '♦', 'CLUBS': '♣' };
        return `${card.rank}${suits[card.suit] || '?'}`;
    };

    const getActionColor = (action: ActionType): string => {
        switch (action) {
            case 'FOLD': return '#FF4444';
            case 'CHECK': return '#888888';
            case 'CALL': return '#00E0FF';
            case 'BET': return '#00FF88';
            case 'RAISE': return '#FFB800';
            case 'ALL_IN': return '#FF00FF';
            default: return '#FFFFFF';
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                    backdropFilter: 'blur(8px)',
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
                        borderRadius: 20,
                        border: '1px solid rgba(0,224,255,0.3)',
                        width: 800,
                        maxWidth: '95vw',
                        maxHeight: '85vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <div>
                            <h2 style={{
                                color: '#00E0FF',
                                fontSize: 20,
                                fontWeight: 700,
                                margin: 0,
                            }}>
                                📜 Hand History
                            </h2>
                            <p style={{
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: 12,
                                marginTop: 4,
                            }}>
                                {totalHands} hands played • {wonHands} won
                            </p>
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{
                                    color: netProfit >= 0 ? '#00FF88' : '#FF4444',
                                    fontSize: 20,
                                    fontWeight: 700,
                                }}>
                                    {netProfit >= 0 ? '+' : ''}💎 {netProfit.toLocaleString()}
                                </div>
                                <div style={{
                                    color: 'rgba(255,255,255,0.4)',
                                    fontSize: 11,
                                }}>
                                    Net P/L
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'transparent',
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: 18,
                                    cursor: 'pointer',
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div style={{
                        padding: '12px 24px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        gap: 8,
                    }}>
                        {(['ALL', 'WON', 'LOST'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: filter === f
                                        ? f === 'WON' ? 'rgba(0,255,136,0.2)'
                                            : f === 'LOST' ? 'rgba(255,68,68,0.2)'
                                                : 'rgba(0,224,255,0.2)'
                                        : 'rgba(255,255,255,0.05)',
                                    color: filter === f
                                        ? f === 'WON' ? '#00FF88'
                                            : f === 'LOST' ? '#FF4444'
                                                : '#00E0FF'
                                        : 'rgba(255,255,255,0.6)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                {f === 'ALL' ? 'All Hands' : f === 'WON' ? '✓ Won' : '✕ Lost'}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        overflow: 'hidden',
                    }}>
                        {/* Hand List */}
                        <div style={{
                            width: selectedHand ? '40%' : '100%',
                            borderRight: selectedHand ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            overflowY: 'auto',
                            transition: 'width 0.2s ease',
                        }}>
                            {filteredHands.length === 0 ? (
                                <div style={{
                                    padding: 48,
                                    textAlign: 'center',
                                    color: 'rgba(255,255,255,0.4)',
                                }}>
                                    No hands to display
                                </div>
                            ) : (
                                filteredHands.map(hand => (
                                    <motion.div
                                        key={hand.handId}
                                        whileHover={{ background: 'rgba(255,255,255,0.03)' }}
                                        onClick={() => setSelectedHand(hand)}
                                        style={{
                                            padding: '16px 24px',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            cursor: 'pointer',
                                            background: selectedHand?.handId === hand.handId
                                                ? 'rgba(0,224,255,0.05)'
                                                : 'transparent',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: 8,
                                        }}>
                                            <span style={{
                                                color: '#FFF',
                                                fontWeight: 600,
                                            }}>
                                                Hand #{hand.handNumber}
                                            </span>
                                            <span style={{
                                                color: hand.result === 'WON' ? '#00FF88' : '#FF4444',
                                                fontSize: 14,
                                                fontWeight: 600,
                                            }}>
                                                {hand.result === 'WON'
                                                    ? `+💎 ${hand.amountWon?.toLocaleString()}`
                                                    : `-💎 ${hand.amountLost?.toLocaleString()}`
                                                }
                                            </span>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}>
                                            {/* Cards */}
                                            {hand.heroCards && (
                                                <div style={{
                                                    display: 'flex',
                                                    gap: 4,
                                                }}>
                                                    {hand.heroCards.map((card, i) => (
                                                        <span
                                                            key={i}
                                                            style={{
                                                                padding: '4px 6px',
                                                                borderRadius: 4,
                                                                background: 'rgba(255,255,255,0.1)',
                                                                color: card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? '#FF4444' : '#FFF',
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {formatCard(card)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <span style={{
                                                color: 'rgba(255,255,255,0.4)',
                                                fontSize: 11,
                                            }}>
                                                Pot: 💎 {hand.potSize}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Hand Detail */}
                        <AnimatePresence>
                            {selectedHand && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    style={{
                                        flex: 1,
                                        padding: 24,
                                        overflowY: 'auto',
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: 20,
                                    }}>
                                        <h3 style={{
                                            color: '#FFF',
                                            fontSize: 16,
                                            fontWeight: 600,
                                            margin: 0,
                                        }}>
                                            Hand #{selectedHand.handNumber}
                                        </h3>
                                        <button
                                            onClick={() => setSelectedHand(null)}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: 4,
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: 'transparent',
                                                color: 'rgba(255,255,255,0.6)',
                                                fontSize: 11,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            ✕ Close
                                        </button>
                                    </div>

                                    {/* Result */}
                                    <div style={{
                                        padding: 16,
                                        background: selectedHand.result === 'WON'
                                            ? 'rgba(0,255,136,0.1)'
                                            : 'rgba(255,68,68,0.1)',
                                        borderRadius: 12,
                                        marginBottom: 20,
                                    }}>
                                        <div style={{
                                            color: selectedHand.result === 'WON' ? '#00FF88' : '#FF4444',
                                            fontSize: 18,
                                            fontWeight: 700,
                                        }}>
                                            {selectedHand.result === 'WON' ? '🏆 Won' : '❌ Lost'}: 💎{' '}
                                            {selectedHand.result === 'WON'
                                                ? selectedHand.amountWon?.toLocaleString()
                                                : selectedHand.amountLost?.toLocaleString()
                                            }
                                        </div>
                                        <div style={{
                                            color: 'rgba(255,255,255,0.5)',
                                            fontSize: 12,
                                            marginTop: 4,
                                        }}>
                                            Winner: {selectedHand.winnerName}
                                            {selectedHand.winningHand && ` with ${selectedHand.winningHand}`}
                                        </div>
                                    </div>

                                    {/* Community Cards */}
                                    {selectedHand.communityCards && selectedHand.communityCards.length > 0 && (
                                        <div style={{ marginBottom: 20 }}>
                                            <div style={{
                                                color: 'rgba(255,255,255,0.4)',
                                                fontSize: 11,
                                                marginBottom: 8,
                                                textTransform: 'uppercase',
                                            }}>
                                                Board
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {selectedHand.communityCards.map((card, i) => (
                                                    <span
                                                        key={i}
                                                        style={{
                                                            padding: '8px 10px',
                                                            borderRadius: 6,
                                                            background: 'rgba(255,255,255,0.1)',
                                                            color: card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? '#FF4444' : '#FFF',
                                                            fontSize: 14,
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {formatCard(card)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Timeline */}
                                    <div>
                                        <div style={{
                                            color: 'rgba(255,255,255,0.4)',
                                            fontSize: 11,
                                            marginBottom: 12,
                                            textTransform: 'uppercase',
                                        }}>
                                            Actions
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 8,
                                        }}>
                                            {selectedHand.actions.map((action, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 12,
                                                        padding: '8px 12px',
                                                        background: 'rgba(255,255,255,0.03)',
                                                        borderRadius: 8,
                                                    }}
                                                >
                                                    <span style={{
                                                        color: 'rgba(255,255,255,0.4)',
                                                        fontSize: 10,
                                                        minWidth: 50,
                                                    }}>
                                                        {action.street}
                                                    </span>
                                                    <span style={{
                                                        color: action.playerId === heroId ? '#00E0FF' : '#FFF',
                                                        fontWeight: 500,
                                                        minWidth: 80,
                                                    }}>
                                                        {action.playerName}
                                                    </span>
                                                    <span style={{
                                                        color: getActionColor(action.action),
                                                        fontWeight: 600,
                                                    }}>
                                                        {action.action}
                                                        {action.amount && ` 💎${action.amount}`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default HandHistoryPanel;
