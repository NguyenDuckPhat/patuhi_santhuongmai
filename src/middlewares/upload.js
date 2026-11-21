const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đảm bảo các thư mục lưu ảnh tồn tại
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const productUploadDir = path.join(__dirname, '../../public/uploads/products');
const avatarUploadDir = path.join(__dirname, '../../public/uploads/avatars');
const chatUploadDir = path.join(__dirname, '../../public/uploads/chats');

ensureDirExists(productUploadDir);
ensureDirExists(avatarUploadDir);
ensureDirExists(chatUploadDir);

// Cấu hình storage cho ảnh sản phẩm
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirExists(productUploadDir);
    cb(null, productUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `prod-${uniqueSuffix}${ext}`);
  }
});

// Cấu hình storage cho avatar người dùng
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirExists(avatarUploadDir);
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  }
});

// Bộ lọc định dạng file ảnh hợp lệ
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);

  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận các file ảnh có định dạng JPG, JPEG, PNG, WEBP, GIF!'), false);
  }
};

// Upload ảnh sản phẩm (tối đa 5 ảnh một lần, mỗi file tối đa 5MB)
const uploadProductImages = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).array('images', 5);

// Upload avatar người dùng (1 ảnh, tối đa 2MB)
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter
}).single('avatar');

// Cấu hình storage cho ảnh tin nhắn chat
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirExists(chatUploadDir);
    cb(null, chatUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `chat-${uniqueSuffix}${ext}`);
  }
});

// Upload ảnh tin nhắn chat (1 ảnh, tối đa 5MB)
const uploadChatImage = multer({
  storage: chatStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).single('image');

module.exports = {
  uploadProductImages,
  uploadAvatar,
  uploadChatImage
};
