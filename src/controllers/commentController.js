const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

const parseProductId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Loại bỏ thẻ HTML và ký tự điều khiển để chặn XSS trước khi lưu vào database.
// Frontend vẫn render bằng textContent, đây là lớp bảo vệ bổ sung ở phía máy chủ.
const sanitizeContent = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim();
};

// 1. Danh sách bình luận công khai: chỉ APPROVED và chỉ thuộc sản phẩm đang xem.
const listComments = async (req, res) => {
  try {
    const productId = parseProductId(req.params.id);
    if (!productId) {
      return res.status(400).json({ success: false, message: 'ID sản phẩm không hợp lệ.' });
    }

    const { Comment, User, Product } = getModels();
    const product = await Product.findByPk(productId, { attributes: ['id', 'user_id', 'status'] });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm này.' });
    }

    const isOwner = req.user && req.user.id === product.user_id;
    const isAdmin = req.user && req.user.role === 'admin';
    if (product.status !== 'approved' && !isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Sản phẩm này hiện chưa được công khai hoặc đang chờ kiểm duyệt.'
      });
    }

    const where = { product_id: productId, status: 'APPROVED' };
    const [total, comments] = await Promise.all([
      Comment.count({ where }),
      Comment.findAll({
        where,
        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'full_name', 'avatar'] }],
        order: [['created_at', 'DESC']],
        limit: 100
      })
    ]);

    return res.status(200).json({
      success: true,
      data: { total, comments }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách bình luận:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải bình luận lúc này.' });
  }
};

// 2. Gửi bình luận mới: luôn PENDING, user_id/product_id lấy từ phiên & URL.
const createComment = async (req, res) => {
  try {
    const productId = parseProductId(req.params.id);
    if (!productId) {
      return res.status(400).json({ success: false, message: 'ID sản phẩm không hợp lệ.' });
    }

    const { Comment, Product, Order } = getModels();
    const product = await Product.findByPk(productId, { attributes: ['id', 'status', 'user_id'] });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm này.' });
    }
    if (product.status !== 'approved' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Sản phẩm này hiện chưa được công khai hoặc đang chờ kiểm duyệt.'
      });
    }

    const content = sanitizeContent(req.body && req.body.content);
    if (!content) {
      return res.status(400).json({ success: false, message: 'Nội dung bình luận không được để trống.' });
    }
    if (content.length > 1000) {
      return res.status(400).json({ success: false, message: 'Nội dung bình luận tối đa 1000 ký tự.' });
    }

    const inputRating = req.body?.rating;
    let rating = null;
    if (inputRating != null) {
      if (!Number.isInteger(inputRating) || inputRating < 1 || inputRating > 5) {
        return res.status(400).json({ success: false, message: 'Điểm đánh giá phải từ 1 đến 5 sao.' });
      }
      if (req.user.id === product.user_id) {
        return res.status(403).json({ success: false, message: 'Bạn không thể tự đánh giá tin đăng của mình.' });
      }
      rating = inputRating;
    }

    // Đánh giá từ đơn hàng: chỉ khi có order_id hợp lệ và có điểm sao.
    // Không truyền order_id thì vẫn là bình luận sản phẩm bình thường như cũ.
    let linkedOrder = null;
    const rawOrderId = req.body && req.body.order_id;
    if (rawOrderId != null && rawOrderId !== '') {
      const orderId = Number(rawOrderId);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ success: false, message: 'Mã đơn hàng đánh giá không hợp lệ.' });
      }

      linkedOrder = await Order.findOne({
        where: { id: orderId, buyer_id: req.user.id, status: 'completed' }
      });
      if (!linkedOrder) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ có thể đánh giá đơn hàng đã hoàn thành của chính mình.'
        });
      }
      if (linkedOrder.product_id && Number(linkedOrder.product_id) !== productId) {
        return res.status(400).json({ success: false, message: 'Đơn hàng này không khớp với sản phẩm đang đánh giá.' });
      }
      if (rating === null) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn điểm đánh giá trước khi gửi.' });
      }

      const alreadyRated = await Comment.findOne({
        where: { order_id: orderId },
        attributes: ['id']
      });
      if (alreadyRated) {
        return res.status(400).json({ success: false, message: 'Đơn hàng này đã được đánh giá.' });
      }
    }

    const comment = await Comment.create({
      product_id: productId,
      user_id: req.user.id,
      order_id: linkedOrder ? linkedOrder.id : null,
      content,
      rating,
      status: 'PENDING'
    });

    return res.status(201).json({
      success: true,
      message: 'Bình luận của bạn đã được gửi thành công và đang chờ quản trị viên xét duyệt.',
      data: {
        comment: {
          id: comment.id,
          order_id: comment.order_id,
          status: comment.status,
          created_at: comment.created_at
        }
      }
    });
  } catch (error) {
    console.error('Lỗi gửi bình luận:', error);
    return res.status(500).json({ success: false, message: 'Không thể gửi bình luận lúc này.' });
  }
};

module.exports = {
  listComments,
  createComment
};
