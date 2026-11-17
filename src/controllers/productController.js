const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

// 1. Xem danh sách sản phẩm (Hỗ trợ tìm kiếm, lọc theo danh mục, lọc theo giá, phân trang, sắp xếp)
const getProducts = async (req, res) => {
  try {
    const {
      q,                 // Từ khóa tìm kiếm
      category_id,       // Lọc theo danh mục
      min_price,         // Lọc giá tối thiểu
      max_price,         // Lọc giá tối đa
      condition,         // Lọc tình trạng (new, like_new, used)
      location,          // Lọc khu vực
      sort = 'newest',   // Sắp xếp: newest, price_asc, price_desc, views
      page = 1,          // Trang hiện tại
      limit = 12         // Số sản phẩm mỗi trang
    } = req.query;

    const { Product, ProductImage, Category, User, Favorite } = getModels();

    const where = {
      status: 'approved' // Mặc định chỉ hiển thị tin đã được quản trị viên duyệt
    };

    // Tìm kiếm theo từ khóa trong tiêu đề hoặc mô tả
    if (q && q.trim()) {
      where[Op.or] = [
        { title: { [Op.like]: `%${q.trim()}%` } },
        { description: { [Op.like]: `%${q.trim()}%` } }
      ];
    }

    // Lọc theo danh mục
    if (category_id) {
      where.category_id = category_id;
    }

    // Lọc theo tình trạng
    if (condition) {
      where.condition = condition;
    }

    // Lọc theo khu vực
    if (location) {
      where.location = { [Op.like]: `%${location.trim()}%` };
    }

    // Lọc theo khoảng giá
    if (min_price || max_price) {
      where.price = {};
      if (min_price) where.price[Op.gte] = parseFloat(min_price);
      if (max_price) where.price[Op.lte] = parseFloat(max_price);
    }

    // Sắp xếp
    let order = [['created_at', 'DESC']];
    if (sort === 'price_asc') order = [['price', 'ASC']];
    if (sort === 'price_desc') order = [['price', 'DESC']];
    if (sort === 'views') order = [['views', 'DESC']];

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

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
        },
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'username', 'full_name', 'avatar', 'phone']
        }
      ],
      order,
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    // Nếu người dùng đã đăng nhập, đánh dấu các sản phẩm đã yêu thích
    let favoritedProductIds = new Set();
    if (req.user) {
      const userFavs = await Favorite.findAll({
        where: { user_id: req.user.id },
        attributes: ['product_id']
      });
      favoritedProductIds = new Set(userFavs.map(f => f.product_id));
    }

    const formattedProducts = rows.map(prod => {
      const p = prod.toJSON();
      p.is_favorited = favoritedProductIds.has(prod.id);
      return p;
    });

    return res.status(200).json({
      success: true,
      data: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
        products: formattedProducts
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách sản phẩm:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải danh sách sản phẩm.',
      error: error.message
    });
  }
};

// 2. Xem chi tiết sản phẩm
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { Product, ProductImage, Category, User, Favorite } = getModels();

    const product = await Product.findByPk(id, {
      include: [
        {
          model: ProductImage,
          as: 'images',
          attributes: ['id', 'image_url', 'is_primary']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'description']
        },
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'username', 'full_name', 'avatar', 'phone', 'created_at']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm này.'
      });
    }

    // Nếu sản phẩm chưa duyệt hoặc bị từ chối/ẩn, chỉ chủ sở hữu hoặc admin mới xem được
    const isOwner = req.user && req.user.id === product.user_id;
    const isAdmin = req.user && req.user.role === 'admin';
    if (product.status !== 'approved' && !isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Sản phẩm này hiện chưa được công khai hoặc đang chờ kiểm duyệt.'
      });
    }

    // Tăng lượt xem (không tăng nếu là chủ tin xem)
    if (!isOwner) {
      product.views += 1;
      await product.save({ silent: true });
    }

    // Kiểm tra xem user hiện tại đã yêu thích sản phẩm này chưa
    let isFavorited = false;
    if (req.user) {
      const fav = await Favorite.findOne({
        where: { user_id: req.user.id, product_id: product.id }
      });
      isFavorited = !!fav;
    }

    // Lấy 4 sản phẩm liên quan cùng danh mục
    const relatedProducts = await Product.findAll({
      where: {
        category_id: product.category_id,
        id: { [Op.ne]: product.id },
        status: 'approved'
      },
      include: [{ model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] }],
      limit: 4,
      order: [['created_at', 'DESC']]
    });

    const productData = product.toJSON();
    productData.is_favorited = isFavorited;
    productData.is_owner = isOwner;

    return res.status(200).json({
      success: true,
      data: {
        product: productData,
        relatedProducts
      }
    });
  } catch (error) {
    console.error('Lỗi xem chi tiết sản phẩm:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể xem chi tiết sản phẩm.',
      error: error.message
    });
  }
};

