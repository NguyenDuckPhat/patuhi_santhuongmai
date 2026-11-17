const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

// 1. Lấy danh sách sản phẩm yêu thích của người dùng hiện tại
const getMyFavorites = async (req, res) => {
  try {
    const { Favorite, Product, ProductImage, Category, User } = getModels();

    const favorites = await Favorite.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Product,
          as: 'product',
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
            },
            {
              model: User,
              as: 'seller',
              attributes: ['id', 'username', 'full_name', 'avatar']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Chỉ trả về các sản phẩm còn tồn tại
    const products = favorites
      .filter(fav => fav.product !== null)
      .map(fav => {
        const prod = fav.product.toJSON();
        prod.favorite_id = fav.id;
        prod.favorited_at = fav.created_at;
        prod.is_favorited = true;
        return prod;
      });

    return res.status(200).json({
      success: true,
      data: {
        total: products.length,
        favorites: products
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách yêu thích:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách yêu thích.',
      error: error.message
    });
  }
};

// 2. Thêm sản phẩm vào danh sách yêu thích
const addFavorite = async (req, res) => {
  try {
    const { productId } = req.params;
    const { Favorite, Product } = getModels();

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Sản phẩm không tồn tại.'
      });
    }

    // Không thể tự yêu thích sản phẩm của chính mình
    if (product.user_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể thêm tin đăng của chính mình vào danh sách yêu thích.'
      });
    }

    // Kiểm tra đã yêu thích chưa
    const existing = await Favorite.findOne({
      where: {
        user_id: req.user.id,
        product_id: parseInt(productId)
      }
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Sản phẩm đã có trong danh sách yêu thích của bạn.',
        data: { favorite: existing }
      });
    }

    const newFav = await Favorite.create({
      user_id: req.user.id,
      product_id: parseInt(productId)
    });

    return res.status(201).json({
      success: true,
      message: 'Đã lưu sản phẩm vào danh sách yêu thích!',
      data: { favorite: newFav }
    });
  } catch (error) {
    console.error('Lỗi thêm yêu thích:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể thêm vào yêu thích.',
      error: error.message
    });
  }
};

// 3. Xóa sản phẩm khỏi danh sách yêu thích
const removeFavorite = async (req, res) => {
  try {
    const { productId } = req.params;
    const { Favorite } = getModels();

    const deleted = await Favorite.destroy({
      where: {
        user_id: req.user.id,
        product_id: parseInt(productId)
      }
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Sản phẩm chưa có trong danh sách yêu thích.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa sản phẩm khỏi danh sách yêu thích!'
    });
  } catch (error) {
    console.error('Lỗi xóa yêu thích:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể xóa khỏi yêu thích.',
      error: error.message
    });
  }
};

module.exports = {
  getMyFavorites,
  addFavorite,
  removeFavorite
};
