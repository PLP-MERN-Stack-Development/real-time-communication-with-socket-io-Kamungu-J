import React, { useEffect, useState, useRef } from 'react';
import socket, { connect, on, off, sendMessage, startTyping, stopTyping, joinRoom, leaveRoom, reactToMessage, markRead } from '../socket/socket';
import dayjs from 'dayjs';

export default function Chat({ username, onLogout }) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [room, setRoom] = useState('global');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [page, setPage] = useState(1);
  const listRef = useRef();

  useEffect(() => {
    connect(username);
    on('connect', () => setConnected(true));
    on('disconnect', () => setConnected(false));
    on('user:list', (u) => setUsers(u));
    on('notification', (n) => {
      // browser notification
      if (Notification && Notification.permission === 'granted') {
        new Notification(n.text || 'Notification');
      }
    });
    on('message', (m) => {
      setMessages(prev => [...prev, m]);
      playSound();
    });
    on('message:update', (m) => {
      setMessages(prev => prev.map(p => p.id === m.id ? m : p));
    });
    on('typing', ({ from }) => setTypingUsers(prev => ({ ...prev, [from.userId]: from.username })));
    on('stopTyping', ({ from }) => setTypingUsers(prev => {
      const cp = { ...prev }; delete cp[from.userId]; return cp;
    }));
    on('read:update', ({ messageId, readBy }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, readBy } : m));
    });

    // request Notification permission
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    // load first page
    fetchMessages(1);

    return () => {
      off('connect'); off('disconnect'); off('user:list'); off('notification'); off('message'); off('typing'); off('stopTyping'); off('message:update'); off('read:update');
      try { socket.disconnect(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    // scroll on new messages
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function fetchMessages(p = 1) {
    const res = await fetch(`${process.env.REACT_APP_SERVER_URL || 'http://localhost:5000'}/messages?room=${room}&page=${p}&limit=20`);
    const json = await res.json();
    if (p === 1) setMessages(json.messages.reverse());
    else setMessages(prev => [...json.messages.reverse(), ...prev]);
    setPage(p);
  }

  function handleSend(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    sendMessage({ room, text: text.trim(), type: 'text' });
    setText('');
    stopTyping({ room });
  }

  let typingTimeout = useRef(null);
  function handleTypingChange(v) {
    setText(v);
    startTyping({ room });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => stopTyping({ room }), 800);
  }

  function playSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=');
      audio.play().catch(()=>{});
    } catch {}
  }

  function handleReact(messageId, reaction) {
    reactToMessage({ messageId, reaction });
  }

  function handleRead(messageId) {
    markRead({ messageId });
  }

  function logout() {
    onLogout();
    socket.disconnect();
  }

  return (
    <div className="chat">
      <header>
        <div className="left">
          <strong>Realtime Chat</strong>
          <span className={`status ${connected ? 'online' : 'offline'}`}>{connected ? 'online' : 'offline'}</span>
        </div>
        <div className="right">
          <span>{username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          <div>
            <h4>Rooms</h4>
            <button onClick={() => { leaveRoom(room); setRoom('global'); joinRoom({ room: 'global' }); fetchMessages(1); }}>Global</button>
            <button onClick={() => { leaveRoom(room); setRoom('dev'); joinRoom({ room: 'dev' }); fetchMessages(1); }}>Dev</button>
          </div>
          <div>
            <h4>Users</h4>
            <ul>
              {users.map(u => <li key={u.userId} className={u.online ? 'online' : ''}>{u.username} {u.online ? '●' : '○'}</li>)}
            </ul>
          </div>
        </aside>

        <section className="conversation">
          <div className="messages" ref={listRef}>
            <button onClick={() => fetchMessages(page + 1)}>Load older</button>
            {messages.map(m => (
              <div key={m.id} className={`message ${m.from.username === username ? 'me' : ''}`} onMouseEnter={() => handleRead(m.id)}>
                <div className="meta">
                  <strong>{m.from.username}</strong>
                  <small>{dayjs(m.ts).format('HH:mm:ss')}</small>
                </div>
                <div className="body">
                  {m.type === 'text' ? <span>{m.text}</span> : <img src={m.text} alt="shared" style={{ maxWidth: 200 }} />}
                </div>
                <div className="actions">
                  <small>Reacts: {m.reactions?.length || 0}</small>
                  <button onClick={() => handleReact(m.id, '👍')}>👍</button>
                  <button onClick={() => handleReact(m.id, '❤️')}>❤️</button>
                  <small>{m.readBy?.length ? `Read: ${m.readBy.length}` : ''}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="typing">
            {Object.values(typingUsers).length ? `${Object.values(typingUsers).join(', ')} is typing...` : ''}
          </div>

          <form className="composer" onSubmit={handleSend}>
            <input value={text} onChange={e => handleTypingChange(e.target.value)} placeholder={`Message #${room}`} />
            <input type="file" onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                sendMessage({ room, text: reader.result, type: 'image' });
              };
              reader.readAsDataURL(file);
            }} />
            <button type="submit">Send</button>
          </form>
        </section>
      </div>
    </div>
  );
}
