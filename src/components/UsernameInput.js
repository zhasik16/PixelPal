import React, { useState } from 'react';
import '../styles/UsernameInput.css';

const UsernameInput = ({ onUsernameSet }) => {
    const [username, setUsername] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (username.trim()) {
            localStorage.setItem('pixelpal-username', username);
            onUsernameSet(username);
        }
    };

    return (
        <div className="username-container">
            <form onSubmit={handleSubmit}>
                <h2>Welcome to PixelPal!</h2>
                <div className="input-group">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        required
                    />
                    <button type="submit">Join</button>
                </div>
            </form>
        </div>
    );
};

export default UsernameInput; 