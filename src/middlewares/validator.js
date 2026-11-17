const { body, validationResult } = require('express-validator');

// Hàm xử lý kết quả validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu gửi lên không hợp lệ.',
      errors: errors.array().map(err => ({ field: err.path, msg: err.msg }))
    });
  }
  next();
};

const registerRules = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Tên đăng nhập phải từ 3 đến 30 ký tự.')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Tên đăng nhập chỉ chứa chữ cái, chữ số và dấu gạch dưới.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email không đúng định dạng.'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự.'),
  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('Họ và tên không được để trống.'),
  body('phone')
    .optional({ checkFalsy: true })
    .matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/)
    .withMessage('Số điện thoại không đúng định dạng Việt Nam.')
];

const loginRules = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập tên đăng nhập hoặc email.'),
  body('password')
    .notEmpty()
    .withMessage('Vui lòng nhập mật khẩu.')
];

const productRules = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Tiêu đề tin đăng từ 5 đến 200 ký tự.'),
  body('category_id')
    .notEmpty()
    .isInt()
    .withMessage('Danh mục không hợp lệ.'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Giá sản phẩm phải là số không âm.'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Mô tả sản phẩm phải có ít nhất 10 ký tự.'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Địa chỉ/Khu vực không được để trống.')
];

const changePasswordRules = [
  body('old_password')
    .notEmpty()
    .withMessage('Vui lòng cung cấp mật khẩu cũ.'),
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.')
];

const reportRules = [
  body('product_id')
    .isInt()
    .withMessage('ID sản phẩm không hợp lệ.'),
  body('reason')
    .isIn(['fraud', 'fake', 'offensive', 'wrong_category', 'other'])
    .withMessage('Lý do báo cáo không hợp lệ.')
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  productRules,
  changePasswordRules,
  reportRules
};
