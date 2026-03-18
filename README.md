# ⚡ PremiumShop

> Landing page bán tài khoản Premium (Spotify, YouTube, Netflix) với hệ thống nhận đơn hàng tự động, admin dashboard và Telegram notification.

---

## 📸 Tổng quan

```
Khách hàng truy cập → Chọn sản phẩm → Điền form → Tạo đơn
                                                        ↓
                                              MongoDB lưu đơn
                                                        ↓
                                         Telegram gửi thông báo
                                                        ↓
                                         Admin xem & xử lý đơn
```

---

## 🗂️ Cấu trúc dự án

```
premiumshop/
├── server.js            ← Backend: Express API + MongoDB
├── package.json         ← Dependencies
├── .env                 ← Cấu hình (tạo từ .env.example)
├── .env.example         ← Mẫu cấu hình
├── README.md
└── public/              ← Frontend (được serve tự động)
    ├── index.html       ← Landing page khách hàng
    └── admin.html       ← Trang quản lý đơn hàng
```

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Security | Helmet + express-rate-limit |
| Notification | Telegram Bot API |
| Font | Plus Jakarta Sans (Google Fonts) |

---

## ⚙️ Cài đặt & Chạy

### Yêu cầu
- **Node.js** >= 18 → [nodejs.org](https://nodejs.org)
- **MongoDB** (local hoặc Atlas cloud)

### Bước 1 – Clone / tải về

```bash
mkdir premiumshop && cd premiumshop
# Đặt các file vào đúng vị trí theo cấu trúc thư mục ở trên
```

### Bước 2 – Cài dependencies

```bash
npm install
```

### Bước 3 – Cấu hình môi trường

```bash
cp .env.example .env
```

Mở file `.env` và điền thông tin:

```env
PORT=3000

# MongoDB local:
MONGO_URI=mongodb://localhost:27017/premiumshop
# Hoặc MongoDB Atlas (cloud):
# MONGO_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/premiumshop

ADMIN_KEY=matkhau_bi_mat_kho_doan

# Telegram (tuỳ chọn):
TELEGRAM_TOKEN=1234567890:ABCdefGHIjklMNO...
TELEGRAM_CHAT_ID=123456789
```

### Bước 4 – Chạy server

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

✅ Server chạy tại: `http://localhost:3000`

---

## 🌐 Các trang

| URL | Mô tả |
|---|---|
| `http://localhost:3000` | Landing page dành cho khách hàng |
| `http://localhost:3000/admin.html` | Trang quản lý đơn hàng (cần đăng nhập) |

---

## 🔌 API Endpoints

Tất cả API có prefix `/api`.

### `POST /api/order` — Tạo đơn hàng

**Public** – không cần auth.

**Request body:**
```json
{
  "name":       "Nguyễn Văn A",
  "phone":      "0901234567",
  "facebook":   "https://facebook.com/tenban",
  "product":    "Spotify Premium",
  "price":      "20000",
  "created_at": "2025-01-15T10:30:00.000Z"
}
```

**Response thành công (201):**
```json
{
  "success": true,
  "message": "Tạo đơn hàng thành công!",
  "order": {
    "id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "Nguyễn Văn A",
    "product": "Spotify Premium",
    "price": "20000",
    "status": "pending"
  }
}
```

---

### `GET /api/orders` — Danh sách đơn hàng

**Yêu cầu header:** `x-admin-key: your_admin_key`

**Query params:**
| Param | Mô tả | Mặc định |
|---|---|---|
| `page` | Số trang | 1 |
| `limit` | Số đơn mỗi trang | 20 |
| `status` | Lọc: `all / pending / processing / done / cancelled` | all |
| `search` | Tìm theo tên, SĐT, sản phẩm | — |

---

### `PATCH /api/orders/:id` — Cập nhật trạng thái

**Yêu cầu header:** `x-admin-key: your_admin_key`

```json
{ "status": "done" }
```

---

### `DELETE /api/orders/:id` — Xoá đơn hàng

**Yêu cầu header:** `x-admin-key: your_admin_key`

---

### `GET /api/stats` — Thống kê tổng quan

**Yêu cầu header:** `x-admin-key: your_admin_key`

```json
{
  "total": 120,
  "pending": 5,
  "done": 110,
  "revenue": 2850000,
  "byProduct": [
    { "_id": "Spotify Premium", "count": 50 },
    { "_id": "YouTube Premium", "count": 45 },
    { "_id": "Netflix Premium", "count": 25 }
  ]
}
```

---

## 🛡️ Bảo mật & Chống spam

| Cơ chế | Mô tả |
|---|---|
| Rate limit | Tối đa **3 đơn/phút** per IP |
| Duplicate check | Cùng SĐT + sản phẩm không được tạo lại trong **5 phút** |
| Frontend cooldown | 30 giây giữa các lần submit |
| Validate SĐT | Regex số điện thoại Việt Nam `(0[3-9]xxxxxxxx)` |
| Helmet | HTTP security headers |
| Admin auth | Header `x-admin-key` cho tất cả admin endpoints |

---

## 📱 Trạng thái đơn hàng

```
pending → processing → done
   ↓
cancelled
```

| Trạng thái | Ý nghĩa |
|---|---|
| `pending` | Chờ xử lý |
| `processing` | Đang giao tài khoản |
| `done` | Hoàn thành |
| `cancelled` | Đã huỷ |

---

## 🤖 Cài đặt Telegram Bot

1. Nhắn tin **@BotFather** → `/newbot` → lấy **token**
2. Nhắn bot bất kỳ tin nhắn
3. Truy cập: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Tìm `"chat":{"id":...}` → lấy **chat_id**
5. Điền vào `.env`:
```env
TELEGRAM_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Mỗi đơn mới sẽ gửi thông báo dạng:
```
🛒 Đơn hàng mới!

👤 Tên: Nguyễn Văn A
📱 SĐT: 0901234567
📘 Facebook: https://facebook.com/...
🛍️ Sản phẩm: Spotify Premium
💰 Giá: 20.000đ
🕐 Thời gian: 15/01/2025 10:30
```

---

## ☁️ Deploy lên cloud

### Render.com (miễn phí)

1. Push code lên **GitHub**
2. Vào [render.com](https://render.com) → **New Web Service**
3. Kết nối repo, cấu hình:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Thêm **Environment Variables** từ `.env`
5. Dùng **MongoDB Atlas** cho database

### VPS với PM2

```bash
npm install -g pm2
pm2 start server.js --name premiumshop
pm2 startup    # Tự khởi động khi reboot
pm2 save
pm2 logs premiumshop    # Xem logs
```

---

## 🧩 Thêm sản phẩm mới

**1. Trong `public/index.html`** – thêm card:
```html
<div class="product-card" data-product="Canva Pro" data-price="35000" onclick="selectProduct(this)">
  <div class="product-emoji">🎨</div>
  <div class="product-name">Canva Pro</div>
  <div class="product-price-tag">35.000đ</div>
  <div class="product-duration">/ 1 tháng</div>
  <button class="btn-select">Chọn mua</button>
</div>
```

**2. Thêm vào `PRODUCTS` object trong JS:**
```js
const PRODUCTS = {
  "Spotify Premium":  { price: 20000, emoji: "🎵" },
  "YouTube Premium":  { price: 25000, emoji: "▶️" },
  "Netflix Premium":  { price: 30000, emoji: "🎬" },
  "Canva Pro":        { price: 35000, emoji: "🎨" },  // ← thêm dòng này
};
```

**3. Thêm vào `<select>` trong form:**
```html
<option value="Canva Pro" data-price="35000">🎨 Canva Pro – 35.000đ</option>
```

**4. Cập nhật `enum` trong `server.js`:**
```js
product: {
  type: String,
  required: true,
  enum: ['Spotify Premium', 'YouTube Premium', 'Netflix Premium', 'Canva Pro']
}
```

---

## 🐛 Troubleshooting

| Lỗi | Nguyên nhân | Cách fix |
|---|---|---|
| `MongoDB connection failed` | MongoDB chưa chạy | Khởi động `mongod` hoặc kiểm tra Atlas URI |
| `Cannot POST /api/order` | Server chưa chạy | Chạy `npm start` |
| `Unauthorized` | Admin key sai | Kiểm tra `.env` và header `x-admin-key` |
| Form submit không phản hồi | Backend chưa start | Trang vẫn hiển thị popup (demo mode) |
| Telegram không nhận tin | Token/chat_id sai | Kiểm tra lại botFather token |

---

## 📄 License

MIT © 2025 PremiumShop


Made by NamNot and Heroke12
