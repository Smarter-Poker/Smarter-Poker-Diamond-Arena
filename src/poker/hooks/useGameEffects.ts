import { useEffect, useRef } from 'react';
import type { TableState, ActionType, Player } from '../types/poker';
import { soundEngine } from '../engine/sound-engine';
import { animationController } from '../engine/animation-controller';

// Track previous state to detect changes
interface PreviousState {
    street: string;
    activePlayerId: string | null;
    potTotal: number;
    communityCardsLength: number;
    lastActions: Map<string, string>; // playerId -> lastActionType
}

export function useGameEffects(
    tableState: TableState | null,
    isMyTurn: boolean,
    heroId: string | null
) {
    const prevRef = useRef<PreviousState>({
        street: 'WAITING',
        activePlayerId: null,
        potTotal: 0,
        communityCardsLength: 0,
        lastActions: new Map(),
    });

    useEffect(() => {
        if (!tableState) return;

        const prev = prevRef.current;
        const currentStreet = tableState.street;
        const currentPot = tableState.pots[0]?.amount || 0;
        const currentCards = tableState.communityCards.length;

        // 1. Detect Street Change (deal cards noise)
        if (currentStreet !== prev.street) {
            if (currentStreet !== 'WAITING') {
                // Street changed (Flop, Turn, River)
                soundEngine.playSound('CARD_FLIP');

                // If moving to showdown or street end, maybe push chips?
                if (currentStreet === 'SHOWDOWN') {
                    animationController.queue({ type: 'SHOWDOWN', duration: 1000 });
                }
            }
        }

        // 2. Detect Community Cards Dealt
        if (currentCards > prev.communityCardsLength) {
            const newCardsCount = currentCards - prev.communityCardsLength;
            // soundEngine already played by street change usually, but we can add specific card noises
            // animationController handled by specific Card components usually, 
            // but we can queue a global "deal" animation sequence if we were rendering cards imperatively
        }

        // 3. Detect Pot Events (Win/Push)
        // If pot goes to 0 and we are Waiting, someone won
        if (prev.potTotal > 0 && currentPot === 0 && currentStreet === 'WAITING') {
            soundEngine.playSound('CHIPS_COLLECT');
            // Winner handling is usually done via a specific event log, 
            // but simplified detection here works for basic FX
        }

        // 4. Detect Player Actions
        tableState.seats.forEach(player => {
            if (!player) return;

            const lastSeenAction = prev.lastActions.get(player.id);
            const currentAction = player.lastAction?.type;
            const currentTimestamp = player.lastAction?.timestamp;

            // Simple check: if action type changed or timestamp implies new action
            // Note: timestamp check is better but effectively strictly strictly equal objects in React state might fail 
            // if we don't have stable references. 
            // We'll rely on type change or just assume new state = new action for now if relying on prop updates.

            if (currentAction && currentAction !== lastSeenAction) {
                // Play sound based on action
                switch (currentAction) {
                    case 'CHECK':
                        soundEngine.playSound('CHECK');
                        break;
                    case 'CALL':
                        soundEngine.playSound('CHIPS_BET');
                        break;
                    case 'BET':
                    case 'RAISE':
                    case 'ALL_IN':
                        soundEngine.playSound('CHIPS_RAISE');
                        break;
                    case 'FOLD':
                        soundEngine.playSound('FOLD');
                        break;
                }

                // Update tracker
                prev.lastActions.set(player.id, currentAction);
            }
        });

        // 5. Detect Hero Turn
        if (isMyTurn && prev.activePlayerId !== heroId) {
            soundEngine.playSound('YOUR_TURN');
        }

        // Update Refs
        prevRef.current = {
            street: currentStreet,
            activePlayerId: tableState.activePlayerSeat
                ? tableState.seats[tableState.activePlayerSeat - 1]?.id || null
                : null,
            potTotal: currentPot,
            communityCardsLength: currentCards,
            lastActions: prev.lastActions, // kept mutated map
        };

    }, [tableState, isMyTurn, heroId]);
}
