/**
 * ⚙️ TABLE SETTINGS PANEL — In-Game Configuration
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Panel for configuring game preferences, display settings, and hotkeys.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ SETTINGS TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TableSettings {
    // Display
    fourColorDeck: boolean;
    showBetSlider: boolean;
    showPotOdds: boolean;
    animationSpeed: 'SLOW' | 'NORMAL' | 'FAST';

    // Auto Actions
    autoMuck: boolean;
    autoPostBlinds: boolean;
    autoTimeBank: boolean;

    // Sound
    soundEnabled: boolean;
    soundVolume: number;
    notifyOnTurn: boolean;

    // Betting
    defaultBetSize: 'MIN' | 'HALF_POT' | 'POT' | 'TWO_POT';
    quickBetButtons: number[]; // Pot percentages
}

const DEFAULT_SETTINGS: TableSettings = {
    fourColorDeck: true,
    showBetSlider: true,
    showPotOdds: false,
    animationSpeed: 'NORMAL',
    autoMuck: true,
    autoPostBlinds: true,
    autoTimeBank: false,
    soundEnabled: true,
    soundVolume: 80,
    notifyOnTurn: true,
    defaultBetSize: 'HALF_POT',
    quickBetButtons: [33, 50, 75, 100],
};

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ SETTINGS PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface TableSettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    settings?: TableSettings;
    onSave: (settings: TableSettings) => void;
}

export const TableSettingsPanel: React.FC<TableSettingsPanelProps> = ({
    isOpen,
    onClose,
    settings: initialSettings,
    onSave,
}) => {
    const [settings, setSettings] = useState<TableSettings>(
        initialSettings || DEFAULT_SETTINGS
    );
    const [activeTab, setActiveTab] = useState<'display' | 'auto' | 'sound' | 'betting'>('display');

    const updateSetting = useCallback(<K extends keyof TableSettings>(
        key: K,
        value: TableSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleSave = useCallback(() => {
        onSave(settings);
        onClose();
    }, [settings, onSave, onClose]);

    const handleReset = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
    }, []);

    if (!isOpen) return null;

    const tabs = [
        { id: 'display', label: '🎨 Display', icon: '🎨' },
        { id: 'auto', label: '⚡ Auto Actions', icon: '⚡' },
        { id: 'sound', label: '🔊 Sound', icon: '🔊' },
        { id: 'betting', label: '💰 Betting', icon: '💰' },
    ] as const;

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
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'linear-gradient(180deg, #0D0D10 0%, #08080A 100%)',
                        borderRadius: 20,
                        border: '1px solid rgba(255,255,255,0.1)',
                        width: 560,
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
                        <h2 style={{
                            color: '#FFF',
                            fontSize: 18,
                            fontWeight: 600,
                            margin: 0,
                        }}>
                            ⚙️ Table Settings
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

                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        padding: '12px 24px',
                        gap: 8,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: activeTab === tab.id
                                        ? 'rgba(0,224,255,0.2)'
                                        : 'rgba(255,255,255,0.03)',
                                    color: activeTab === tab.id ? '#00E0FF' : 'rgba(255,255,255,0.6)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{
                        flex: 1,
                        padding: 24,
                        overflowY: 'auto',
                    }}>
                        {/* Display Tab */}
                        {activeTab === 'display' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <ToggleSetting
                                    label="Four-Color Deck"
                                    description="Use different colors for each suit"
                                    value={settings.fourColorDeck}
                                    onChange={v => updateSetting('fourColorDeck', v)}
                                />
                                <ToggleSetting
                                    label="Show Bet Slider"
                                    description="Display slider for custom bet amounts"
                                    value={settings.showBetSlider}
                                    onChange={v => updateSetting('showBetSlider', v)}
                                />
                                <ToggleSetting
                                    label="Show Pot Odds"
                                    description="Display pot odds when facing a bet"
                                    value={settings.showPotOdds}
                                    onChange={v => updateSetting('showPotOdds', v)}
                                />
                                <SelectSetting
                                    label="Animation Speed"
                                    value={settings.animationSpeed}
                                    options={[
                                        { value: 'SLOW', label: 'Slow' },
                                        { value: 'NORMAL', label: 'Normal' },
                                        { value: 'FAST', label: 'Fast' },
                                    ]}
                                    onChange={v => updateSetting('animationSpeed', v as any)}
                                />
                            </div>
                        )}

                        {/* Auto Actions Tab */}
                        {activeTab === 'auto' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <ToggleSetting
                                    label="Auto Muck Losing Hands"
                                    description="Automatically fold losing hands at showdown"
                                    value={settings.autoMuck}
                                    onChange={v => updateSetting('autoMuck', v)}
                                />
                                <ToggleSetting
                                    label="Auto Post Blinds"
                                    description="Automatically post blinds when in position"
                                    value={settings.autoPostBlinds}
                                    onChange={v => updateSetting('autoPostBlinds', v)}
                                />
                                <ToggleSetting
                                    label="Auto Use Time Bank"
                                    description="Automatically use time bank when running low"
                                    value={settings.autoTimeBank}
                                    onChange={v => updateSetting('autoTimeBank', v)}
                                />
                            </div>
                        )}

                        {/* Sound Tab */}
                        {activeTab === 'sound' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <ToggleSetting
                                    label="Sound Effects"
                                    description="Enable game sound effects"
                                    value={settings.soundEnabled}
                                    onChange={v => updateSetting('soundEnabled', v)}
                                />
                                <SliderSetting
                                    label="Volume"
                                    value={settings.soundVolume}
                                    min={0}
                                    max={100}
                                    disabled={!settings.soundEnabled}
                                    onChange={v => updateSetting('soundVolume', v)}
                                />
                                <ToggleSetting
                                    label="Notify on Turn"
                                    description="Play sound when it's your turn to act"
                                    value={settings.notifyOnTurn}
                                    onChange={v => updateSetting('notifyOnTurn', v)}
                                />
                            </div>
                        )}

                        {/* Betting Tab */}
                        {activeTab === 'betting' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <SelectSetting
                                    label="Default Bet Size"
                                    value={settings.defaultBetSize}
                                    options={[
                                        { value: 'MIN', label: 'Minimum Bet' },
                                        { value: 'HALF_POT', label: '½ Pot' },
                                        { value: 'POT', label: 'Pot' },
                                        { value: 'TWO_POT', label: '2× Pot' },
                                    ]}
                                    onChange={v => updateSetting('defaultBetSize', v as any)}
                                />

                                <div>
                                    <div style={{
                                        color: 'rgba(255,255,255,0.6)',
                                        fontSize: 12,
                                        marginBottom: 8,
                                    }}>
                                        Quick Bet Buttons (% of pot)
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        gap: 8,
                                    }}>
                                        {settings.quickBetButtons.map((pct, i) => (
                                            <span
                                                key={i}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: 6,
                                                    background: 'rgba(255,255,255,0.1)',
                                                    color: '#FFB800',
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {pct}%
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                    }}>
                        <button
                            onClick={handleReset}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'transparent',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: 13,
                                cursor: 'pointer',
                            }}
                        >
                            Reset to Defaults
                        </button>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'transparent',
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSave}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'linear-gradient(180deg, #00E0FF 0%, #00A8CC 100%)',
                                    color: '#000',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Save Settings
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 SETTING COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const ToggleSetting: React.FC<{
    label: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
}> = ({ label, description, value, onChange }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    }}>
        <div>
            <div style={{ color: '#FFF', fontSize: 14, fontWeight: 500 }}>{label}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                {description}
            </div>
        </div>
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(!value)}
            style={{
                width: 48,
                height: 26,
                borderRadius: 100,
                border: 'none',
                background: value
                    ? 'linear-gradient(180deg, #00E0FF 0%, #00A8CC 100%)'
                    : 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                position: 'relative',
            }}
        >
            <motion.div
                animate={{ x: value ? 22 : 2 }}
                style={{
                    position: 'absolute',
                    top: 2,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#FFF',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
            />
        </motion.button>
    </div>
);

const SelectSetting: React.FC<{
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
    <div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 8 }}>
            {label}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: value === opt.value ? '2px solid #00E0FF' : '1px solid rgba(255,255,255,0.1)',
                        background: value === opt.value ? 'rgba(0,224,255,0.15)' : 'rgba(255,255,255,0.03)',
                        color: value === opt.value ? '#00E0FF' : 'rgba(255,255,255,0.6)',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

const SliderSetting: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    disabled?: boolean;
    onChange: (value: number) => void;
}> = ({ label, value, min, max, disabled, onChange }) => (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            marginBottom: 8,
        }}>
            <span>{label}</span>
            <span>{value}%</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            onChange={e => onChange(Number(e.target.value))}
            style={{ width: '100%' }}
        />
    </div>
);

export default TableSettingsPanel;
