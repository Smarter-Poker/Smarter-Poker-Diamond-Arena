/**
 * 🎮 DIAMOND ARENA — MAIN ENTRY POINT
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { DiamondOrb, type OrbState } from './arena/components/DiamondOrb';
import './styles/arena-globals.css';

// Simple test state
const testOrbState: OrbState = {
    status: 'idle',
    level: 1,
    xp: 500,
    xpToNext: 500,
    multiplier: 1.5,
    streakDays: 5,
    masteryRate: 0.87,
    diamondBalance: 1250,
};

const App: React.FC = () => {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: '#050507',
        }}>
            <h1 style={{
                color: '#FFB800',
                marginBottom: 48,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '0.1em',
            }}>
                💎 DIAMOND ARENA
            </h1>

            <DiamondOrb
                state={testOrbState}
                onActivate={() => console.log('Orb activated!')}
                showParticles={true}
            />

            <p style={{
                marginTop: 80,
                color: 'rgba(255,255,255,0.5)',
                fontSize: 14,
            }}>
                Connected to PokerIQ-Production ✅
            </p>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
