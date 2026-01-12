/**
 * 📱 POKERBROS-STYLE TABLE MENU
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Slide-out menu with settings, cashier, sounds, exit options.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 📱 MENU PROPS
// ═══════════════════════════════════════════════════════════════════════════

interface TableMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onExit: () => void;
    onTopUp?: () => void;
    soundEnabled: boolean;
    onSoundToggle: () => void;
    vibrationEnabled?: boolean;
    onVibrationToggle?: () => void;
    version?: string;
}

export const TableMenu: React.FC<TableMenuProps> = ({
    isOpen,
    onClose,
    onExit,
    onTopUp,
    soundEnabled,
    onSoundToggle,
    vibrationEnabled = true,
    onVibrationToggle,
    version = '1.0.0',
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 200,
                        }}
                    />

                    {/* Menu Panel */}
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: 280,
                            background: '#0D1520',
                            borderRight: '1px solid rgba(255,255,255,0.1)',
                            zIndex: 201,
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {/* Menu Items */}
                        <div style={{ flex: 1, padding: '24px 0' }}>
                            <MenuItem
                                icon="⭐"
                                label="Cashier"
                                onClick={() => { }}
                            />
                            <MenuItem
                                icon="💎"
                                label="Top Up"
                                onClick={onTopUp}
                            />
                            <MenuItem
                                icon="⚙️"
                                label="Table Settings"
                                onClick={() => { }}
                            />
                            <MenuItem
                                icon="🔊"
                                label="Sounds"
                                onClick={onSoundToggle}
                                toggle={soundEnabled}
                            />
                            <MenuItem
                                icon="📳"
                                label="Vibrations"
                                onClick={onVibrationToggle}
                                toggle={vibrationEnabled}
                            />
                            <MenuItem
                                icon="📤"
                                label="Share"
                                onClick={() => { }}
                            />
                            <MenuItem
                                icon="👑"
                                label="VIP"
                                onClick={() => { }}
                            />

                            <div style={{ height: 24 }} />

                            <MenuItem
                                icon="🚪"
                                label="Exit"
                                onClick={onExit}
                                danger
                            />
                        </div>

                        {/* Version Footer */}
                        <div
                            style={{
                                padding: 24,
                                textAlign: 'center',
                                color: 'rgba(255,255,255,0.3)',
                                fontSize: 12,
                            }}
                        >
                            Version: {version}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 📋 MENU ITEM
// ═══════════════════════════════════════════════════════════════════════════

interface MenuItemProps {
    icon: string;
    label: string;
    onClick?: () => void;
    toggle?: boolean;
    danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
    icon,
    label,
    onClick,
    toggle,
    danger = false,
}) => (
    <motion.button
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        style={{
            width: '100%',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
        }}
    >
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span
            style={{
                flex: 1,
                fontSize: 15,
                fontWeight: 500,
                color: danger ? '#FF6666' : '#FFF',
            }}
        >
            {label}
        </span>

        {toggle !== undefined ? (
            <ToggleSwitch enabled={toggle} />
        ) : (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>›</span>
        )}
    </motion.button>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🔘 TOGGLE SWITCH
// ═══════════════════════════════════════════════════════════════════════════

const ToggleSwitch: React.FC<{ enabled: boolean }> = ({ enabled }) => (
    <div
        style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            background: enabled ? '#FFB800' : 'rgba(255,255,255,0.2)',
            padding: 2,
            transition: 'background 0.2s',
        }}
    >
        <motion.div
            animate={{ x: enabled ? 20 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#FFF',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
        />
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// 🍔 HAMBURGER MENU BUTTON
// ═══════════════════════════════════════════════════════════════════════════

interface MenuButtonProps {
    onClick: () => void;
}

export const MenuButton: React.FC<MenuButtonProps> = ({ onClick }) => (
    <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: 'rgba(0,100,150,0.3)',
            border: '1px solid rgba(0,150,200,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            cursor: 'pointer',
        }}
    >
        {[0, 1, 2].map(i => (
            <div
                key={i}
                style={{
                    width: 20,
                    height: 2,
                    borderRadius: 1,
                    background: '#0099CC',
                }}
            />
        ))}
    </motion.button>
);

export default TableMenu;
