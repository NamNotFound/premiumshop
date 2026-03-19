// server.js – PremiumShop Backend
// Stack: Node.js + Express + MongoDB (Mongoose)
// Optional: Telegram bot notification

require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serve frontend

// ── RATE LIMITER (anti-spam) ──
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 phút
  max: 3,                 // tối đa 3 đơn/phút per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều yêu cầu. Vui lòng chờ 1 phút.' },
});

// ── MONGODB CONNECTION ──
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/premiumshop', {
  serverSelectionTimeoutMS: 5000,
  bufferCommands: false,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ── ORDER SCHEMA ──
const orderSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  phone:      { type: String, required: true, trim: true },
  facebook:   { type: String, required: true, trim: true },
  product:    { type: String, required: true, enum: ['Spotify Premium', 'YouTube Premium', 'Netflix Premium'] },
  price:      { type: String, required: true },
  status:     { type: String, default: 'pending', enum: ['pending', 'processing', 'done', 'cancelled'] },
  ip:         { type: String },
  created_at: { type: Date, default: Date.now },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// ── TELEGRAM HELPER ──
async function sendTelegram(msg) {
  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

// ── VALIDATION HELPER ──
function validateOrder({ name, phone, facebook, product, price }) {
  const errors = [];
  if (!name || name.trim().length < 2)       errors.push('Họ tên không hợp lệ');
  if (!phone || !/^(0[3-9])\d{8}$/.test(phone.replace(/\s/g, '')))
                                              errors.push('Số điện thoại không hợp lệ');
  if (!facebook || facebook.trim().length < 5) errors.push('Link Facebook không hợp lệ');
  const allowed = ['Spotify Premium', 'YouTube Premium', 'Netflix Premium'];
  if (!product || !allowed.includes(product))  errors.push('Sản phẩm không hợp lệ');
  if (!price || isNaN(Number(price)))           errors.push('Giá không hợp lệ');
  return errors;
}

// ══════════════════════════════════════════
//  API ROUTES
// ══════════════════════════════════════════

// POST /api/order – tạo đơn hàng mới
app.post('/api/order', orderLimiter, async (req, res) => {
  const { name, phone, facebook, product, price, created_at } = req.body;

  const errors = validateOrder({ name, phone, facebook, product, price });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(', ') });
  }

  try {
    // Kiểm tra duplicate: cùng SĐT mua cùng sản phẩm trong 5 phút
    const recent = await Order.findOne({
      phone: phone.replace(/\s/g, ''),
      product,
      created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    if (recent) {
      return res.status(429).json({ success: false, message: 'Đơn hàng này vừa được tạo. Vui lòng chờ 5 phút.' });
    }

    const order = await Order.create({
      name:     name.trim(),
      phone:    phone.replace(/\s/g, ''),
      facebook: facebook.trim(),
      product,
      price:    String(price),
      ip:       req.ip,
      created_at: created_at ? new Date(created_at) : new Date(),
    });

    // Gửi Telegram notification
    const tgMsg = `🛒 <b>Đơn hàng mới!</b>\n\n` +
      `👤 <b>Tên:</b> ${order.name}\n` +
      `📱 <b>SĐT:</b> <code>${order.phone}</code>\n` +
      `📘 <b>Facebook:</b> ${order.facebook}\n` +
      `🛍️ <b>Sản phẩm:</b> ${order.product}\n` +
      `💰 <b>Giá:</b> ${Number(order.price).toLocaleString('vi-VN')}đ\n` +
      `🕐 <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}\n` +
      `🆔 <b>ID:</b> <code>${order._id}</code>`;
    sendTelegram(tgMsg);

    return res.status(201).json({
      success: true,
      message: 'Tạo đơn hàng thành công!',
      order: {
        id:      order._id,
        name:    order.name,
        product: order.product,
        price:   order.price,
        status:  order.status,
      },
    });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại.' });
  }
});

// GET /api/orders – xem tất cả đơn (admin)
app.get('/api/orders', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};
    if (status && status !== 'all' && status !== '') query.status = status;
    if (search) {
      query.$or = [
        { name:    { $regex: search, $options: 'i' } },
        { phone:   { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } },
      ];
    }
    const [orders, total] = await Promise.all([
      Order.find(query).sort({ created_at: -1 }).skip((page-1)*limit).limit(Number(limit)),
      Order.countDocuments(query),
    ]);
    
    const stats = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $toDouble: '$price' } } } }
    ]);
    return res.json({ success: true, orders, total, page: Number(page), stats });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/orders/:id – cập nhật trạng thái
app.patch('/api/orders/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'processing', 'done', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Status không hợp lệ' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    return res.json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/orders/:id – xoá đơn
app.delete('/api/orders/:id', adminAuth, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Đã xoá đơn hàng' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/stats – dashboard stats
app.get('/api/stats', adminAuth, async (req, res) => {
  try {
    const total    = await Order.countDocuments();
    const pending  = await Order.countDocuments({ status: 'pending' });
    const done     = await Order.countDocuments({ status: 'done' });
    const revenue  = await Order.aggregate([
      { $match: { status: 'done' } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$price' } } } }
    ]);
    const byProduct = await Order.aggregate([
      { $group: { _id: '$product', count: { $sum: 1 } } }
    ]);
    return res.json({
      success: true,
      total, pending, done,
      revenue: revenue[0]?.total || 0,
      byProduct,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── ADMIN AUTH MIDDLEWARE ──
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== (process.env.ADMIN_KEY || 'admin123')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

// ── START ──
app.listen(PORT, () => {
  console.log(`\n🚀 PremiumShop server running on http://localhost:${PORT}`);
  console.log(`📦 MongoDB: ${process.env.MONGO_URI || 'mongodb://localhost:27017/premiumshop'}`);
  console.log(`🔑 Admin key: ${process.env.ADMIN_KEY || 'admin123'}\n`);
});
