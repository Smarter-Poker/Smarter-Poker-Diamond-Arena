import { useEffect, useRef } from 'react';
import type { TableState, ActionType } from '../types/poker';

export function useAutoAction(
    tableState: TableState | null,
    isMyTurn: boolean,
    preAction: 'CHECK_FOLD' | 'CALL_ANY' | null,
    setPreAction: (action: 'CHECK_FOLD' | 'CALL_ANY' | null) => void,
    handleAction: (action: ActionType, amount?: number) => void,
    heroSeat: number | null
) {
    const executedRef = useRef(false);

    useEffect(() => {
        // Reset execution flag when turn ends
        if (!isMyTurn) {
            executedRef.current = false;
            return;
        }

        // If my turn and I haven't executed yet...
        if (isMyTurn && !executedRef.current && preAction && tableState && heroSeat) {
            const hero = tableState.seats[heroSeat - 1];
            if (!hero) return;

            const currentBet = tableState.currentBet;
            const myBet = hero.currentBet;
            const toCall = currentBet - myBet;

            console.log('🤖 Auto Action Triggered:', preAction);
            executedRef.current = true; // Prevent double firing

            if (preAction === 'CHECK_FOLD') {
                if (toCall === 0) {
                    handleAction('CHECK');
                } else {
                    handleAction('FOLD');
                }
            } else if (preAction === 'CALL_ANY') {
                // Determine if Call or All-In
                // But handleAction('CALL') usually handles the math (clamps to chips)
                handleAction('CALL');
            }

            // Consume the pre-action? Standard behavior varies. 
            // Often 'Check/Fold' persists until you manually act or it executes.
            // 'Call Any' might persist for the *round* but riskier.
            // Let's consume it for safety.
            setPreAction(null);
        }
    }, [isMyTurn, preAction, tableState, heroSeat, handleAction, setPreAction]);
}
