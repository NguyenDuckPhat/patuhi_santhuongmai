const crypto = require('crypto');
const { Op, fn, col, literal } = require('sequelize');
const { getSequelize } = require('../config/database');
const initModels = require('../models');

const getModels = () => initModels(getSequelize());

const ORDER_STATUSES = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];
const STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao hàng',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy'
};

// Người bán chỉ đi theo quy trình này; không tự động confirmed khi vừa đặt.
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['completed'],
  completed: [],
  cancelled: []
};

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const cleanText = (value, maxLength) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const serializeOrder = (order) => {
  const data = typeof order.toJSON === 'function' ? order.toJSON() : { ...order };
  return {
    ...data,
    quantity: Number(data.quantity || 0),
    unit_price: Number(data.unit_price || 0),
    total_amount: Number(data.total_amount || 0),
    status_label: STATUS_LABELS[data.status] || data.status
  };
};

const parsePagination = (query = {}) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50;
  return { page, limit, offset: (page - 1) * limit };
};

const buildOrderWhere = (scope, userId, query = {}) => {
  const where = scope === 'seller' ? { seller_id: userId } : { buyer_id: userId };

  if (query.status === 'unrated' && scope === 'buyer') {
    // "Chưa đánh giá" = đã hoàn thành nhưng chưa có comment gắn order_id.
    where.status = 'completed';
    where.id = {
      [Op.notIn]: literal('(SELECT order_id FROM comments WHERE order_id IS NOT NULL)')
    };
  } else if (query.status && ORDER_STATUSES.includes(query.status)) {
    where.status = query.status;
  }

  const keyword = cleanText(query.q, 30);
  if (keyword) {
    where.order_code = { [Op.like]: `%${keyword}%` };
  }

  return where;
};

const attachRatedFlags = async (orders) => {
  const items = Array.isArray(orders) ? orders : [];
  if (items.length === 0) return [];

  const { Comment } = getModels();
  const ids = items.map((item) => item.id).filter((id) => Number.isFinite(Number(id)));
  if (ids.length === 0) return items.map(serializeOrder);

  const ratedRows = await Comment.findAll({
    attributes: ['order_id'],
    where: { order_id: { [Op.in]: ids } },
    raw: true
  });
  const ratedIds = new Set(ratedRows.map((row) => Number(row.order_id)));

  return items.map((item) => ({
    ...serializeOrder(item),
    is_rated: ratedIds.has(Number(item.id))
  }));
};

