import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  return (
    <div className="login">
      <h2>Join Chat</h2>
      <input placeholder="Enter username" value={name} onChange={e => setName(e.target.value)} />
      <button onClick={() => { if (!name.trim()) return; onLogin(name.trim()); }}>Enter</button>
    </div>
  );
}
