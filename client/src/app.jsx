import React, { useState, useEffect, useRef } from "react";
import socket from "./socket/socket";

const App = () => {
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [audio] = useState(() => new Audio("/notification.mp3"));
  const [joined, setJoined] = useState(false);
  const [file, setFile] = useState(null);
  const [page, setPage] = useState(1);
  const chatBoxRef = useRef(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Connect and handle socket events
  useEffect(() => {
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("user_list", (data) => setUsers(data));
    socket.on("typing_users", (data) => setTypingUsers(data));

    socket.on("receive_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.sender !== username && msg.type === "text") {
        audio.play().catch(() => {});
        if (document.hidden && Notification.permission === "granted") {
          new Notification(`New message from ${msg.sender}`, {
            body: msg.message,
            icon: "/chat-icon.png",
          });
        }
      }
    });

    socket.on("private_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.sender !== username) audio.play().catch(() => {});
    });

    socket.on("user_joined", ({ username: name }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "System",
          message: `${name} joined the chat`,
          time: new Date().toLocaleTimeString(),
          type: "system",
        },
      ]);
    });

    socket.on("user_left", ({ username: name }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: "System",
          message: `${name} left the chat`,
          time: new Date().toLocaleTimeString(),
          type: "system",
        },
      ]);
    });

    socket.on("update_reactions", (updated) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    });

    socket.on("message_delivered", ({ originalCid, id, timestamp }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.cid === originalCid ? { ...m, delivered: true, id, timestamp } : m
        )
      );
    });

    socket.on("read_update", ({ messageId, readBy }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, readBy } : m
        )
      );
    });

    socket.on("messages_page", (newMsgs) => {
      setMessages((prev) => [...newMsgs, ...prev]);
      setLoadingMore(false);
    });

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("user_list");
      socket.off("typing_users");
      socket.off("receive_message");
      socket.off("private_message");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("update_reactions");
      socket.off("message_delivered");
      socket.off("read_update");
      socket.off("messages_page");
    };
  }, [username, audio]);

  // Load latest messages after joining or reconnecting
  useEffect(() => {
    if (joined && socket.connected) {
      socket.emit("get_messages", 1, 50);
    }
  }, [joined]);

  // Infinite scroll pagination
  const handleScroll = () => {
    if (!chatBoxRef.current || loadingMore) return;
    if (chatBoxRef.current.scrollTop < 50) {
      const nextPage = page + 1;
      setLoadingMore(true);
      socket.emit("get_messages", nextPage, 50);
      setPage(nextPage);
    }
  };

  // Join chat
  const handleJoin = () => {
    if (!username.trim()) return alert("Enter a username first");
    if (!socket.connected) socket.connect();
    socket.emit("user_join", username);
    setJoined(true);
    socket.emit("request_sync");
  };

  // Send message
  const sendMessage = () => {
    if (!message.trim() && !file) return;

    const msgData = {
      cid: Date.now() + Math.floor(Math.random() * 1000),
      sender: username,
      time: new Date().toLocaleTimeString(),
      type: file ? "file" : "text",
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        msgData.fileName = file.name;
        msgData.fileData = reader.result;
        msgData.fileType = file.type;

        if (selectedUser) {
          socket.emit("private_message", { to: selectedUser.id, ...msgData }, (ack) => {
            if (ack.status === "delivered") {
              msgData.delivered = true;
              msgData.id = ack.id;
              msgData.timestamp = ack.timestamp;
              setMessages((prev) => [...prev, msgData]);
            }
          });
        } else {
          socket.emit("send_message", msgData, (ack) => {
            if (ack.status === "delivered") {
              msgData.delivered = true;
              msgData.id = ack.id;
              msgData.timestamp = ack.timestamp;
              setMessages((prev) => [...prev, msgData]);
            }
          });
        }
        setFile(null);
      };
      reader.readAsDataURL(file);
    } else {
      msgData.message = message;
      if (selectedUser) {
        socket.emit("private_message", { to: selectedUser.id, message, cid: msgData.cid }, (ack) => {
          if (ack.status === "delivered") {
            msgData.delivered = true;
            msgData.id = ack.id;
            msgData.timestamp = ack.timestamp;
          }
          setMessages((prev) => [...prev, msgData]);
        });
      } else {
        socket.emit("send_message", msgData, (ack) => {
          if (ack.status === "delivered") {
            msgData.delivered = true;
            msgData.id = ack.id;
            msgData.timestamp = ack.timestamp;
          }
          setMessages((prev) => [...prev, msgData]);
        });
      }
    }

    setMessage("");
  };

  // Typing indicator
  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", e.target.value.length > 0);
  };

  const addReaction = (msgId, emoji) => {
    socket.emit("add_reaction", { msgId, emoji });
  };

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const markAsRead = (msgId) => {
    socket.emit("message_read", { messageId: msgId });
  };

  if (!joined) {
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "100px",
          fontFamily: "sans-serif",
        }}
      >
        <h2>💬 Real-Time Chat</h2>
        <input
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: "10px", width: "250px", marginRight: "10px" }}
        />
        <button
          onClick={handleJoin}
          style={{
            padding: "10px 20px",
            backgroundColor: "green",
            color: "white",
            border: "none",
          }}
        >
          Join Chat
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* USERS */}
      <div
        style={{
          width: "25%",
          borderRight: "1px solid #ccc",
          padding: "10px",
        }}
      >
        <h3>👥 Users</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {users.map((u) => (
            <li
              key={u.id}
              onClick={() => setSelectedUser(u)}
              style={{
                padding: "5px",
                background:
                  selectedUser?.id === u.id ? "lightgreen" : "transparent",
                cursor: "pointer",
              }}
            >
              {u.username} {u.id === socket.id && "(You)"}
            </li>
          ))}
        </ul>
      </div>

      {/* CHAT */}
      <div
        style={{
          flex: 1,
          padding: "10px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2>
          💬 {selectedUser ? `Chat with ${selectedUser.username}` : "Global Chat"}
        </h2>
        {!isConnected && <p style={{ color: "red" }}>Disconnected</p>}

        <div
          ref={chatBoxRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            border: "1px solid #ccc",
            padding: "10px",
            overflowY: "auto",
            marginBottom: "10px",
          }}
        >
          {loadingMore && (
            <p style={{ textAlign: "center", color: "gray" }}>Loading older messages...</p>
          )}
          {messages.map((m) => (
            <div key={m.id || m.cid} style={{ marginBottom: "10px" }}>
              {m.type === "system" ? (
                <p style={{ textAlign: "center", color: "gray" }}>
                  {m.message} — <small>{m.time}</small>
                </p>
              ) : (
                <>
                  <strong>{m.sender}</strong>:{" "}
                  {m.type === "text" ? (
                    <>
                      {m.message}{" "}
                      <small style={{ color: "gray" }}>({m.time})</small>
                    </>
                  ) : (
                    <>
                      {m.fileType?.startsWith("image/") ? (
                        <img
                          src={m.fileData}
                          alt={m.fileName}
                          style={{ maxWidth: "200px", display: "block" }}
                        />
                      ) : (
                        <a href={m.fileData} download={m.fileName}>
                          📎 {m.fileName}
                        </a>
                      )}
                      <small style={{ color: "gray" }}> ({m.time})</small>
                    </>
                  )}
                  <div>
                    <button onClick={() => addReaction(m.id, "👍")}>👍</button>
                    <button onClick={() => addReaction(m.id, "❤️")}>❤️</button>
                    <button onClick={() => addReaction(m.id, "😂")}>😂</button>
                    {m.reactions && (
                      <span style={{ marginLeft: "5px" }}>
                        {Object.entries(m.reactions)
                          .map(([emoji, count]) => `${emoji} ${count}`)
                          .join(" ")}
                      </span>
                    )}
                  </div>

                  {/* Delivery / Read indicators */}
                  {m.sender === username && (
                    <div style={{ fontSize: "12px", color: "gray" }}>
                      {m.readBy?.length > 0
                        ? "✓✓ Read"
                        : m.delivered
                        ? "✓ Delivered"
                        : "⏳ Sending..."}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {typingUsers.length > 0 && (
          <p style={{ color: "gray" }}>
            {typingUsers.join(", ")}{" "}
            {typingUsers.length > 1 ? "are" : "is"} typing...
          </p>
        )}

        <div>
          <input
            type="text"
            value={message}
            onChange={handleTyping}
            placeholder="Type a message..."
            onBlur={() => socket.emit("typing", false)}
            style={{ width: "60%", padding: "10px" }}
          />
          <input type="file" onChange={handleFileChange} />
          <button
            onClick={sendMessage}
            style={{
              padding: "10px",
              backgroundColor: "green",
              color: "white",
              border: "none",
              marginLeft: "5px",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
