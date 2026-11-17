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

    // Lấy tin nhắn
    const messages = await Message.findAll({
      where: { conversation_id: conversationId },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'full_name', 'avatar']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    // Đánh dấu các tin nhắn đối phương gửi đến là đã đọc
    await Message.update(
      { is_read: true },
      {
        where: {
          conversation_id: conversationId,
          sender_id: { [Op.ne]: userId },
          is_read: false
        }
      }
    );

    const convData = conversation.toJSON();
    convData.otherParty = convData.buyer_id === userId ? convData.seller : convData.buyer;

    return res.status(200).json({
      success: true,
      data: {
        conversation: convData,
        messages
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

// 4. Gửi tin nhắn mới
const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const { Conversation, Message, User } = getModels();
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống.'
      });
    }

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện.'
      });
    }

    if (conversation.buyer_id !== userId && conversation.seller_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không thuộc cuộc trò chuyện này.'
      });
    }

    const newMessage = await Message.create({
      conversation_id: parseInt(conversationId),
      sender_id: userId,
      content: content.trim()
    });

    // Cập nhật last_message của cuộc hội thoại
    conversation.last_message = content.trim();
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

module.exports = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage
};