// 3. Đăng tin bán sản phẩm mới
const createProduct = async (req, res) => {
  try {
    const { title, description, price, category_id, condition, location, phone_contact } = req.body;
    const { Product, ProductImage, Category } = getModels();

    // Kiểm tra danh mục có tồn tại
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Danh mục sản phẩm không tồn tại.'
      });
    }

    // Tạo sản phẩm (Trạng thái mặc định: 'pending' chờ admin duyệt; Admin đăng thì 'approved' ngay)
    const initialStatus = req.user.role === 'admin' ? 'approved' : 'pending';

    const newProduct = await Product.create({
      user_id: req.user.id,
      category_id: parseInt(category_id),
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price),
      condition: condition || 'used',
      location: location.trim(),
      phone_contact: phone_contact || req.user.phone || null,
      status: initialStatus
    });

    // Lưu các hình ảnh tải lên
    if (req.files && req.files.length > 0) {
      const imageRecords = req.files.map((file, index) => ({
        product_id: newProduct.id,
        image_url: `/uploads/products/${file.filename}`,
        is_primary: index === 0
      }));
      await ProductImage.bulkCreate(imageRecords);
    }

    // Lấy lại thông tin chi tiết kèm ảnh vừa tạo
    const createdProduct = await Product.findByPk(newProduct.id, {
      include: [{ model: ProductImage, as: 'images' }, { model: Category, as: 'category' }]
    });

    return res.status(201).json({
      success: true,
      message: initialStatus === 'approved' 
        ? 'Đăng tin thành công và đã hiển thị công khai!' 
        : 'Đăng tin thành công! Tin của bạn đang chờ Quản trị viên kiểm duyệt.',
      data: {
        product: createdProduct
      }
    });
  } catch (error) {
    console.error('Lỗi đăng tin bán sản phẩm:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi đăng tin bán sản phẩm.',
      error: error.message
    });
  }
};

// 4. Sửa thông tin tin đăng
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, category_id, condition, location, phone_contact, remove_image_ids } = req.body;
    const { Product, ProductImage, Category } = getModels();

    const product = await Product.findByPk(id, {
      include: [{ model: ProductImage, as: 'images' }]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm cần sửa.'
      });
    }

    // Kiểm tra quyền: chỉ người đăng hoặc Quản trị viên mới được sửa
    if (product.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa tin đăng này.'
      });
    }

    if (category_id) {
      const cat = await Category.findByPk(category_id);
      if (!cat) {
        return res.status(400).json({ success: false, message: 'Danh mục không tồn tại.' });
      }
      product.category_id = category_id;
    }

    if (title) product.title = title.trim();
    if (description) product.description = description.trim();
    if (price !== undefined) product.price = parseFloat(price);
    if (condition) product.condition = condition;
    if (location) product.location = location.trim();
    if (phone_contact !== undefined) product.phone_contact = phone_contact;

    // Nếu người dùng bình thường sửa tin đã được duyệt, chuyển lại trạng thái về pending để duyệt lại
    if (req.user.role !== 'admin' && product.status === 'approved') {
      product.status = 'pending';
    }

    await product.save();

    // Xóa các ảnh được yêu cầu xóa (nếu có)
    if (remove_image_ids) {
      const idsToRemove = Array.isArray(remove_image_ids) 
        ? remove_image_ids 
        : remove_image_ids.split(',').map(i => parseInt(i.trim()));
      
      const imagesToDelete = await ProductImage.findAll({
        where: { id: idsToRemove, product_id: product.id }
      });

      for (const img of imagesToDelete) {
        const filePath = path.join(__dirname, '../../public', img.image_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        await img.destroy();
      }
    }

    // Thêm các ảnh mới được tải lên
    if (req.files && req.files.length > 0) {
      const currentImageCount = await ProductImage.count({ where: { product_id: product.id } });
      const newImages = req.files.map((file, index) => ({
        product_id: product.id,
        image_url: `/uploads/products/${file.filename}`,
        is_primary: currentImageCount === 0 && index === 0
      }));
      await ProductImage.bulkCreate(newImages);
    }

    const updatedProduct = await Product.findByPk(product.id, {
      include: [{ model: ProductImage, as: 'images' }, { model: Category, as: 'category' }]
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật tin đăng thành công!',
      data: {
        product: updatedProduct
      }
    });
  } catch (error) {
    console.error('Lỗi cập nhật tin đăng:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật tin đăng.',
      error: error.message
    });
  }
};

// 5. Xóa tin đăng (Kèm xóa các file ảnh trên đĩa)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { Product, ProductImage } = getModels();

    const product = await Product.findByPk(id, {
      include: [{ model: ProductImage, as: 'images' }]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm cần xóa.'
      });
    }

    // Kiểm tra quyền xóa: Người đăng hoặc Quản trị viên
    if (product.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa tin đăng này.'
      });
    }

    // Xóa các file ảnh vật lý trên ổ cứng
    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        const filePath = path.join(__dirname, '../../public', img.image_url);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error('Lỗi khi xóa file ảnh:', e.message);
          }
        }
      }
    }

    await product.destroy();

    return res.status(200).json({
      success: true,
      message: 'Xóa tin đăng thành công!'
    });
  } catch (error) {
    console.error('Lỗi xóa tin đăng:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể xóa tin đăng.',
      error: error.message
    });
  }
};

// 6. Quản lý trạng thái tin đăng (Người bán đánh dấu 'sold' đã bán, 'hidden' ẩn tin, hoặc kích hoạt lại)
const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { Product } = getModels();

    const allowedStatuses = ['approved', 'pending', 'sold', 'hidden', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái tin đăng không hợp lệ.'
      });
    }

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.'
      });
    }

    // Nếu không phải admin thì chỉ được chuyển trạng thái giữa 'sold' và 'hidden', hoặc đăng lại 'pending'
    if (req.user.role !== 'admin') {
      if (product.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền thay đổi trạng thái của tin đăng này.'
        });
      }
      if (!['sold', 'hidden', 'pending'].includes(status)) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ Quản trị viên mới có quyền duyệt hoặc từ chối tin đăng.'
        });
      }
    }

    product.status = status;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái tin sang: ${status}`,
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái tin:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật trạng thái tin đăng.',
      error: error.message
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStatus
};
