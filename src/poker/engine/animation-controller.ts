/**
 * 🎬 ANIMATION CONTROLLER — Coordinated Game Animations
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Manages and sequences game animations for smooth visual feedback.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AnimationType =
    | 'CARD_DEAL'
    | 'CARD_FLIP'
    | 'CARD_BURN'
    | 'CHIP_BET'
    | 'CHIP_COLLECT'
    | 'CHIP_WIN'
    | 'PLAYER_WIN'
    | 'PLAYER_FOLD'
    | 'PLAYER_ALL_IN'
    | 'POT_PUSH'
    | 'DEALER_BUTTON_MOVE'
    | 'TIMER_PULSE'
    | 'SHOWDOWN';

export type AnimationSpeed = 'SLOW' | 'NORMAL' | 'FAST' | 'INSTANT';

export interface AnimationConfig {
    type: AnimationType;
    duration: number; // milliseconds
    delay?: number;
    easing?: string;
    from?: Record<string, any>;
    to?: Record<string, any>;
    onStart?: () => void;
    onComplete?: () => void;
}

export interface AnimationState {
    isPlaying: boolean;
    currentAnimation: AnimationType | null;
    queue: AnimationConfig[];
    speed: AnimationSpeed;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 ANIMATION DURATIONS BY SPEED
// ═══════════════════════════════════════════════════════════════════════════

const SPEED_MULTIPLIERS: Record<AnimationSpeed, number> = {
    SLOW: 1.5,
    NORMAL: 1.0,
    FAST: 0.5,
    INSTANT: 0.1,
};

const BASE_DURATIONS: Record<AnimationType, number> = {
    CARD_DEAL: 200,
    CARD_FLIP: 300,
    CARD_BURN: 150,
    CHIP_BET: 250,
    CHIP_COLLECT: 400,
    CHIP_WIN: 500,
    PLAYER_WIN: 600,
    PLAYER_FOLD: 200,
    PLAYER_ALL_IN: 400,
    POT_PUSH: 350,
    DEALER_BUTTON_MOVE: 300,
    TIMER_PULSE: 150,
    SHOWDOWN: 800,
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 ANIMATION PRESETS (Framer Motion compatible)
// ═══════════════════════════════════════════════════════════════════════════

export const ANIMATION_PRESETS = {
    // Card animations
    cardDeal: {
        initial: { x: 0, y: -200, opacity: 0, scale: 0.5, rotateY: 180 },
        animate: { x: 0, y: 0, opacity: 1, scale: 1, rotateY: 0 },
        transition: { type: 'spring', stiffness: 300, damping: 25 },
    },
    cardFlip: {
        initial: { rotateY: 180, scale: 1 },
        animate: { rotateY: 0, scale: [1, 1.05, 1] },
        transition: { duration: 0.3, ease: 'easeInOut' },
    },
    cardFold: {
        animate: { opacity: 0.3, scale: 0.9, y: 20 },
        transition: { duration: 0.2 },
    },

    // Chip animations
    chipBet: {
        initial: { opacity: 0, scale: 0.5, y: -30 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { type: 'spring', stiffness: 400, damping: 20 },
    },
    chipCollect: {
        animate: { x: 0, y: 0, scale: 0.8, opacity: 0 },
        transition: { duration: 0.4, ease: 'easeIn' },
    },
    chipWin: {
        initial: { scale: 0.5, opacity: 0 },
        animate: { scale: [0.5, 1.2, 1], opacity: 1 },
        transition: { duration: 0.5, times: [0, 0.6, 1] },
    },

    // Player animations
    playerWin: {
        animate: {
            boxShadow: [
                '0 0 0 rgba(255,184,0,0)',
                '0 0 30px rgba(255,184,0,0.6)',
                '0 0 0 rgba(255,184,0,0)',
            ],
        },
        transition: { duration: 0.6, repeat: 2 },
    },
    playerFold: {
        animate: { opacity: 0.4, filter: 'grayscale(80%)' },
        transition: { duration: 0.2 },
    },
    playerAllIn: {
        animate: {
            scale: [1, 1.05, 1],
            boxShadow: [
                '0 0 0 rgba(255,0,255,0)',
                '0 0 40px rgba(255,0,255,0.5)',
                '0 0 20px rgba(255,0,255,0.3)',
            ],
        },
        transition: { duration: 0.4 },
    },

    // Pot animations
    potPush: {
        initial: { scale: 1 },
        animate: { scale: [1, 1.1, 1] },
        transition: { duration: 0.35 },
    },
    potGrow: {
        animate: { scale: [1, 1.15, 1.05] },
        transition: { type: 'spring', stiffness: 300, damping: 10 },
    },

    // UI animations
    timerPulse: {
        animate: {
            scale: [1, 1.1, 1],
            opacity: [1, 0.8, 1],
        },
        transition: { duration: 0.15 },
    },
    actionBadge: {
        initial: { scale: 0, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0, opacity: 0 },
        transition: { type: 'spring', stiffness: 500, damping: 25 },
    },

    // Modal animations
    modalEnter: {
        initial: { opacity: 0, scale: 0.9, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9, y: 20 },
        transition: { type: 'spring', stiffness: 300, damping: 25 },
    },
    fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 ANIMATION CONTROLLER CLASS
// ═══════════════════════════════════════════════════════════════════════════

class AnimationController {
    private state: AnimationState = {
        isPlaying: false,
        currentAnimation: null,
        queue: [],
        speed: 'NORMAL',
    };
    private listeners: Set<(state: AnimationState) => void> = new Set();

    /**
     * Set animation speed
     */
    public setSpeed(speed: AnimationSpeed): void {
        this.state.speed = speed;
        this.notifyListeners();
    }

    /**
     * Get duration for animation type based on current speed
     */
    public getDuration(type: AnimationType): number {
        const baseDuration = BASE_DURATIONS[type] || 300;
        return baseDuration * SPEED_MULTIPLIERS[this.state.speed];
    }

    /**
     * Get transition config for animation
     */
    public getTransition(type: AnimationType): { duration: number } {
        return { duration: this.getDuration(type) / 1000 };
    }

    /**
     * Queue an animation
     */
    public queue(config: AnimationConfig): void {
        const adjustedConfig = {
            ...config,
            duration: config.duration * SPEED_MULTIPLIERS[this.state.speed],
        };
        this.state.queue.push(adjustedConfig);
        this.processQueue();
    }

    /**
     * Queue multiple animations to play in sequence
     */
    public sequence(configs: AnimationConfig[]): void {
        configs.forEach(config => this.queue(config));
    }

    /**
     * Play animations simultaneously
     */
    public parallel(configs: AnimationConfig[]): Promise<void> {
        return Promise.all(configs.map(config => this.play(config))).then(() => { });
    }

    /**
     * Play a single animation
     */
    public play(config: AnimationConfig): Promise<void> {
        return new Promise(resolve => {
            const duration = config.duration * SPEED_MULTIPLIERS[this.state.speed];

            this.state.isPlaying = true;
            this.state.currentAnimation = config.type;
            this.notifyListeners();

            config.onStart?.();

            setTimeout(() => {
                config.onComplete?.();
                this.state.isPlaying = false;
                this.state.currentAnimation = null;
                this.notifyListeners();
                resolve();
            }, duration + (config.delay || 0));
        });
    }

    /**
     * Process queued animations
     */
    private async processQueue(): Promise<void> {
        if (this.state.isPlaying || this.state.queue.length === 0) return;

        const next = this.state.queue.shift();
        if (next) {
            await this.play(next);
            this.processQueue();
        }
    }

    /**
     * Clear all queued animations
     */
    public clearQueue(): void {
        this.state.queue = [];
        this.notifyListeners();
    }

    /**
     * Subscribe to state changes
     */
    public subscribe(listener: (state: AnimationState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Get current state
     */
    public getState(): AnimationState {
        return { ...this.state };
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.getState()));
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const animationController = new AnimationController();

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stagger delay calculator for multiple elements
 */
export function staggerDelay(index: number, baseDelay: number = 50): number {
    return index * baseDelay * SPEED_MULTIPLIERS[animationController.getState().speed];
}

/**
 * Get preset with adjusted duration
 */
export function getPreset(name: keyof typeof ANIMATION_PRESETS) {
    return ANIMATION_PRESETS[name];
}

/**
 * Create card deal sequence
 */
export function createDealSequence(cardCount: number, delay: number = 100): AnimationConfig[] {
    return Array.from({ length: cardCount }, (_, i) => ({
        type: 'CARD_DEAL' as AnimationType,
        duration: BASE_DURATIONS.CARD_DEAL,
        delay: i * delay,
    }));
}

/**
 * Create chip win animation for pot distribution
 */
export function createChipWinAnimation(
    fromPosition: { x: number; y: number },
    toPosition: { x: number; y: number }
): AnimationConfig {
    return {
        type: 'CHIP_WIN',
        duration: BASE_DURATIONS.CHIP_WIN,
        from: { x: fromPosition.x, y: fromPosition.y, scale: 1 },
        to: { x: toPosition.x, y: toPosition.y, scale: 1.2 },
    };
}

export default animationController;
