# Backend API - Deploy lên Vercel

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm start
```

Server sẽ chạy tại: `http://localhost:5320`

## 📦 Deploy lên Vercel

### Bước 1: Chuẩn bị Environment Variables

Trước khi deploy, chuẩn bị các biến môi trường sau:

1. **MONGODB_URI**: Connection string của MongoDB Atlas
   ```
   mongodb+srv://username:password@cluster.mongodb.net/?appName=app-name
   ```

2. **GEMINI_API_KEY** (Optional): API key cho Gemini model
   - Lấy tại: https://aistudio.google.com/app/apikey

3. **JWT_ACCESS_TOKEN_SECRET**: Secret key cho JWT access tokens
   - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

4. **JWT_REFRESH_TOKEN_SECRET**: Secret key cho JWT refresh tokens
   - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

5. **FRONTEND_URL** (Optional): URL của frontend để config CORS
   - Ví dụ: `https://your-frontend-project.vercel.app`

### Bước 2: Tạo Project trên Vercel

1. Đăng nhập [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Chọn repository GitHub của bạn
4. Click **"Import"**

### Bước 3: Cấu hình Project Settings

Vào **Settings** → **Build and Deployment Settings**:

- **Root Directory**: `backend`
- **Framework Preset**: `Other` (hoặc để trống)
- **Build Command**: `pnpm install --recursive --no-frozen-lockfile && pnpm --filter @vben/backend-mock build`
- **Output Directory**: `.vercel/output`
- **Install Command**: `pnpm install --recursive --no-frozen-lockfile`
- **Include files outside the root directory**: ✅ **Enabled** (QUAN TRỌNG!)

### Bước 4: Thêm Environment Variables

Vào **Settings** → **Environment Variables**, thêm tất cả các biến đã chuẩn bị ở Bước 1.

### Bước 5: Deploy

1. Click **"Deploy"**
2. Chờ build hoàn tất
3. Lưu lại URL của backend (ví dụ: `https://your-backend-project.vercel.app`)

### Bước 6: Test API

Sau khi deploy, test API endpoint:

```bash
curl https://your-backend-project.vercel.app/api/status
```

## 🔗 Kết nối với Frontend

Sau khi deploy backend, cập nhật frontend environment variable:

1. Copy backend URL (ví dụ: `https://your-backend-project.vercel.app`)
2. Vào frontend project trên Vercel → **Settings** → **Environment Variables**
3. Thêm hoặc update: `VITE_GLOB_API_URL` = `https://your-backend-project.vercel.app/api`
4. Redeploy frontend

## 📝 API Endpoints

- `GET /api/status` - Health check
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Refresh token
- `GET /api/user/info` - Thông tin user
- Và nhiều endpoints khác...

## 🐛 Troubleshooting

### Lỗi: "Cannot find module"

**Giải pháp**: Đảm bảo "Include files outside the root directory" đã bật trong Vercel settings.

### Lỗi: "MongoDB connection failed"

**Giải pháp**: 
- Kiểm tra `MONGODB_URI` đã set đúng chưa
- Đảm bảo MongoDB Atlas IP whitelist cho phép Vercel IPs (hoặc `0.0.0.0/0`)

### Lỗi: "CORS error"

**Giải pháp**: 
- Backend đã config CORS cho tất cả origins (`*`)
- Nếu cần restrict, update `nitro.config.ts` với `FRONTEND_URL`
