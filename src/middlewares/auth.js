const jwt = require('jsonwebtoken');

let User;

const getUserModel = () => {
  if (!User) {
    const { getSequelize } = require('../config/database');
    const initModels = require('../models');
    const models = initModels(getSequelize());
    User = models.User;
  }
  return User;
};

// Middleware xác thực JWT (từ Bearer header hoặc Cookie)
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để tiếp tục truy cập chức năng này.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'patuhi_secret_key');
    const userModel = getUserModel();
    const user = await userModel.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc phiên đăng nhập đã hết hạn.'
      });
    }

    // Kiểm tra trạng thái tài khoản: Khóa hay Hoạt động
    if (user.status === 'locked') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa do vi phạm quy định. Vui lòng liên hệ Quản trị viên.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực người dùng.',
      error: error.message
    });
  }
};

// Middleware xác thực tùy chọn (nếu có token thì gán req.user, không có thì req.user = null)
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'patuhi_secret_key');
    const userModel = getUserModel();
    const user = await userModel.findByPk(decoded.id);

    if (user && user.status !== 'locked') {
      req.user = user;
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Middleware phân quyền theo vai trò (Roles: guest, member, admin)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để thực hiện quyền này.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền truy cập chức năng này (Yêu cầu quyền: ${roles.join(', ')}).`
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize
};
