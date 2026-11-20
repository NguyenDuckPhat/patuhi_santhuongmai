const { Op } = require('sequelize');
const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

// ==========================================
// 1. DUYỆT TIN ĐĂNG (MODERATION)
// ==========================================

// Lấy danh sách tin đăng theo trạng thái (mặc định 'pending' để duyệt)
const getProductsForAdmin = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 10, q } = req.query;
    const { Product, ProductImage, Category, User } = getModels();

    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (q) {
      where.title = { [Op.like]: `%${q.trim()}%` };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        { model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: User, as: 'seller', attributes: ['id', 'username', 'full_name', 'email', 'phone'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    return res.status(200).json({
      success: true,
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
        products: rows
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách duyệt tin:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải danh sách duyệt tin.', error: error.message });
  }
};

// Duyệt hoặc từ chối tin đăng
const reviewProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejection_reason } = req.body; // action: 'approve' hoặc 'reject'
    const { Product } = getModels();

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin đăng.' });
    }

    if (action === 'approve') {
      product.status = 'approved';
      product.rejection_reason = null;
    } else if (action === 'reject') {
      product.status = 'rejected';
      product.rejection_reason = rejection_reason || 'Tin đăng không phù hợp tiêu chuẩn cộng đồng.';
    } else {
      return res.status(400).json({ success: false, message: 'Hành động không hợp lệ (approve hoặc reject).' });
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: action === 'approve' ? 'Đã duyệt tin đăng thành công!' : 'Đã từ chối tin đăng!',
      data: { product }
    });
  } catch (error) {
    console.error('Lỗi duyệt tin:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi xử lý duyệt tin.', error: error.message });
  }
};

// ==========================================
// 2. QUẢN LÝ NGƯỜI DÙNG & KHÓA/MỞ KHÓA TÀI KHOẢN
// ==========================================