const generateOrderCode = async (Order, transaction) => {
  const prefix = `PD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await Order.findOne({ where: { order_code: code }, transaction });
    if (!exists) return code;
  }
  throw httpError(500, 'Không thể sinh mã đơn hàng. Vui lòng thử lại.');
};

// POST /api/orders — tạo đơn thật. Giá luôn lấy từ DB, không tin client.
const createOrder = async (req, res) => {
  const body = req.body || {};
  const productId = parseInt(body.product_id, 10);
  const quantity = parseInt(body.quantity, 10);
  const receiverName = cleanText(body.receiver_name, 100);
  const receiverPhone = cleanText(body.receiver_phone, 20);
  const shippingAddress = cleanText(body.shipping_address, 300);
  const note = cleanText(body.note, 300);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: 'Sản phẩm không hợp lệ.' });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return res.status(400).json({ success: false, message: 'Số lượng phải từ 1 đến 99.' });
  }
  if (!receiverName) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập họ tên người nhận.' });
  }
  if (!/^0\d{9}$/.test(receiverPhone)) {
    return res.status(400).json({ success: false, message: 'Số điện thoại phải bắt đầu bằng 0 và có đúng 10 chữ số.' });
  }
  if (!shippingAddress) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ giao hàng.' });
  }

  const sequelize = getSequelize();
  const { Order, OrderStatusHistory, Product, ProductImage, User } = getModels();

  try {
    const order = await sequelize.transaction(async (transaction) => {
      const product = await Product.findOne({
        where: { id: productId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!product) throw httpError(404, 'Sản phẩm không tồn tại.');
      if (product.status !== 'approved') {
        throw httpError(400, 'Sản phẩm hiện không được phép đặt hàng.');
      }
      if (Number(product.user_id) === Number(req.user.id)) {
        throw httpError(400, 'Không thể đặt hàng tin đăng của chính bạn.');
      }

      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw httpError(400, 'Sản phẩm chưa có giá bán hợp lệ.');
      }

      const seller = await User.findByPk(product.user_id, {
        attributes: ['id', 'full_name', 'username'],
        transaction
      });

      const primaryImage = await ProductImage.findOne({
        where: { product_id: product.id },
        order: [['is_primary', 'DESC'], ['id', 'ASC']],
        transaction
      });

      const totalAmount = Math.round(unitPrice * quantity * 100) / 100;
      const orderCode = await generateOrderCode(Order, transaction);

      const created = await Order.create(
        {
          order_code: orderCode,
          buyer_id: req.user.id,
          seller_id: product.user_id,
          product_id: product.id,
          product_title: product.title,
          product_image: primaryImage ? primaryImage.image_url : null,
          seller_name: seller ? (seller.full_name || seller.username) : null,
          quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
          receiver_name: receiverName,
          receiver_phone: receiverPhone,
          shipping_address: shippingAddress,
          note: note || null,
          status: 'pending'
        },
        { transaction }
      );

      await OrderStatusHistory.create(
        {
          order_id: created.id,
          from_status: null,
          to_status: 'pending',
          changed_by: req.user.id,
          changed_by_role: 'buyer',
          note: 'Đơn hàng được tạo.'
        },
        { transaction }
      );

      return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công! Đơn hàng đã được lưu vào hệ thống.',
      data: { order: serializeOrder(order) }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Lỗi tạo đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Đặt hàng thất bại. Vui lòng thử lại.' });
  }
};

const listOrders = async (req, res, scope) => {
  try {
    const { Order } = getModels();
    const { page, limit, offset } = parsePagination(req.query);
    const where = buildOrderWhere(scope, req.user.id, req.query);

    const { count, rows } = await Order.findAndCountAll({
      where,
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit,
      offset
    });

    const orders = await attachRatedFlags(rows);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: count === 0 ? 0 : Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách đơn hàng.' });
  }
};

const getBuyerOrders = (req, res) => listOrders(req, res, 'buyer');
const getSellerOrders = (req, res) => listOrders(req, res, 'seller');

// Tổng hợp số lượng đơn mua theo trạng thái để hiển thị 4 ô trên trang cá nhân.
const getBuyerOrderSummary = async (req, res) => {
  try {
    const { Order } = getModels();
    const grouped = await Order.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      where: { buyer_id: req.user.id },
      group: ['status'],
      raw: true
    });

    const summary = { pending: 0, confirmed: 0, shipping: 0, completed: 0, cancelled: 0 };
    grouped.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(summary, item.status)) {
        summary[item.status] = Number(item.count) || 0;
      }
    });

    summary.unrated = await Order.count({
      where: {
        buyer_id: req.user.id,
        status: 'completed',
        id: {
          [Op.notIn]: literal('(SELECT order_id FROM comments WHERE order_id IS NOT NULL)')
        }
      }
    });
    summary.total = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled']
      .reduce((total, status) => total + Number(summary[status] || 0), 0);

    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error('Lỗi thống kê đơn mua:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thống kê đơn mua.' });
  }
};

const getOrderDetail = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã đơn hàng không hợp lệ.' });
  }

  try {
    const { Order, OrderStatusHistory, Comment } = getModels();
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }
    if (Number(order.buyer_id) !== Number(req.user.id) && Number(order.seller_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn hàng này.' });
    }

    const statusHistory = await OrderStatusHistory.findAll({
      where: { order_id: orderId },
      order: [['created_at', 'ASC'], ['id', 'ASC']]
    });

    const ratedReview = await Comment.findOne({
      where: { order_id: orderId },
      attributes: ['id']
    });

    return res.status(200).json({
      success: true,
      data: {
        order: { ...serializeOrder(order), is_rated: Boolean(ratedReview) },
        statusHistory: statusHistory.map((item) => item.toJSON())
      }
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải chi tiết đơn hàng.' });
  }
};

const updateOrderStatus = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const nextStatus = req.body && req.body.status;

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã đơn hàng không hợp lệ.' });
  }
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ success: false, message: 'Trạng thái đơn hàng không hợp lệ.' });
  }

  const sequelize = getSequelize();
  const { Order, OrderStatusHistory } = getModels();

  try {
    const order = await sequelize.transaction(async (transaction) => {
      const current = await Order.findByPk(orderId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!current) throw httpError(404, 'Không tìm thấy đơn hàng.');
      if (Number(current.seller_id) !== Number(req.user.id)) {
        throw httpError(403, 'Bạn không có quyền cập nhật đơn hàng này.');
      }

      const allowed = ALLOWED_TRANSITIONS[current.status] || [];
      if (!allowed.includes(nextStatus)) {
        throw httpError(400, `Không thể chuyển từ ${STATUS_LABELS[current.status]} sang ${STATUS_LABELS[nextStatus]}.`);
      }

      const previousStatus = current.status;
      current.status = nextStatus;
      await current.save({ transaction });

      await OrderStatusHistory.create(
        {
          order_id: current.id,
          from_status: previousStatus,
          to_status: nextStatus,
          changed_by: req.user.id,
          changed_by_role: 'seller',
          note: cleanText(req.body && req.body.note, 255) || `Cập nhật trạng thái: ${STATUS_LABELS[nextStatus]}`
        },
        { transaction }
      );

      return current;
    });

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái: ${STATUS_LABELS[nextStatus]}`,
      data: { order: serializeOrder(order) }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Lỗi cập nhật trạng thái đơn:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái đơn hàng.' });
  }
};

const cancelOrder = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã đơn hàng không hợp lệ.' });
  }

  const sequelize = getSequelize();
  const { Order, OrderStatusHistory } = getModels();

  try {
    const order = await sequelize.transaction(async (transaction) => {
      const current = await Order.findByPk(orderId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!current) throw httpError(404, 'Không tìm thấy đơn hàng.');
      if (Number(current.buyer_id) !== Number(req.user.id)) {
        throw httpError(403, 'Bạn không có quyền hủy đơn hàng này.');
      }
      if (current.status !== 'pending') {
        throw httpError(400, 'Chỉ có thể hủy đơn hàng khi đang ở trạng thái Chờ xác nhận.');
      }

      const previousStatus = current.status;
      current.status = 'cancelled';
      await current.save({ transaction });

      await OrderStatusHistory.create(
        {
          order_id: current.id,
          from_status: previousStatus,
          to_status: 'cancelled',
          changed_by: req.user.id,
          changed_by_role: 'buyer',
          note: cleanText(req.body && req.body.note, 255) || 'Người mua hủy đơn hàng.'
        },
        { transaction }
      );

      return current;
    });

    return res.status(200).json({
      success: true,
      message: 'Đã hủy đơn hàng.',
      data: { order: serializeOrder(order) }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Lỗi hủy đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Không thể hủy đơn hàng.' });
  }
};

module.exports = {
  createOrder,
  getBuyerOrders,
  getSellerOrders,
  getBuyerOrderSummary,
  getOrderDetail,
  updateOrderStatus,
  cancelOrder
};
