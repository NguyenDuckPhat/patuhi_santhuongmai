const { Op, fn, col } = require('sequelize');
const { getSequelize } = require('../config/database');
const initModels = require('../models');

const publicStatuses = ['approved', 'sold'];
const pageSize = 5;

const getResponseRate = async ({ Conversation, Message }, sellerId) => {
  const messages = await Message.findAll({
    attributes: [
      'conversation_id', 'sender_id',
      [fn('MIN', col('Message.id')), 'first_message_id'],
      [fn('MAX', col('Message.id')), 'last_message_id']
    ],
    where: { is_recalled: false },
    include: [{ model: Conversation, as: 'conversation', attributes: [], where: { seller_id: sellerId } }],
    group: ['Message.conversation_id', 'Message.sender_id'],
    raw: true
  });
  const sellerReplies = new Map();
  for (const message of messages) {
    if (message.sender_id === sellerId) sellerReplies.set(message.conversation_id, Number(message.last_message_id));
  }
  const incoming = messages.filter(message => message.sender_id !== sellerId);
  if (!incoming.length) return null;
  const replied = incoming.filter(message => sellerReplies.get(message.conversation_id) > Number(message.first_message_id));
  return Math.round(100 * replied.length / incoming.length);
};

const getSeller = async (req, res, next) => {
  try {
    const sellerId = Number(req.params.id);
    const models = initModels(getSequelize());
    const { User, Product, Comment, SellerFollow } = models;
    const seller = Number.isSafeInteger(sellerId) && sellerId > 0 && await User.findByPk(sellerId, {
      attributes: ['id', 'username', 'full_name', 'avatar', 'createdAt', 'last_active_at']
    });
    if (!seller) return res.status(404).json({ success: false, message: 'Không tìm thấy người bán.' });

    const followWhere = { seller_id: sellerId };
    const [counts, followers, following, responseRate, rating, latestListing] = await Promise.all([
      Product.count({ where: { user_id: sellerId, status: publicStatuses }, group: ['status'] }),
      SellerFollow.count({ where: followWhere }),
      req.user ? SellerFollow.count({ where: { ...followWhere, follower_id: req.user.id } }) : 0,
      getResponseRate(models, sellerId),
      Comment.findOne({
        attributes: [[fn('AVG', col('Comment.rating')), 'average'], [fn('COUNT', col('Comment.rating')), 'count']],
        where: { status: 'APPROVED', rating: { [Op.ne]: null } },
        include: [{ model: Product, as: 'product', attributes: [], where: { user_id: sellerId, status: publicStatuses } }],
        raw: true
      }),
      Product.findOne({ where: { user_id: sellerId, status: publicStatuses }, attributes: ['location'], order: [['createdAt', 'DESC'], ['id', 'DESC']] })
    ]);
    const approved = counts.find(item => item.status === 'approved')?.count || 0;
    const sold = counts.find(item => item.status === 'sold')?.count || 0;

    return res.json({ success: true, data: {
      seller,
      location: latestListing?.location || null,
      is_owner: req.user?.id === sellerId,
      last_active_at: seller.last_active_at,
      followers,
      is_following: Boolean(following),
      response_rate: responseRate,
      rating: rating.average === null ? null : Number(rating.average),
      rating_count: Number(rating.count),
      listings: { all: approved + sold, approved, sold }
    } });
  } catch (error) {
    next(error);
  }
};

const getListings = async (req, res, next) => {
  try {
    const sellerId = Number(req.params.id);
    const { status = 'all' } = req.query;
    const page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(sellerId) || sellerId < 1 || !Number.isSafeInteger(page) || page < 1 ||
        !Number.isSafeInteger((page - 1) * pageSize) || !['all', ...publicStatuses].includes(status)) {
      return res.status(400).json({ success: false, message: 'Bộ lọc tin đăng không hợp lệ.' });
    }

    const { Product, ProductImage, Favorite } = initModels(getSequelize());
    const { rows, count } = await Product.findAndCountAll({
      where: { user_id: sellerId, status: status === 'all' ? publicStatuses : status },
      attributes: ['id', 'title', 'price', 'status', 'location', 'createdAt'],
      include: [{
        model: ProductImage,
        as: 'images',
        attributes: ['id', 'image_url', 'is_primary'],
        separate: true,
        order: [['is_primary', 'DESC'], ['id', 'ASC']]
      }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    const favorites = req.user && rows.length ? await Favorite.findAll({
      where: { user_id: req.user.id, product_id: rows.map(product => product.id) },
      attributes: ['product_id']
    }) : [];
    const favoriteIds = new Set(favorites.map(favorite => favorite.product_id));
    const products = rows.map(product => ({ ...product.toJSON(), is_favorited: favoriteIds.has(product.id) }));
    return res.json({ success: true, data: { products, page, totalPages: Math.ceil(count / pageSize) } });
  } catch (error) {
    next(error);
  }
};

const updateFollow = async (req, res, next) => {
  try {
    const sellerId = Number(req.params.id);
    const { User, SellerFollow } = initModels(getSequelize());
    const seller = Number.isSafeInteger(sellerId) && sellerId > 0 && await User.findByPk(sellerId, { attributes: ['id'] });
    if (!seller) return res.status(404).json({ success: false, message: 'Không tìm thấy người bán.' });
    if (sellerId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Bạn không thể tự theo dõi tài khoản của mình.' });
    }
    const where = { seller_id: sellerId, follower_id: req.user.id };
    const isFollowing = req.method === 'PUT';
    if (isFollowing) {
      try {
        await SellerFollow.create(where);
      } catch (error) {
        if (error.name !== 'SequelizeUniqueConstraintError') throw error;
      }
    } else {
      await SellerFollow.destroy({ where });
    }
    const followers = await SellerFollow.count({ where: { seller_id: sellerId } });
    return res.json({ success: true, data: { followers, is_following: isFollowing } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSeller, getListings, updateFollow };
