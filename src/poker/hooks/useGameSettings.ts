import { useState, useEffect, useCallback } from 'react';
import type { TableSettings } from '../components/TableSettingsPanel';
import { soundEngine } from '../engine/sound-engine';

const STORAGE_KEY = 'diamond_arena_poker_settings';

const DEFAULT_SETTINGS: TableSettings = {
    fourColorDeck: true,
    showBetSlider: true,
    showPotOdds: false,
    animationSpeed: 'NORMAL',
    autoMuck: true,
    autoPostBlinds: true,
    autoTimeBank: false,
    soundEnabled: true, // Default to true
    soundVolume: 80,
    notifyOnTurn: true,
    defaultBetSize: 'HALF_POT',
    quickBetButtons: [33, 50, 75, 100],
};

export const useGameSettings = () => {
    const [settings, setSettingsState] = useState<TableSettings>(DEFAULT_SETTINGS);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to handle new settings fields
                setSettingsState({ ...DEFAULT_SETTINGS, ...parsed });
            }
        } catch (e) {
            console.warn('Failed to load poker settings:', e);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    // Sync audio engine with settings changes
    useEffect(() => {
        if (!isLoaded) return;
        soundEngine.setEnabled(settings.soundEnabled);
        soundEngine.setMasterVolume(settings.soundVolume / 100);
    }, [settings.soundEnabled, settings.soundVolume, isLoaded]);

    const saveSettings = useCallback((newSettings: TableSettings) => {
        setSettingsState(newSettings);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));

            // Apply side effects immediately
            soundEngine.setEnabled(newSettings.soundEnabled);
            soundEngine.setMasterVolume(newSettings.soundVolume / 100);

            // You could also broadcast animation speed changes here if needed
            // animationController.setSpeed(newSettings.animationSpeed);

        } catch (e) {
            console.warn('Failed to save poker settings:', e);
        }
    }, []);

    const updateSetting = useCallback(<K extends keyof TableSettings>(
        key: K,
        value: TableSettings[K]
    ) => {
        setSettingsState(prev => {
            const next = { ...prev, [key]: value };
            saveSettings(next);
            return next;
        });
    }, [saveSettings]);

    return {
        settings,
        isLoaded,
        saveSettings,
        updateSetting
    };
};
