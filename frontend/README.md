# Frontend - Deploy lên Vercel

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

Frontend sẽ chạy tại: `http://localhost:5555`

## 📦 Deploy lên Vercel

### Bước 1: Chuẩn bị Environment Variables

**QUAN TRỌNG**: Cần có backend URL trước khi deploy frontend.

1. **VITE_GLOB_API_URL**: URL của backend API
   - Format: `https://your-backend-project.vercel.app/api`
   - **Lưu ý**: Phải có `/api` ở cuối

### Bước 2: Tạo Project trên Vercel

1. Đăng nhập [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Chọn repository GitHub của bạn
4. Click **"Import"**

### Bước 3: Cấu hình Project Settings

Vào **Settings** → **Build and Deployment Settings**:

- **Root Directory**: `frontend`
- **Framework Preset**: `Vite` (hoặc `Other`)
- **Build Command**: `pnpm install --recursive --no-frozen-lockfile && pnpm build --filter @vben/playground^... && pnpm --filter @vben/playground build`
- **Output Directory**: `dist`
- **Install Command**: `pnpm install --recursive --no-frozen-lockfile`
- **Include files outside the root directory**: ✅ **Enabled** (QUAN TRỌNG!)

> ⚠️ **LƯU Ý**: Build command có 2 phần:
> - `pnpm build --filter @vben/playground^...` - Build tất cả dependencies trước
> - `pnpm --filter @vben/playground build` - Build frontend sau

### Bước 4: Thêm Environment Variables

Vào **Settings** → **Environment Variables**, thêm:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_GLOB_API_URL` | `https://your-backend-project.vercel.app/api` | Production, Preview, Development |

**Lưu ý**: 
- Thay `your-backend-project.vercel.app` bằng URL thực tế của backend
- Phải có `/api` ở cuối URL

### Bước 5: Deploy

1. Click **"Deploy"**
2. Chờ build hoàn tất
3. Lưu lại URL của frontend (ví dụ: `https://your-frontend-project.vercel.app`)

## 🔗 Kết nối với Backend

### Sau khi deploy backend:

1. Lấy backend URL (ví dụ: `https://your-backend-project.vercel.app`)
2. Vào frontend project → **Settings** → **Environment Variables**
3. Update `VITE_GLOB_API_URL` = `https://your-backend-project.vercel.app/api`
4. Click **"Save"** (Vercel sẽ tự động redeploy)

### Local Development:

Tạo file `.env.local` trong thư mục `frontend/`:

```env
VITE_GLOB_API_URL=http://localhost:5320/api
```

## 🐛 Troubleshooting

### Lỗi: "Failed to resolve entry for package @vben-core/xxx"

**Nguyên nhân**: Dependencies chưa được build.

**Giải pháp**:
1. Đảm bảo "Include files outside the root directory" đã bật
2. Kiểm tra build command có build dependencies trước không
3. Build command phải là: `pnpm build --filter @vben/playground^... && pnpm --filter @vben/playground build`

### Lỗi: "API calls fail" hoặc "Network error"

**Nguyên nhân**: Frontend chưa config đúng backend URL.

**Giải pháp**:
1. Kiểm tra `VITE_GLOB_API_URL` trong Environment Variables
2. Đảm bảo URL có `/api` ở cuối (ví dụ: `https://backend.vercel.app/api`)
3. Redeploy frontend sau khi update env var
4. Check browser console → Network tab để xem API calls

### Lỗi: "CORS error"

**Nguyên nhân**: Backend chưa config CORS.

**Giải pháp**: Backend đã config CORS cho tất cả origins. Nếu vẫn lỗi, kiểm tra backend `nitro.config.ts`.

## 📝 Build Process

1. **Install dependencies**: `pnpm install --recursive --no-frozen-lockfile`
2. **Build dependencies**: `pnpm build --filter @vben/playground^...`
   - Build tất cả packages mà playground phụ thuộc
3. **Build frontend**: `pnpm --filter @vben/playground build`
   - Vite build với mode production
   - Output: `dist/`
4. **Deploy**: Vercel serve static files từ `dist/`

