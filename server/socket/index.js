const { v4: uuidv4 } = require('uuid');

module.exports = (io, store) => {
  io.on('connection', (socket) => {
    // client should emit 'auth' with { username } to register
    socket.on('auth', ({ username }) => {
      if (!username) return;
      const userId = store.usersByName[username] || uuidv4();
      store.usersByName[username] = userId;
      store.users[socket.id] = { username, userId, online: true, socketId: socket.id };
      socket.data.username = username;
      socket.data.userId = userId;

      // join global room by default
      socket.join('global');

      // notify others
      io.emit('user:list', Object.values(store.users).map(u => ({ username: u.username, userId: u.userId, online: u.online })));
      io.to('global').emit('notification', { text: `${username} joined global room`, ts: Date.now() });
    });

    // join room
    socket.on('join', ({ room }) => {
      if (!room) return;
      socket.join(room);
      io.to(room).emit('notification', { text: `${socket.data.username || 'A user'} joined ${room}`, ts: Date.now() });
    });

    // leave room
    socket.on('leave', ({ room }) => {
      if (!room) return;
      socket.leave(room);
      io.to(room).emit('notification', { text: `${socket.data.username || 'A user'} left ${room}`, ts: Date.now() });
    });

    // global or private message
    socket.on('message', (payload) => {
      // payload: { room, toUserId (optional for private), text, type:'text'|'image' }
      const msg = {
        id: uuidv4(),
        room: payload.room || 'global',
        from: { username: socket.data.username, userId: socket.data.userId },
        to: payload.toUserId || null,
        text: payload.text || '',
        type: payload.type || 'text',
        ts: Date.now(),
        readBy: [],
        reactions: []
      };

      store.messages.push(msg);

      if (payload.toUserId) {
        // private: emit to both participants (use socket IDs list)
        const recipients = Object.values(store.users).filter(u => u.userId === payload.toUserId || u.userId === socket.data.userId);
        recipients.forEach(u => {
          io.to(u.socketId).emit('message', msg);
        });
      } else {
        io.to(msg.room).emit('message', msg);
      }

      // notification for receiver(s)
      if (payload.toUserId) {
        const target = Object.values(store.users).find(u => u.userId === payload.toUserId);
        if (target) io.to(target.socketId).emit('notification', { text: `New private message from ${socket.data.username}`, ts: Date.now() });
      }
    });

    // typing indicator
    socket.on('typing', ({ room, toUserId }) => {
      if (toUserId) {
        const target = Object.values(store.users).find(u => u.userId === toUserId);
        if (target) io.to(target.socketId).emit('typing', { from: { username: socket.data.username, userId: socket.data.userId } });
      } else {
        socket.to(room || 'global').emit('typing', { from: { username: socket.data.username, userId: socket.data.userId } });
      }
    });

    socket.on('stopTyping', ({ room, toUserId }) => {
      if (toUserId) {
        const target = Object.values(store.users).find(u => u.userId === toUserId);
        if (target) io.to(target.socketId).emit('stopTyping', { from: { username: socket.data.username } });
      } else {
        socket.to(room || 'global').emit('stopTyping', { from: { username: socket.data.username } });
      }
    });

    // reactions
    socket.on('react', ({ messageId, reaction }) => {
      const msg = store.messages.find(m => m.id === messageId);
      if (!msg) return;
      msg.reactions = msg.reactions || [];
      msg.reactions.push({ by: socket.data.userId, reaction, ts: Date.now() });
      // broadcast updated message
      if (msg.to) {
        const participants = Object.values(store.users).filter(u => u.userId === msg.to || u.userId === msg.from.userId);
        participants.forEach(u => io.to(u.socketId).emit('message:update', msg));
      } else {
        io.to(msg.room).emit('message:update', msg);
      }
    });

    // read receipts
    socket.on('read', ({ messageId }) => {
      const msg = store.messages.find(m => m.id === messageId);
      if (!msg) return;
      if (!msg.readBy.includes(socket.data.userId)) msg.readBy.push(socket.data.userId);
      // notify sender
      const sender = Object.values(store.users).find(u => u.userId === msg.from.userId);
      if (sender) io.to(sender.socketId).emit('read:update', { messageId, readBy: msg.readBy });
    });

    // disconnect
    socket.on('disconnect', () => {
      const info = store.users[socket.id];
      if (info) {
        info.online = false;
        io.emit('user:list', Object.values(store.users).map(u => ({ username: u.username, userId: u.userId, online: u.online })));
        io.emit('notification', { text: `${info.username} disconnected`, ts: Date.now() });
        delete store.users[socket.id];
      }
    });

    // simple presence ping/pong handled by socket.io heartbeat; add explicit online toggle
    socket.on('presence', ({ online }) => {
      if (store.users[socket.id]) {
        store.users[socket.id].online = online;
        io.emit('user:list', Object.values(store.users).map(u => ({ username: u.username, userId: u.userId, online: u.online })));
      }
    });
  });
};
