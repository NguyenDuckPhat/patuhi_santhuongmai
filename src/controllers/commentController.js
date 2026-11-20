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

    const { Comment, Product } = getModels();
    const product = await Product.findByPk(productId, { attributes: ['id', 'status'] });
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

    const comment = await Comment.create({
      product_id: productId,
      user_id: req.user.id,
      content,
      status: 'PENDING'
    });

    return res.status(201).json({
      success: true,
      message: 'Bình luận của bạn đã được gửi thành công và đang chờ quản trị viên xét duyệt.',
      data: {
        comment: {
          id: comment.id,
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
