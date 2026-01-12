/**
 * 🎰 CREATE TABLE MODAL — New Poker Table Configuration
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Modal for creating new cash game or tournament tables.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TableConfig } from '../types/poker';

// ═══════════════════════════════════════════════════════════════════════════
// 💎 PRESET STAKES
// ═══════════════════════════════════════════════════════════════════════════

const STAKE_PRESETS = [
    { label: 'Micro', smallBlind: 1, bigBlind: 2, minBuyIn: 40, maxBuyIn: 200 },
    { label: 'Low', smallBlind: 5, bigBlind: 10, minBuyIn: 200, maxBuyIn: 1000 },
    { label: 'Medium', smallBlind: 10, bigBlind: 20, minBuyIn: 400, maxBuyIn: 2000 },
    { label: 'High', smallBlind: 25, bigBlind: 50, minBuyIn: 1000, maxBuyIn: 5000 },
    { label: 'Nosebleed', smallBlind: 100, bigBlind: 200, minBuyIn: 4000, maxBuyIn: 20000 },
];

const TABLE_SIZES = [
    { size: 2, label: 'Heads-Up', icon: '🎯' },
    { size: 6, label: '6-Max', icon: '⚡' },
    { size: 9, label: 'Full Ring', icon: '🎰' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 🎰 CREATE TABLE MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface CreateTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (config: Partial<TableConfig>) => Promise<{ success: boolean; tableId?: string; error?: string }>;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
    isOpen,
    onClose,
    onCreate,
}) => {
    // Form state
    const [tableName, setTableName] = useState('My Table');
    const [tableSize, setTableSize] = useState<2 | 6 | 9>(9);
    const [stakePreset, setStakePreset] = useState(2); // Medium by default
    const [isPrivate, setIsPrivate] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedStakes = STAKE_PRESETS[stakePreset];

    const handleCreate = useCallback(async () => {
        setIsCreating(true);
        setError(null);

        const config: Partial<TableConfig> = {
            name: tableName.trim() || 'New Table',
            gameType: 'CASH',
            tableSize,
            bettingStructure: 'NO_LIMIT',
            smallBlind: selectedStakes.smallBlind,
            bigBlind: selectedStakes.bigBlind,
            minBuyIn: selectedStakes.minBuyIn,
            maxBuyIn: selectedStakes.maxBuyIn,
            timeLimit: 30,
            isPrivate,
        };

        try {
            const result = await onCreate(config);
            if (result.success) {
                onClose();
                // Reset form
                setTableName('My Table');
                setTableSize(9);
                setStakePreset(2);
                setIsPrivate(false);
            } else {
                setError(result.error || 'Failed to create table');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create table');
        } finally {
            setIsCreating(false);
        }
    }, [tableName, tableSize, selectedStakes, isPrivate, onCreate, onClose]);

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
                        padding: 32,
                        width: 520,
                        maxWidth: '90vw',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 60px rgba(0,224,255,0.1)',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 28,
                    }}>
                        <h2 style={{
                            color: '#00E0FF',
                            fontSize: 22,
                            fontWeight: 700,
                            margin: 0,
                        }}>
                            🎰 Create New Table
                        </h2>
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

                    {/* Table Name */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 8,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                        }}>
                            Table Name
                        </label>
                        <input
                            type="text"
                            value={tableName}
                            onChange={e => setTableName(e.target.value)}
                            placeholder="Enter table name..."
                            maxLength={30}
                            style={{
                                width: '100%',
                                padding: '14px 18px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(0,0,0,0.3)',
                                color: '#FFF',
                                fontSize: 15,
                                outline: 'none',
                            }}
                        />
                    </div>

                    {/* Table Size */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 12,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                        }}>
                            Table Size
                        </label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {TABLE_SIZES.map(({ size, label, icon }) => (
                                <motion.button
                                    key={size}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setTableSize(size as 2 | 6 | 9)}
                                    style={{
                                        flex: 1,
                                        padding: '16px 12px',
                                        borderRadius: 12,
                                        border: tableSize === size
                                            ? '2px solid #00E0FF'
                                            : '1px solid rgba(255,255,255,0.1)',
                                        background: tableSize === size
                                            ? 'rgba(0,224,255,0.15)'
                                            : 'rgba(255,255,255,0.03)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <span style={{ fontSize: 24 }}>{icon}</span>
                                    <span style={{
                                        color: tableSize === size ? '#00E0FF' : '#FFF',
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}>
                                        {label}
                                    </span>
                                    <span style={{
                                        color: 'rgba(255,255,255,0.4)',
                                        fontSize: 11,
                                    }}>
                                        {size} max
                                    </span>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Stakes Selection */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 12,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                        }}>
                            Stake Level
                        </label>
                        <div style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                        }}>
                            {STAKE_PRESETS.map((preset, idx) => (
                                <motion.button
                                    key={preset.label}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setStakePreset(idx)}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: 8,
                                        border: stakePreset === idx
                                            ? '2px solid #FFB800'
                                            : '1px solid rgba(255,255,255,0.1)',
                                        background: stakePreset === idx
                                            ? 'rgba(255,184,0,0.15)'
                                            : 'rgba(255,255,255,0.03)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{
                                        color: stakePreset === idx ? '#FFB800' : '#FFF',
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}>
                                        {preset.label}
                                    </div>
                                    <div style={{
                                        color: 'rgba(255,255,255,0.4)',
                                        fontSize: 11,
                                        marginTop: 2,
                                    }}>
                                        💎 {preset.smallBlind}/{preset.bigBlind}
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Stakes Summary */}
                    <div style={{
                        padding: 16,
                        background: 'rgba(0,224,255,0.05)',
                        borderRadius: 12,
                        border: '1px solid rgba(0,224,255,0.2)',
                        marginBottom: 24,
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                        }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                                Blinds
                            </span>
                            <span style={{ color: '#00E0FF', fontSize: 14, fontWeight: 600 }}>
                                💎 {selectedStakes.smallBlind} / {selectedStakes.bigBlind}
                            </span>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                        }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                                Buy-in Range
                            </span>
                            <span style={{ color: '#00E0FF', fontSize: 14, fontWeight: 600 }}>
                                💎 {selectedStakes.minBuyIn.toLocaleString()} - {selectedStakes.maxBuyIn.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Private Table Toggle */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 0',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        marginBottom: 24,
                    }}>
                        <div>
                            <div style={{ color: '#FFF', fontSize: 14, fontWeight: 500 }}>
                                Private Table
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                                Only visible to invited players
                            </div>
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsPrivate(!isPrivate)}
                            style={{
                                width: 52,
                                height: 28,
                                borderRadius: 100,
                                border: 'none',
                                background: isPrivate
                                    ? 'linear-gradient(180deg, #00E0FF 0%, #00A8CC 100%)'
                                    : 'rgba(255,255,255,0.15)',
                                cursor: 'pointer',
                                position: 'relative',
                            }}
                        >
                            <motion.div
                                animate={{ x: isPrivate ? 24 : 2 }}
                                style={{
                                    position: 'absolute',
                                    top: 2,
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: '#FFF',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }}
                            />
                        </motion.button>
                    </div>

                    {/* Error Message */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{
                                    padding: '12px 16px',
                                    background: 'rgba(255,68,68,0.1)',
                                    borderRadius: 8,
                                    marginBottom: 16,
                                    color: '#FF4444',
                                    fontSize: 13,
                                }}
                            >
                                ⚠️ {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div style={{
                        display: 'flex',
                        gap: 12,
                    }}>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onClose}
                            disabled={isCreating}
                            style={{
                                flex: 1,
                                padding: '14px 24px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'transparent',
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: 14,
                                cursor: 'pointer',
                                opacity: isCreating ? 0.5 : 1,
                            }}
                        >
                            Cancel
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleCreate}
                            disabled={isCreating}
                            style={{
                                flex: 2,
                                padding: '14px 24px',
                                borderRadius: 10,
                                border: 'none',
                                background: 'linear-gradient(180deg, #00E0FF 0%, #00A8CC 100%)',
                                color: '#000',
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                opacity: isCreating ? 0.7 : 1,
                            }}
                        >
                            {isCreating ? (
                                <>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        style={{
                                            width: 16,
                                            height: 16,
                                            border: '2px solid rgba(0,0,0,0.2)',
                                            borderTopColor: '#000',
                                            borderRadius: '50%',
                                        }}
                                    />
                                    Creating...
                                </>
                            ) : (
                                <>🎰 Create Table</>
                            )}
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CreateTableModal;
