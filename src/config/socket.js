const { Server } = require('socket.io');

const initSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // Tham gia phòng hội thoại cụ thể
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
    });

    // Rời phòng hội thoại
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
    });

    // Sự kiện đang nhập văn bản (typing indicator)
    socket.on('typing', ({ conversationId, username }) => {
      socket.to(`conversation_${conversationId}`).emit('user_typing', { username });
    });

    socket.on('stop_typing', ({ conversationId }) => {
      socket.to(`conversation_${conversationId}`).emit('user_stop_typing');
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  return io;
};

module.exports = initSocketIO;
