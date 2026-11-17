const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

// 1. Gửi báo cáo vi phạm tin đăng
const createReport = async (req, res) => {
  try {
    const { product_id, reason, description } = req.body;
    const { Report, Product } = getModels();
    const userId = req.user.id;

    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Tin đăng cần báo cáo không tồn tại.'
      });
    }

    // Không thể tự báo cáo tin của chính mình
    if (product.user_id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể tự gửi báo cáo vi phạm cho tin đăng của mình.'
      });
    }

    // Kiểm tra xem đã gửi báo cáo tin này và đang chờ xử lý chưa
    const existing = await Report.findOne({
      where: {
        reporter_id: userId,
        product_id: parseInt(product_id),
        status: 'pending'
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã gửi báo cáo cho sản phẩm này rồi. Vui lòng chờ Ban Quản Trị xem xét xử lý.'
      });
    }

    const report = await Report.create({
      reporter_id: userId,
      product_id: parseInt(product_id),
      reason,
      description: description ? description.trim() : null,
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn! Báo cáo vi phạm đã được gửi tới Ban Quản Trị để kiểm tra và xử lý.',
      data: {
        report
      }
    });
  } catch (error) {
    console.error('Lỗi gửi báo cáo:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể gửi báo cáo vi phạm lúc này.',
      error: error.message
    });
  }
};

// 2. Theo dõi trạng thái các báo cáo do chính mình đã gửi
const getMyReports = async (req, res) => {
  try {
    const { Report, Product, ProductImage } = getModels();

    const reports = await Report.findAll({
      where: { reporter_id: req.user.id },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'title', 'price', 'status'],
          include: [{ model: ProductImage, as: 'images', attributes: ['image_url'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: {
        total: reports.length,
        reports
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách báo cáo:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy thông tin danh sách báo cáo của bạn.',
      error: error.message
    });
  }
};

module.exports = {
  createReport,
  getMyReports
};
