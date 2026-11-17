const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

// Xem thông tin trang cá nhân của chính mình
const getProfile = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user.toJSON()
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải thông tin tài khoản.',
      error: error.message
    });
  }
};

// Cập nhật thông tin tài khoản (Họ tên, số điện thoại, avatar)
const updateProfile = async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const user = req.user;

    if (full_name) user.full_name = full_name;
    if (phone !== undefined) user.phone = phone;

    // Nếu người dùng tải avatar mới
    if (req.file) {
      user.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin tài khoản thành công!',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Lỗi cập nhật profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật thông tin tài khoản.',
      error: error.message
    });
  }
};

// Đổi mật khẩu
const changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    const user = req.user;

    const isMatch = await user.comparePassword(old_password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác.'
      });
    }

    user.password = new_password; // Hook beforeSave trong User model sẽ tự hash lại
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công! Vui lòng sử dụng mật khẩu mới cho lần đăng nhập sau.'
    });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể đổi mật khẩu.',
      error: error.message
    });
  }
};

// Lấy danh sách tin đăng của chính mình (có lọc theo trạng thái)
const getMyListings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const { Product, ProductImage, Category } = getModels();

    const where = { user_id: req.user.id };
    if (status) {
      where.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: ProductImage,
          as: 'images',
          attributes: ['id', 'image_url', 'is_primary']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug']
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
        products: rows
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách tin của người dùng:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách tin đăng của bạn.',
      error: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getMyListings
};
