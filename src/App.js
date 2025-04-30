import React, { useState } from 'react';
import Canvas from './components/Canvas';
import UsernameInput from './components/UsernameInput';
import './App.css';

function App() {
  const [username, setUsername] = useState(null);

  return (
    <div className="App">
      {!username ? (
        <UsernameInput onUsernameSet={setUsername} />
      ) : (
        <Canvas username={username} />
      )}
    </div>
  );
}

export default App;
