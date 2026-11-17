const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

// Tạo JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || 'patuhi_super_secret_jwt_key_2026_xyz!',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
};

// Đăng ký tài khoản mới (Mặc định role: member, status: active)
const register = async (req, res) => {
  try {
    const { username, email, password, full_name, phone } = req.body;
    const { User } = getModels();

    // Kiểm tra trùng username hoặc email
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      const field = existingUser.username === username ? 'Tên đăng nhập' : 'Email';
      return res.status(409).json({
        success: false,
        message: `${field} này đã được sử dụng. Vui lòng chọn giá trị khác.`
      });
    }

    // Nếu là tài khoản đầu tiên trong hệ thống, tự động cấp quyền admin
    const totalUsers = await User.count();
    const role = totalUsers === 0 ? 'admin' : 'member';

    const newUser = await User.create({
      username,
      email,
      password,
      full_name,
      phone: phone || null,
      role,
      status: 'active'
    });

    const token = generateToken(newUser);

    // Gán cookie httpOnly để trình duyệt tự động gửi kèm
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      data: {
        user: newUser.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ khi đăng ký tài khoản.',
      error: error.message
    });
  }
};

// Đăng nhập (Kiểm tra mật khẩu, trạng thái tài khoản)
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const { User } = getModels();

    // Cho phép đăng nhập bằng username hoặc email
    const user = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email: username }]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.'
      });
    }

    // Kiểm tra mật khẩu
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.'
      });
    }

    // Kiểm tra xem tài khoản có bị khóa không
    if (user.status === 'locked') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ ban quản trị để được hỗ trợ.'
      });
    }

    const token = generateToken(user);

    // Lưu cookie httpOnly
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ khi đăng nhập.',
      error: error.message
    });
  }
};

// Đăng xuất (Xóa cookie)
const logout = async (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công!'
  });
};

// Lấy thông tin tài khoản hiện tại
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user.toJSON()
    }
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe
};
