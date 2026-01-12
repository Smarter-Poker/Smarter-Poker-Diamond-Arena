/**
 * 💬 CHAT PANEL — Table Chat & Emotes
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Live chat panel for table communication with emotes and quick messages.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// 💬 TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    message: string;
    timestamp: Date;
    type: 'CHAT' | 'SYSTEM' | 'EMOTE' | 'ACTION';
}

const QUICK_EMOTES = ['👍', '👎', '😂', '🔥', '💎', '🎰', '🃏', '😎'];

const QUICK_MESSAGES = [
    'gg',
    'nh',
    'ty',
    'gl',
    'nice hand',
    'well played',
];

// ═══════════════════════════════════════════════════════════════════════════
// 💬 CHAT PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ChatPanelProps {
    messages: ChatMessage[];
    currentUserId: string;
    onSendMessage: (message: string) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
    messages,
    currentUserId,
    onSendMessage,
    isCollapsed = false,
    onToggleCollapse,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [showEmotes, setShowEmotes] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    }, [inputValue, onSendMessage]);

    const handleEmote = useCallback((emote: string) => {
        onSendMessage(emote);
        setShowEmotes(false);
    }, [onSendMessage]);

    const handleQuickMessage = useCallback((msg: string) => {
        onSendMessage(msg);
    }, [onSendMessage]);

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getMessageStyle = (msg: ChatMessage) => {
        switch (msg.type) {
            case 'SYSTEM':
                return { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' as const };
            case 'ACTION':
                return { color: '#FFB800' };
            case 'EMOTE':
                return { fontSize: 24 };
            default:
                return { color: '#FFF' };
        }
    };

    if (isCollapsed) {
        return (
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onToggleCollapse}
                style={{
                    position: 'absolute',
                    bottom: 20,
                    right: 20,
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                    color: '#FFF',
                    fontSize: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                💬
            </motion.button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
                width: 300,
                height: '100%',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(12px)',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div style={{
                    color: '#FFF',
                    fontSize: 13,
                    fontWeight: 600,
                }}>
                    💬 Table Chat
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={onToggleCollapse}
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 12,
                            cursor: 'pointer',
                        }}
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
            }}>
                {messages.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 12,
                        marginTop: 32,
                    }}>
                        No messages yet
                    </div>
                ) : (
                    messages.map(msg => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                marginBottom: 12,
                            }}
                        >
                            {/* Header */}
                            {msg.type !== 'SYSTEM' && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginBottom: 2,
                                }}>
                                    <span style={{
                                        color: msg.userId === currentUserId ? '#00E0FF' : '#FFB800',
                                        fontSize: 11,
                                        fontWeight: 600,
                                    }}>
                                        {msg.username}
                                    </span>
                                    <span style={{
                                        color: 'rgba(255,255,255,0.3)',
                                        fontSize: 10,
                                    }}>
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                            )}
                            {/* Message */}
                            <div style={{
                                paddingLeft: msg.type === 'SYSTEM' ? 0 : 0,
                                ...getMessageStyle(msg),
                                fontSize: msg.type === 'EMOTE' ? 24 : 13,
                                lineHeight: 1.4,
                            }}>
                                {msg.type === 'SYSTEM' && (
                                    <span style={{ marginRight: 4, fontSize: 10 }}>ℹ️</span>
                                )}
                                {msg.message}
                            </div>
                        </motion.div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Messages */}
            <div style={{
                padding: '8px 16px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
            }}>
                {QUICK_MESSAGES.slice(0, 4).map(msg => (
                    <button
                        key={msg}
                        onClick={() => handleQuickMessage(msg)}
                        style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 11,
                            cursor: 'pointer',
                        }}
                    >
                        {msg}
                    </button>
                ))}
            </div>

            {/* Emote Picker */}
            <AnimatePresence>
                {showEmotes && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{
                            padding: '8px 16px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            overflow: 'hidden',
                        }}
                    >
                        {QUICK_EMOTES.map(emote => (
                            <motion.button
                                key={emote}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleEmote(emote)}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    border: 'none',
                                    background: 'rgba(255,255,255,0.1)',
                                    fontSize: 18,
                                    cursor: 'pointer',
                                }}
                            >
                                {emote}
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input */}
            <form
                onSubmit={handleSubmit}
                style={{
                    padding: 12,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    gap: 8,
                }}
            >
                <button
                    type="button"
                    onClick={() => setShowEmotes(!showEmotes)}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: showEmotes ? 'rgba(255,184,0,0.2)' : 'transparent',
                        fontSize: 16,
                        cursor: 'pointer',
                    }}
                >
                    😀
                </button>
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={200}
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#FFF',
                        fontSize: 13,
                        outline: 'none',
                    }}
                />
                <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!inputValue.trim()}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: 'none',
                        background: inputValue.trim()
                            ? 'linear-gradient(180deg, #00E0FF 0%, #00A8CC 100%)'
                            : 'rgba(255,255,255,0.1)',
                        color: inputValue.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                        fontSize: 14,
                        cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                    }}
                >
                    ➤
                </motion.button>
            </form>
        </motion.div>
    );
};

export default ChatPanel;