// Danh sách người dùng
const getUsers = async (req, res) => {
  try {
    const { role, status, q, page = 1, limit = 10 } = req.query;
    const { User, Product } = getModels();

    const where = {};
    if (role && role !== 'all') where.role = role;
    if (status && status !== 'all') where.status = status;
    if (q) {
      where[Op.or] = [
        { username: { [Op.like]: `%${q.trim()}%` } },
        { email: { [Op.like]: `%${q.trim()}%` } },
        { full_name: { [Op.like]: `%${q.trim()}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'username', 'email', 'full_name', 'phone', 'avatar', 'role', 'status', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
        users: rows
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải danh sách người dùng.', error: error.message });
  }
};

// Khóa hoặc mở khóa tài khoản
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' hoặc 'locked'
    const { User } = getModels();

    if (!['active', 'locked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái tài khoản không hợp lệ.' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    // Không cho phép tự khóa tài khoản của chính mình (admin đang đăng nhập)
    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Bạn không thể tự khóa tài khoản quản trị viên của chính mình!' });
    }

    user.status = status;
    await user.save();

    return res.status(200).json({
      success: true,
      message: status === 'locked' ? `Đã khóa tài khoản @${user.username} thành công!` : `Đã mở khóa tài khoản @${user.username}!`,
      data: { user: user.toJSON() }
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái người dùng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái tài khoản.', error: error.message });
  }
};

// Thay đổi quyền (Role: member <-> admin)
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body; // 'member' hoặc 'admin'
    const { User } = getModels();

    if (!['member', 'admin', 'guest'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò người dùng không hợp lệ.' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Không thể tự thay đổi vai trò của chính mình.' });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Đã đổi vai trò của @${user.username} thành ${role}.`,
      data: { user: user.toJSON() }
    });
  } catch (error) {
    console.error('Lỗi đổi vai trò người dùng:', error);
    return res.status(500).json({ success: false, message: 'Không thể đổi vai trò người dùng.', error: error.message });
  }
};

// ==========================================
// 3. QUẢN LÝ DANH MỤC SẢN PHẨM (CRUD)
// ==========================================

const createCategory = async (req, res) => {
  try {
    const { name, slug, description, icon } = req.body;
    const { Category } = getModels();

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống.' });
    }

    const finalSlug = (slug || name)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const existing = await Category.findOne({ where: { slug: finalSlug } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Slug danh mục này đã tồn tại.' });
    }

    const category = await Category.create({
      name: name.trim(),
      slug: finalSlug,
      description: description ? description.trim() : null,
      icon: icon || 'bi-grid'
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo danh mục mới thành công!',
      data: { category }
    });
  } catch (error) {
    console.error('Lỗi tạo danh mục:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi tạo danh mục.', error: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, icon } = req.body;
    const { Category } = getModels();

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    }

    if (name) category.name = name.trim();
    if (slug) category.slug = slug.trim();
    if (description !== undefined) category.description = description;
    if (icon) category.icon = icon;

    await category.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật danh mục thành công!',
      data: { category }
    });
  } catch (error) {
    console.error('Lỗi cập nhật danh mục:', error);
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật danh mục.', error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { Category, Product } = getModels();

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    }

    // Kiểm tra xem danh mục còn sản phẩm hay không
    const productCount = await Product.count({ where: { category_id: id } });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa danh mục này vì còn ${productCount} sản phẩm đang thuộc danh mục.`
      });
    }

    await category.destroy();

    return res.status(200).json({
      success: true,
      message: 'Đã xóa danh mục thành công!'
    });
  } catch (error) {
    console.error('Lỗi xóa danh mục:', error);
    return res.status(500).json({ success: false, message: 'Lỗi xóa danh mục.', error: error.message });
  }
};

// ==========================================
// 4. XỬ LÝ BÁO CÁO VI PHẠM
// ==========================================

const getReports = async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 10 } = req.query;
    const { Report, Product, User, ProductImage } = getModels();

    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Report.findAndCountAll({
      where,
      include: [
        {
          model: Product,
          as: 'product',
          include: [{ model: ProductImage, as: 'images', attributes: ['image_url'] }]
        },
        {
          model: User,
          as: 'reporter',
          attributes: ['id', 'username', 'full_name', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      data: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
        reports: rows
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách báo cáo:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải danh sách báo cáo.', error: error.message });
  }
};

const processReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note, hide_product } = req.body; // status: 'reviewed', 'resolved', 'dismissed'
    const { Report, Product } = getModels();

    if (!['reviewed', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái xử lý không hợp lệ.' });
    }

    const report = await Report.findByPk(id, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo này.' });
    }

    report.status = status;
    if (admin_note) report.admin_note = admin_note.trim();
    await report.save();

    // Nếu chọn ẩn hoặc gỡ sản phẩm khi giải quyết báo cáo
    if (hide_product && report.product) {
      report.product.status = 'rejected';
      report.product.rejection_reason = 'Tin đăng bị gỡ do vi phạm tiêu chuẩn cộng đồng sau khi xác minh báo cáo.';
      await report.product.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Xử lý báo cáo thành công!',
      data: { report }
    });
  } catch (error) {
    console.error('Lỗi xử lý báo cáo:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi xử lý báo cáo.', error: error.message });
  }
};

// ==========================================
// 5. QUẢN LÝ BÌNH LUẬN SẢN PHẨM
// ==========================================

// Danh sách bình luận theo trạng thái (mặc định PENDING để duyệt)
const getCommentsForAdmin = async (req, res) => {
  try {
    const { status = 'PENDING', page = 1, limit = 20 } = req.query;
    const { Comment, User, Product } = getModels();

    const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'all'];
    const where = allowedStatuses.includes(status) && status !== 'all' ? { status } : {};
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const { count, rows } = await Comment.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'full_name', 'avatar'] },
        { model: Product, as: 'product', attributes: ['id', 'title'] }
      ],
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
      distinct: true
    });

    return res.status(200).json({
      success: true,
      data: {
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum),
        comments: rows
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách bình luận:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải danh sách bình luận.' });
  }
};

// Duyệt hoặc từ chối bình luận
const reviewComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};
    const { Comment } = getModels();

    const comment = await Comment.findByPk(id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận.' });
    }

    if (action === 'approve') {
      comment.status = 'APPROVED';
    } else if (action === 'reject') {
      comment.status = 'REJECTED';
    } else {
      return res.status(400).json({ success: false, message: 'Hành động không hợp lệ (approve hoặc reject).' });
    }

    await comment.save();

    return res.status(200).json({
      success: true,
      message: action === 'approve' ? 'Đã duyệt bình luận thành công!' : 'Đã từ chối bình luận!',
      data: { comment }
    });
  } catch (error) {
    console.error('Lỗi duyệt bình luận:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi xử lý bình luận.' });
  }
};

// ==========================================
// 6. THỐNG KÊ (DASHBOARD STATS)
// ==========================================

const getDashboardStats = async (req, res) => {
  try {
    const { User, Product, Report, Category, Comment } = getModels();

    // 1. Thống kê người dùng
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { status: 'active' } });
    const lockedUsers = await User.count({ where: { status: 'locked' } });
    const adminUsers = await User.count({ where: { role: 'admin' } });
    const memberUsers = await User.count({ where: { role: 'member' } });

    // 2. Thống kê tin đăng
    const totalProducts = await Product.count();
    const pendingProducts = await Product.count({ where: { status: 'pending' } });
    const approvedProducts = await Product.count({ where: { status: 'approved' } });
    const soldProducts = await Product.count({ where: { status: 'sold' } });
    const rejectedProducts = await Product.count({ where: { status: 'rejected' } });

    // Thống kê tin theo từng danh mục
    const categories = await Category.findAll({
      attributes: ['id', 'name'],
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id']
        }
      ]
    });
    const productsByCategory = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      count: cat.products ? cat.products.length : 0
    }));

    // 3. Thống kê báo cáo
    const totalReports = await Report.count();
    const pendingReports = await Report.count({ where: { status: 'pending' } });
    const resolvedReports = await Report.count({ where: { status: 'resolved' } });
    const dismissedReports = await Report.count({ where: { status: 'dismissed' } });

    // 4. Thống kê bình luận
    const pendingComments = await Comment.count({ where: { status: 'PENDING' } });

    return res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          locked: lockedUsers,
          admins: adminUsers,
          members: memberUsers
        },
        products: {
          total: totalProducts,
          pending: pendingProducts,
          approved: approvedProducts,
          sold: soldProducts,
          rejected: rejectedProducts,
          byCategory: productsByCategory
        },
        reports: {
          total: totalReports,
          pending: pendingReports,
          resolved: resolvedReports,
          dismissed: dismissedReports
        },
        comments: {
          pending: pendingComments
        }
      }
    });
  } catch (error) {
    console.error('Lỗi lấy dữ liệu thống kê:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải thống kê hệ thống.', error: error.message });
  }
};

module.exports = {
  getProductsForAdmin,
  reviewProduct,
  getUsers,
  toggleUserStatus,
  changeUserRole,
  createCategory,
  updateCategory,
  deleteCategory,
  getReports,
  processReport,
  getCommentsForAdmin,
  reviewComment,
  getDashboardStats
};
