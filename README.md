# 💬 Real-Time Chat Application (Socket.io + MERN)

A fully functional **real-time chat app** built with **React, Node.js, Express, and Socket.io**, supporting group and private messaging, typing indicators, reactions, and file sharing.

---

## 🚀 Features

### 🧩 Core Functionality
- Real-time bidirectional communication using **Socket.io**
- **Username-based authentication** (lightweight, no sign-up)
- **Global chat room** for all connected users
- **Private messaging (DMs)** between users
- **Message timestamps** and delivery acknowledgment

### 💡 Interactive UX
- **Typing indicators** (shows who’s typing)
- **Online/offline status** updates
- **Join/leave notifications**
- **Message reactions** (👍 ❤️ 😂)
- **File and image sharing**
- **Sound notifications** for new messages
- **Browser notifications** when tab is inactive

### ⚙️ Advanced Features
- Auto **reconnection logic** for dropped sockets
- **Message persistence (in-memory)** with capped storage
- **Performance optimized** event handling
- **Responsive UI** for both desktop and mobile

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|---------------|
| Frontend | React, Socket.io Client, Vite |
| Backend | Node.js, Express.js, Socket.io |
| Styling | Inline styles (simple layout) |
| Environment | dotenv, CORS enabled |

---

## 📦 Folder Structure

real-time-communication/
│
├── server/
│ ├── server.js
│ ├── .env
│ └── package.json
  └── node modules
  └── socket
      └── index.js
├── client/
│ ├── src/
│ │ ├── App.jsx
    ├── Main.jsx
    ├── styles.css
│ │ ├── socket/
│ │ │ └── socket.js
│ │ └── assets/
│ │ ├── notification.mp3
│ │ └── chat-icon.png
│ ├── package.json
│ └── vite.config.js
│
└── README.md


## ⚙️ Setup Instructions

### 1️⃣ Backend Setup
```bash
cd server
npm install

Create a .env file:
PORT=5000
CLIENT_URL=http://localhost:5173

#Run the server

 node server.js

Frontend setup
cd client
npm install
npm run dev

Visit:
👉 http://localhost:5173


![alt text](<Screenshot 2025-11-06 173250.png>) ![alt text](<Screenshot 2025-11-06 173314.png>)