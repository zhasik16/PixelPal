import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import '../styles/Canvas.css';

const CANVAS_SIZE = 64;
const PIXEL_SIZE = 10;

const COLOR_PRESETS = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#008000', '#800000', '#000080', '#808080', '#C0C0C0'
];

const CANVAS_SIZES = [
    { label: 'Small (32x32)', value: 32 },
    { label: 'Medium (64x64)', value: 64 },
    { label: 'Large (128x128)', value: 128 },
    { label: 'Custom', value: 'custom' }
];

const Canvas = ({ username }) => {
    const canvasRef = useRef(null);
    const chatMessagesRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [users, setUsers] = useState([]);
    const [canvasSize, setCanvasSize] = useState(CANVAS_SIZE);
    const [isEraser, setIsEraser] = useState(false);
    const [isBanned, setIsBanned] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [customSize, setCustomSize] = useState({ width: 64, height: 64 });
    const [showCustomSizeInput, setShowCustomSizeInput] = useState(false);
    const [isGlobalBanActive, setIsGlobalBanActive] = useState(false);
    const [globalBanEndTime, setGlobalBanEndTime] = useState(null);

    useEffect(() => {
        const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:4000');
        setSocket(newSocket);

        newSocket.emit('user-join', username);

        newSocket.on('user-list', (userList) => {
            setUsers(userList);
        });

        newSocket.on('canvas-state', (state) => {
            const ctx = canvasRef.current.getContext('2d');
            setCanvasSize(state.size);
            state.pixels.forEach(({ x, y, color }) => {
                ctx.fillStyle = color;
                ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
            });
            drawGrid();
        });

        newSocket.on('canvas-update', (data) => {
            const ctx = canvasRef.current.getContext('2d');
            data.pixels.forEach(({ x, y, color }) => {
                ctx.fillStyle = color;
                ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
            });
            drawGrid();
        });

        newSocket.on('canvas-clear', () => {
            clearCanvas();
        });

        newSocket.on('chat-message', (message) => {
            setChatMessages(prev => [...prev, message]);
            setTimeout(() => {
                if (chatMessagesRef.current) {
                    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
                }
            }, 100);
        });

        newSocket.on('global-ban-status', ({ isActive, endTime }) => {
            setIsGlobalBanActive(isActive);
            setGlobalBanEndTime(endTime);
        });

        newSocket.on('global-ban-activated', ({ duration }) => {
            setIsGlobalBanActive(true);
            setGlobalBanEndTime(Date.now() + duration * 1000);
        });

        newSocket.on('global-ban-deactivated', () => {
            setIsGlobalBanActive(false);
            setGlobalBanEndTime(null);
        });

        newSocket.on('canvas-size-change', (size) => {
            setCanvasSize(size);
            clearCanvas();
        });

        return () => {
            newSocket.disconnect();
        };
    }, [username]);

    useEffect(() => {
        drawGrid();
    }, [canvasSize]);

    const drawGrid = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 0.5;

        for (let i = 0; i <= canvasSize; i++) {
            // Vertical lines
            ctx.beginPath();
            ctx.moveTo(i * PIXEL_SIZE, 0);
            ctx.lineTo(i * PIXEL_SIZE, canvasSize * PIXEL_SIZE);
            ctx.stroke();

            // Horizontal lines
            ctx.beginPath();
            ctx.moveTo(0, i * PIXEL_SIZE);
            ctx.lineTo(canvasSize * PIXEL_SIZE, i * PIXEL_SIZE);
            ctx.stroke();
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        if (socket) {
            socket.emit('clear-canvas');
        }
    };

    const handleCanvasSizeChange = (size) => {
        if (size === 'custom') {
            setShowCustomSizeInput(true);
        } else {
            setShowCustomSizeInput(false);
            setCanvasSize(size);
            if (socket) {
                socket.emit('canvas-size-change', size);
            }
        }
    };

    const handleCustomSizeSubmit = () => {
        const size = Math.min(Math.max(16, Math.floor(customSize.width)), 256);
        setCanvasSize(size);
        setShowCustomSizeInput(false);
        if (socket) {
            socket.emit('canvas-size-change', size);
        }
    };

    const activateGlobalBan = () => {
        if (socket && !isGlobalBanActive) {
            socket.emit('activate-global-ban');
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && socket) {
            socket.emit('chat-message', newMessage.trim());
            setNewMessage('');
        }
    };

    const draw = (e) => {
        if (!isDrawing || isBanned || isGlobalBanActive) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / PIXEL_SIZE);
        const y = Math.floor((e.clientY - rect.top) / PIXEL_SIZE);

        if (x >= 0 && x < canvasSize && y >= 0 && y < canvasSize) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = isEraser ? '#FFFFFF' : color;
            ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
            drawGrid();

            if (socket) {
                socket.emit('canvas-update', {
                    canvasId: 'main',
                    pixels: [{ x, y, color: isEraser ? '#FFFFFF' : color }]
                });
            }
        }
    };

    const downloadCanvas = () => {
        const canvas = canvasRef.current;
        const link = document.createElement('a');
        link.download = `pixelpal-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    return (
        <div className="canvas-container">
            <div className="users-list">
                <h3>Active Users:</h3>
                <ul>
                    {users.map((user, index) => (
                        <li key={index}>
                            <span className="username">{user.username}</span>
                        </li>
                    ))}
                </ul>
                <div className="chat-container">
                    <h3>Chat</h3>
                    <div className="chat-messages" ref={chatMessagesRef}>
                        {chatMessages.map((msg, index) => (
                            <div key={index} className="chat-message">
                                <span className="chat-username">{msg.username}</span>
                                <span className="chat-time">[{msg.timestamp}]</span>
                                <span className="chat-text">{msg.message}</span>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={sendMessage} className="chat-input">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                        />
                        <button type="submit">Send</button>
                    </form>
                </div>
            </div>
            <div className="canvas-wrapper">
                <canvas
                    ref={canvasRef}
                    width={canvasSize * PIXEL_SIZE}
                    height={canvasSize * PIXEL_SIZE}
                    onMouseDown={() => setIsDrawing(true)}
                    onMouseUp={() => setIsDrawing(false)}
                    onMouseMove={draw}
                    onMouseLeave={() => setIsDrawing(false)}
                    style={{ border: '1px solid black' }}
                />
                <div className="controls">
                    <div className="color-presets">
                        {COLOR_PRESETS.map((presetColor, index) => (
                            <button
                                key={index}
                                className="color-preset"
                                style={{ backgroundColor: presetColor }}
                                onClick={() => {
                                    setColor(presetColor);
                                    setIsEraser(false);
                                }}
                            />
                        ))}
                    </div>
                    <div className="tool-controls">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                                setColor(e.target.value);
                                setIsEraser(false);
                            }}
                        />
                        <button
                            className={`eraser-button ${isEraser ? 'active' : ''}`}
                            onClick={() => setIsEraser(!isEraser)}
                        >
                            Eraser
                        </button>
                        <button onClick={clearCanvas}>Clear Canvas</button>
                        <button
                            className={`ban-pixel-button ${isGlobalBanActive ? 'disabled' : ''}`}
                            onClick={activateGlobalBan}
                            disabled={isGlobalBanActive}
                        >
                            {isGlobalBanActive ? 'Pixel Ban Active' : 'Ban Pixels (2s)'}
                        </button>
                        <button
                            className="download-button"
                            onClick={downloadCanvas}
                        >
                            Download Canvas
                        </button>
                    </div>
                    <div className="size-controls">
                        <select
                            value={canvasSize}
                            onChange={(e) => handleCanvasSizeChange(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
                        >
                            {CANVAS_SIZES.map((size) => (
                                <option key={size.value} value={size.value}>
                                    {size.label}
                                </option>
                            ))}
                        </select>
                        {showCustomSizeInput && (
                            <div className="custom-size-input">
                                <input
                                    type="number"
                                    value={customSize.width}
                                    onChange={(e) => setCustomSize({ ...customSize, width: e.target.value })}
                                    placeholder="Width"
                                    min="16"
                                    max="256"
                                />
                                <button onClick={handleCustomSizeSubmit}>Apply</button>
                            </div>
                        )}
                    </div>
                </div>
                {isGlobalBanActive && (
                    <div className="global-ban-notification">
                        Pixel drawing is disabled for {Math.ceil((globalBanEndTime - Date.now()) / 1000)} seconds!
                    </div>
                )}
            </div>
        </div>
    );
};

export default Canvas; 