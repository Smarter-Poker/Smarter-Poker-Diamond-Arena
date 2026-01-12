/**
 * 🔊 SOUND EFFECTS ENGINE — Audio Feedback System
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Manages game audio with volume control and sound categories.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🔊 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SoundCategory = 'CARDS' | 'CHIPS' | 'ACTIONS' | 'ALERTS' | 'AMBIENT';

export type SoundEffect =
    // Cards
    | 'CARD_DEAL'
    | 'CARD_FLIP'
    | 'CARD_SHUFFLE'
    // Chips
    | 'CHIP_SINGLE'
    | 'CHIP_STACK'
    | 'CHIP_ALL_IN'
    | 'CHIP_WIN'
    // Actions
    | 'ACTION_CHECK'
    | 'ACTION_FOLD'
    | 'ACTION_BET'
    | 'ACTION_RAISE'
    | 'ACTION_CALL'
    // Alerts
    | 'ALERT_TURN'
    | 'ALERT_WIN'
    | 'ALERT_LOSE'
    | 'ALERT_TIMEOUT'
    // UI
    | 'BUTTON_CLICK'
    | 'BUTTON_HOVER'
    | 'NOTIFICATION';

interface SoundConfig {
    category: SoundCategory;
    frequency: number;
    duration: number;
    type: OscillatorType;
    volume: number;
    attack?: number;
    release?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔊 SOUND CONFIGURATIONS (Synthesized)
// ═══════════════════════════════════════════════════════════════════════════

const SOUND_CONFIGS: Record<SoundEffect, SoundConfig> = {
    // Cards - subtle, papery sounds
    CARD_DEAL: { category: 'CARDS', frequency: 800, duration: 0.05, type: 'triangle', volume: 0.3, attack: 0.001, release: 0.04 },
    CARD_FLIP: { category: 'CARDS', frequency: 1200, duration: 0.08, type: 'sine', volume: 0.25, attack: 0.001, release: 0.07 },
    CARD_SHUFFLE: { category: 'CARDS', frequency: 600, duration: 0.15, type: 'sawtooth', volume: 0.15, attack: 0.01, release: 0.14 },

    // Chips - clinking, metallic
    CHIP_SINGLE: { category: 'CHIPS', frequency: 2000, duration: 0.08, type: 'sine', volume: 0.3, attack: 0.001, release: 0.07 },
    CHIP_STACK: { category: 'CHIPS', frequency: 1500, duration: 0.12, type: 'triangle', volume: 0.35, attack: 0.005, release: 0.1 },
    CHIP_ALL_IN: { category: 'CHIPS', frequency: 1000, duration: 0.3, type: 'sawtooth', volume: 0.4, attack: 0.01, release: 0.28 },
    CHIP_WIN: { category: 'CHIPS', frequency: 1800, duration: 0.25, type: 'sine', volume: 0.4, attack: 0.01, release: 0.2 },

    // Actions - distinct feedback
    ACTION_CHECK: { category: 'ACTIONS', frequency: 600, duration: 0.08, type: 'sine', volume: 0.25, attack: 0.001, release: 0.07 },
    ACTION_FOLD: { category: 'ACTIONS', frequency: 300, duration: 0.1, type: 'sine', volume: 0.2, attack: 0.005, release: 0.09 },
    ACTION_BET: { category: 'ACTIONS', frequency: 800, duration: 0.1, type: 'triangle', volume: 0.3, attack: 0.005, release: 0.09 },
    ACTION_RAISE: { category: 'ACTIONS', frequency: 1000, duration: 0.12, type: 'square', volume: 0.25, attack: 0.005, release: 0.1 },
    ACTION_CALL: { category: 'ACTIONS', frequency: 700, duration: 0.08, type: 'sine', volume: 0.25, attack: 0.003, release: 0.07 },

    // Alerts - attention-grabbing
    ALERT_TURN: { category: 'ALERTS', frequency: 880, duration: 0.15, type: 'sine', volume: 0.5, attack: 0.01, release: 0.13 },
    ALERT_WIN: { category: 'ALERTS', frequency: 523, duration: 0.4, type: 'sine', volume: 0.5, attack: 0.02, release: 0.35 },
    ALERT_LOSE: { category: 'ALERTS', frequency: 220, duration: 0.3, type: 'sine', volume: 0.3, attack: 0.01, release: 0.28 },
    ALERT_TIMEOUT: { category: 'ALERTS', frequency: 440, duration: 0.2, type: 'square', volume: 0.4, attack: 0.005, release: 0.18 },

    // UI
    BUTTON_CLICK: { category: 'ACTIONS', frequency: 1000, duration: 0.03, type: 'sine', volume: 0.15, attack: 0.001, release: 0.025 },
    BUTTON_HOVER: { category: 'ACTIONS', frequency: 1500, duration: 0.02, type: 'sine', volume: 0.08, attack: 0.001, release: 0.015 },
    NOTIFICATION: { category: 'ALERTS', frequency: 660, duration: 0.2, type: 'sine', volume: 0.35, attack: 0.01, release: 0.18 },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔊 SOUND ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

class SoundEngine {
    private audioContext: AudioContext | null = null;
    private masterVolume: number = 0.8;
    private categoryVolumes: Record<SoundCategory, number> = {
        CARDS: 1.0,
        CHIPS: 1.0,
        ACTIONS: 1.0,
        ALERTS: 1.0,
        AMBIENT: 0.5,
    };
    private enabled: boolean = true;
    private initialized: boolean = false;

    /**
     * Initialize the audio context (must be called after user interaction)
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            this.initialized = true;
            console.log('🔊 Sound engine initialized');
        } catch (error) {
            console.warn('🔊 Sound engine initialization failed:', error);
        }
    }

    /**
     * Play a sound effect
     */
    public play(effect: SoundEffect): void {
        if (!this.enabled || !this.audioContext || !this.initialized) return;

        const config = SOUND_CONFIGS[effect];
        if (!config) return;

        try {
            this.synthesizeSound(config);
        } catch (error) {
            console.warn(`🔊 Failed to play sound: ${effect}`, error);
        }
    }

    /**
     * Synthesize and play a sound based on config
     */
    private synthesizeSound(config: SoundConfig): void {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const categoryVolume = this.categoryVolumes[config.category];
        const finalVolume = config.volume * categoryVolume * this.masterVolume;

        // Create oscillator
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = config.type;
        oscillator.frequency.setValueAtTime(config.frequency, now);

        // Create gain for envelope
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, now);

        // Attack
        const attack = config.attack || 0.01;
        gainNode.gain.linearRampToValueAtTime(finalVolume, now + attack);

        // Release
        const release = config.release || config.duration * 0.8;
        gainNode.gain.linearRampToValueAtTime(0, now + attack + release);

        // Connect
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Play
        oscillator.start(now);
        oscillator.stop(now + config.duration);
    }

    /**
     * Play a chord (for win celebrations)
     */
    public playChord(frequencies: number[], duration: number = 0.4): void {
        if (!this.enabled || !this.audioContext || !this.initialized) return;

        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                this.synthesizeSound({
                    category: 'ALERTS',
                    frequency: freq,
                    duration,
                    type: 'sine',
                    volume: 0.3,
                    attack: 0.02,
                    release: duration - 0.05,
                });
            }, index * 50); // Stagger for arpeggio effect
        });
    }

    /**
     * Play win fanfare
     */
    public playWinFanfare(): void {
        this.playChord([523, 659, 784, 1047], 0.5); // C major chord
    }

    /**
     * Set master volume (0-1)
     */
    public setMasterVolume(volume: number): void {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Set category volume (0-1)
     */
    public setCategoryVolume(category: SoundCategory, volume: number): void {
        this.categoryVolumes[category] = Math.max(0, Math.min(1, volume));
    }

    /**
     * Enable/disable sound
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Get current settings
     */
    public getSettings(): {
        enabled: boolean;
        masterVolume: number;
        categoryVolumes: Record<SoundCategory, number>;
    } {
        return {
            enabled: this.enabled,
            masterVolume: this.masterVolume,
            categoryVolumes: { ...this.categoryVolumes },
        };
    }

    /**
     * Check if initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔊 SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const soundEngine = new SoundEngine();

// ═══════════════════════════════════════════════════════════════════════════
// 🔊 CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const playSound = (effect: SoundEffect) => soundEngine.play(effect);
export const initializeSound = () => soundEngine.initialize();
export const setVolume = (volume: number) => soundEngine.setMasterVolume(volume);
export const setSoundEnabled = (enabled: boolean) => soundEngine.setEnabled(enabled);

export default soundEngine;
