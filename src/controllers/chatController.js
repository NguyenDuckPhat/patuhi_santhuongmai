const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

// 1. Lấy danh sách các cuộc hội thoại của người dùng hiện tại
const getConversations = async (req, res) => {
  try {
    const { Conversation, Product, ProductImage, User } = getModels();
    const userId = req.user.id;

    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [{ buyer_id: userId }, { seller_id: userId }]
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'title', 'price', 'status'],
          include: [
            {
              model: ProductImage,
              as: 'images',
              attributes: ['image_url', 'is_primary']
            }
          ]
        },
        {
          model: User,
          as: 'buyer',
          attributes: ['id', 'username', 'full_name', 'avatar']
        },
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'username', 'full_name', 'avatar']
        }
      ],
      order: [['last_message_at', 'DESC']]
    });

    // Định dạng dữ liệu để dễ hiển thị: xác định đối phương (otherParty)
    const formatted = conversations.map(conv => {
      const c = conv.toJSON();
      c.otherParty = c.buyer_id === userId ? c.seller : c.buyer;
      return c;
    });

    return res.status(200).json({
      success: true,
      data: {
        conversations: formatted
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách hội thoại:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách cuộc trò chuyện.',
      error: error.message
    });
  }
};

// 2. Mở hoặc tạo mới cuộc hội thoại với người bán về một sản phẩm
const getOrCreateConversation = async (req, res) => {
  try {
    const { productId } = req.body;
    const { Conversation, Product, User } = getModels();
    const buyerId = req.user.id;

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm này.'
      });
    }

    if (product.user_id === buyerId) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể tạo cuộc trò chuyện với chính mình.'
      });
    }

    const sellerId = product.user_id;

    // Tìm kiếm cuộc hội thoại đã có giữa 2 người về sản phẩm này
    let conversation = await Conversation.findOne({
      where: {
        product_id: parseInt(productId),
        buyer_id: buyerId,
        seller_id: sellerId
      }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        product_id: parseInt(productId),
        buyer_id: buyerId,
        seller_id: sellerId,
        last_message: 'Bắt đầu cuộc trò chuyện',
        last_message_at: new Date()
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        conversationId: conversation.id
      }
    });
  } catch (error) {
    console.error('Lỗi tạo hội thoại:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể khởi tạo cuộc trò chuyện.',
      error: error.message
    });
  }
};

const getReadStatus = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { Conversation, Message } = getModels();
    const userId = req.user.id;
    const conversation = await Conversation.findByPk(conversationId);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện này.' });
    }
    if (conversation.buyer_id !== userId && conversation.seller_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem trạng thái tin nhắn này.' });
    }

    const readMessages = await Message.findAll({
      where: { conversation_id: conversationId, sender_id: userId, is_read: true },
      attributes: ['id']
    });

    return res.status(200).json({
      success: true,
      data: { readMessageIds: readMessages.map(message => message.id) }
    });
  } catch (error) {
    console.error('Lỗi lấy trạng thái đã xem:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải trạng thái đã xem.',
      error: error.message
    });
  }
};

