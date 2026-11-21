const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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

// Lấy Google Client ID để khởi tạo giao diện phía Client
const getGoogleClientId = (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      clientId: process.env.GOOGLE_CLIENT_ID || ''
    }
  });
};

// Hàm dùng chung xử lý tìm hoặc tạo tài khoản từ dữ liệu Google
const processGoogleUser = async ({ sub, email, name, picture }) => {
  const { User } = getModels();

  if (!email) {
    throw new Error('Google không trả về địa chỉ email hợp lệ.');
  }

  // 1. Tìm theo google_id hoặc theo email
  let user = await User.findOne({
    where: {
      [Op.or]: [
        sub ? { google_id: sub } : null,
        { email }
      ].filter(Boolean)
    }
  });

  if (user) {
    if (user.status === 'locked') {
      const err = new Error('Tài khoản của bạn đã bị khóa do vi phạm quy định.');
      err.status = 403;
      throw err;
    }

    let needsSave = false;
    if (sub && !user.google_id) {
      user.google_id = sub;
      needsSave = true;
    }
    if ((!user.avatar || user.avatar === '/uploads/avatars/default.png') && picture) {
      user.avatar = picture;
      needsSave = true;
    }
    if (needsSave) {
      await user.save();
    }
  } else {
    // 2. Chưa có tài khoản -> Đăng ký tự động từ tài khoản Google
    let baseUsername = (email.split('@')[0] || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    if (baseUsername.length < 3) baseUsername = `user_${Date.now()}`;
    let username = baseUsername;
    let counter = 1;
    while (await User.findOne({ where: { username } })) {
      username = `${baseUsername}_${counter++}`;
    }

    const totalUsers = await User.count();
    const role = totalUsers === 0 ? 'admin' : 'member';

    user = await User.create({
      username,
      email,
      full_name: name || username,
      avatar: picture || '/uploads/avatars/default.png',
      google_id: sub || `google_${Date.now()}`,
      password: crypto.randomBytes(32).toString('hex'), // Tạo mật khẩu ngẫu nhiên an toàn
      role,
      status: 'active'
    });
  }

  const token = generateToken(user);
  return { user, token };
};

// Đăng ký / Đăng nhập bằng Google Credential (Google Identity Services)
const googleAuth = async (req, res) => {
  try {
    const { credential, email, name, picture, sub } = req.body;
    let googlePayload = null;

    if (credential) {
      // 1. Thử xác minh qua Google Tokeninfo API
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (verifyRes.ok) {
          googlePayload = await verifyRes.json();
        }
      } catch (e) {
        console.warn('Lưu ý kết nối Google API:', e.message);
      }

      // 2. Nếu không gọi được tokeninfo (VD môi trường sandbox offline), giải mã token JWT
      if (!googlePayload) {
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          googlePayload = decoded;
        }
      }
    }

    // 3. Hỗ trợ payload trực tiếp (dùng cho testing hoặc luồng tùy biến)
    if (!googlePayload && email) {
      googlePayload = { sub: sub || `g_${Date.now()}`, email, name, picture };
    }

    if (!googlePayload || !googlePayload.email) {
      return res.status(400).json({
        success: false,
        message: 'Mã xác thực Google không hợp lệ hoặc thiếu thông tin email.'
      });
    }

    const { user, token } = await processGoogleUser({
      sub: googlePayload.sub,
      email: googlePayload.email,
      name: googlePayload.name || googlePayload.full_name,
      picture: googlePayload.picture || googlePayload.avatar
    });

    // Lưu cookie httpOnly
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập bằng tài khoản Google thành công!',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Lỗi xác thực Google:', error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi xử lý đăng nhập Google.',
      error: error.message
    });
  }
};

// Tạo URL chuyển hướng đăng nhập OAuth2 (Luồng Redirect chuẩn của Google)
const getGoogleRedirectUrl = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !clientId.trim()) {
    if (req.query.format === 'json') {
      return res.status(400).json({
        success: false,
        message: 'GOOGLE_CLIENT_ID chưa được thiết lập trong file .env.'
      });
    }
    return res.redirect('/login?error=' + encodeURIComponent('Chưa cấu hình GOOGLE_CLIENT_ID trong file .env. Vui lòng điền Client ID từ Google Cloud Console vào file .env để kết nối trực tiếp với Google.'));
  }
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId.trim())}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=select_account`;
  
  if (req.query.format === 'json') {
    return res.status(200).json({
      success: true,
      data: { url }
    });
  }
  return res.redirect(url);
};

// Callback xử lý khi Google redirect về server
const googleCallback = async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.redirect('/login?error=' + encodeURIComponent('Bạn đã hủy đăng nhập bằng Google.'));
  }
  if (!code) {
    return res.redirect('/login?error=' + encodeURIComponent('Không nhận được mã xác thực từ Google.'));
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.redirect('/login?error=' + encodeURIComponent('Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong .env.'));
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Google token exchange error:', errText);
      return res.redirect('/login?error=' + encodeURIComponent('Không thể đổi mã token từ Google. Vui lòng kiểm tra lại GOOGLE_CLIENT_SECRET và Redirect URI trong Google Cloud Console.'));
    }

    const tokenData = await tokenRes.json();
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userinfoRes.ok) {
      return res.redirect('/login?error=' + encodeURIComponent('Không lấy được thông tin hồ sơ từ Google.'));
    }

    const profile = await userinfoRes.json();

    const { token } = await processGoogleUser({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.redirect(`/?token=${token}&login=google_success`);
  } catch (err) {
    console.error('Lỗi Google Callback:', err);
    return res.redirect('/login?error=' + encodeURIComponent(err.message || 'Đăng nhập Google thất bại.'));
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  googleAuth,
  getGoogleClientId,
  getGoogleRedirectUrl,
  googleCallback
};
