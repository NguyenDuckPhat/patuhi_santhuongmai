const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

// Lấy danh sách danh mục (công khai)
const getCategories = async (req, res) => {
  try {
    const { Category, Product } = getModels();

    const categories = await Category.findAll({
      order: [['id', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: {
        categories
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh mục:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách danh mục.',
      error: error.message
    });
  }
};

// Lấy chi tiết một danh mục
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { Category } = getModels();

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        category
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải danh mục.',
      error: error.message
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById
};