// 3. Xem lịch sử tin nhắn trong một cuộc hội thoại
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { Conversation, Message, User, Product, ProductImage } = getModels();
    const userId = req.user.id;

    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'title', 'price', 'status'],
          include: [{ model: ProductImage, as: 'images', attributes: ['image_url'] }]
        },
        { model: User, as: 'buyer', attributes: ['id', 'username', 'full_name', 'avatar'] },
        { model: User, as: 'seller', attributes: ['id', 'username', 'full_name', 'avatar'] }
      ]
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện này.'
      });
    }

    // Kiểm tra quyền: Người dùng phải là người mua hoặc người bán
    if (conversation.buyer_id !== userId && conversation.seller_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem cuộc trò chuyện này.'
      });
    }

    // Đánh dấu các tin nhắn đối phương gửi đến là đã đọc
    const [updatedReadCount] = await Message.update(
      { is_read: true },
      {
        where: {
          conversation_id: conversationId,
          sender_id: { [Op.ne]: userId },
          is_read: false
        }
      }
    );

    if (updatedReadCount > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation_${conversationId}`).emit('messages_read', {
          conversationId: Number(conversationId),
          readerId: userId
        });
      }
    }

    // Load after marking read so the viewer receives the current receipt state.
    const totalMessages = await Message.count({ where: { conversation_id: conversationId } });

    const limitQuery = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 30;
    const pageQuery = req.query.page !== undefined ? parseInt(req.query.page, 10) : 1;
    const validLimit = Math.max(1, isNaN(limitQuery) ? 30 : limitQuery);
    const validPage = Math.max(1, isNaN(pageQuery) ? 1 : pageQuery);
    const offset = req.query.offset !== undefined 
      ? Math.max(0, parseInt(req.query.offset, 10)) 
      : (validPage - 1) * validLimit;

    // Lấy tin nhắn theo thứ tự mới nhất trước để phục vụ phân trang
    const rawMessages = await Message.findAll({
      where: { conversation_id: conversationId },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'full_name', 'avatar']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: validLimit,
      offset
    });

    // Đảo ngược lại để hiển thị từ cũ đến mới (trên xuống dưới)
    const messages = rawMessages.reverse();

    const convData = conversation.toJSON();
    convData.otherParty = convData.buyer_id === userId ? convData.seller : convData.buyer;

    return res.status(200).json({
      success: true,
      data: {
        conversation: convData,
        messages,
        pagination: {
          total: totalMessages,
          page: validPage,
          limit: validLimit,
          totalPages: Math.ceil(totalMessages / validLimit),
          hasMore: offset + rawMessages.length < totalMessages
        }
      }
    });
  } catch (error) {
    console.error('Lỗi lấy lịch sử tin nhắn:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải tin nhắn.',
      error: error.message
    });
  }
};

// 4. Gửi tin nhắn mới (hỗ trợ văn bản và hình ảnh)
const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const { Conversation, Message, User } = getModels();
    const userId = req.user.id;

    const hasText = content && typeof content === 'string' && content.trim().length > 0;
    const hasImage = !!req.file;

    if (!hasText && !hasImage) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn hoặc hình ảnh không được để trống.'
      });
    }

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện.'
      });
    }

    if (conversation.buyer_id !== userId && conversation.seller_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không thuộc cuộc trò chuyện này.'
      });
    }

    const textContent = hasText ? content.trim() : '';
    const imageUrl = hasImage ? `/uploads/chats/${req.file.filename}` : null;

    const newMessage = await Message.create({
      conversation_id: parseInt(conversationId),
      sender_id: userId,
      content: textContent,
      image_url: imageUrl
    });

    // Cập nhật last_message của cuộc hội thoại
    let lastMsgText = textContent || '[Hình ảnh]';
    if (hasImage && hasText) {
      lastMsgText = `[Hình ảnh] ${textContent}`;
    }
    conversation.last_message = lastMsgText;
    conversation.last_message_at = new Date();
    await conversation.save();

    const fullMessage = await Message.findByPk(newMessage.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'full_name', 'avatar']
        }
      ]
    });

    // Phát sự kiện Real-time qua Socket.io nếu có
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation_${conversationId}`).emit('receive_message', fullMessage);
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công!',
      data: {
        message: fullMessage
      }
    });
  } catch (error) {
    console.error('Lỗi gửi tin nhắn:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể gửi tin nhắn.',
      error: error.message
    });
  }
};

// 5. Thu hồi / Xóa tin nhắn đã gửi
const recallMessage = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { Message, Conversation } = getModels();
    const userId = req.user.id;

    const message = await Message.findOne({
      where: {
        id: messageId,
        conversation_id: conversationId
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn cần thu hồi.'
      });
    }

    // Kiểm tra quyền: Chỉ người gửi hoặc Quản trị viên mới được thu hồi
    if (message.sender_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thu hồi tin nhắn này.'
      });
    }

    if (message.is_recalled) {
      return res.status(400).json({
        success: false,
        message: 'Tin nhắn này đã được thu hồi trước đó.'
      });
    }

    // Nếu có ảnh đính kèm, dọn dẹp file vật lý
    if (message.image_url) {
      const filePath = path.join(__dirname, '../../public', message.image_url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Lỗi xóa file ảnh tin nhắn thu hồi:', e.message);
        }
      }
      message.image_url = null;
    }

    message.is_recalled = true;
    message.content = 'Tin nhắn đã được thu hồi';
    await message.save();

    // Cập nhật lại last_message của cuộc hội thoại nếu tin bị thu hồi là tin mới nhất
    const conversation = await Conversation.findByPk(conversationId);
    if (conversation) {
      const latestMsg = await Message.findOne({
        where: { conversation_id: conversationId },
        order: [['created_at', 'DESC']]
      });
      if (latestMsg && latestMsg.id === message.id) {
        conversation.last_message = 'Tin nhắn đã được thu hồi';
        await conversation.save();
      }
    }

    // Phát sự kiện Socket.io Real-time tới các thành viên trong room
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation_${conversationId}`).emit('message_recalled', {
        conversationId: Number(conversationId),
        messageId: Number(message.id),
        content: 'Tin nhắn đã được thu hồi'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Thu hồi tin nhắn thành công!',
      data: {
        message
      }
    });
  } catch (error) {
    console.error('Lỗi thu hồi tin nhắn:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể thu hồi tin nhắn lúc này.',
      error: error.message
    });
  }
};

module.exports = {
  getConversations,
  getOrCreateConversation,
  getReadStatus,
  getMessages,
  sendMessage,
  recallMessage
};
