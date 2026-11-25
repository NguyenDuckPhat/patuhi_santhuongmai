const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { getSequelize } = require('./database');
const initModels = require('../models');

const initSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token) {
        const tokenCookie = socket.handshake.headers.cookie
          ?.split(';')
          .map(cookie => cookie.trim())
          .find(cookie => cookie.startsWith('token='));
        if (tokenCookie) token = decodeURIComponent(tokenCookie.slice('token='.length));
      }
      if (!token) return next(new Error('Bạn cần đăng nhập để kết nối chat.'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'patuhi_super_secret_jwt_key_2026_xyz!');
      const { User } = initModels(getSequelize());
      const user = await User.findByPk(decoded.id, { attributes: ['id', 'role', 'status'] });
      if (!user || user.status === 'locked' || !['member', 'admin'].includes(user.role)) {
        return next(new Error('Tài khoản không được phép kết nối chat.'));
      }

      socket.data.userId = Number(user.id);
      next();
    } catch (error) {
      next(new Error('Phiên đăng nhập không hợp lệ.'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user_${socket.data.userId}`);

    // Chỉ thành viên của cuộc trò chuyện mới được tham gia phòng realtime.
    socket.on('join_conversation', async (conversationId) => {
      const id = Number(conversationId);
      if (!Number.isInteger(id) || id <= 0) return;

      try {
        const { Conversation } = initModels(getSequelize());
        const conversation = await Conversation.findOne({
          where: {
            id,
            [Op.or]: [{ buyer_id: socket.data.userId }, { seller_id: socket.data.userId }]
          },
          attributes: ['id']
        });
        if (conversation) socket.join(`conversation_${id}`);
      } catch (error) {
        console.error('Không thể tham gia phòng chat:', error.message);
      }
    });

    // Rời phòng hội thoại
    socket.on('leave_conversation', (conversationId) => {
      const id = Number(conversationId);
      if (Number.isInteger(id) && id > 0) socket.leave(`conversation_${id}`);
    });

    // Sự kiện đang nhập văn bản (typing indicator)
    socket.on('typing', ({ conversationId, username }) => {
      const id = Number(conversationId);
      const room = `conversation_${id}`;
      if (Number.isInteger(id) && socket.rooms.has(room)) {
        socket.to(room).emit('user_typing', { username });
      }
    });

    socket.on('stop_typing', ({ conversationId }) => {
      const id = Number(conversationId);
      const room = `conversation_${id}`;
      if (Number.isInteger(id) && socket.rooms.has(room)) {
        socket.to(room).emit('user_stop_typing');
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  return io;
};

module.exports = initSocketIO;
