# 🚀 Quick Start - Deploy lên Vercel

## ⚡ Tóm tắt nhanh

### 1. Deploy Backend

1. Tạo project mới trên Vercel
2. **Root Directory**: `backend`
3. **Build Command**: `pnpm install --recursive --no-frozen-lockfile && pnpm --filter @vben/backend-mock build`
4. **Output Directory**: `.vercel/output`
5. ✅ **Include files outside root**: Enabled
6. Thêm Environment Variables:
   - `MONGODB_URI`
   - `JWT_ACCESS_TOKEN_SECRET`
   - `JWT_REFRESH_TOKEN_SECRET`
   - `GEMINI_API_KEY` (optional)
7. Deploy → Lưu backend URL

### 2. Deploy Frontend

1. Tạo project mới trên Vercel (cùng repo)
2. **Root Directory**: `frontend`
3. **Build Command**: `pnpm install --recursive --no-frozen-lockfile && pnpm build --filter @vben/playground^... && pnpm --filter @vben/playground build`
4. **Output Directory**: `dist`
5. ✅ **Include files outside root**: Enabled
6. Thêm Environment Variable:
   - `VITE_GLOB_API_URL` = `https://your-backend.vercel.app/api`
7. Deploy

### 3. Kết nối

- Frontend tự động sử dụng `VITE_GLOB_API_URL` để gọi API
- Backend đã config CORS cho tất cả origins

---

## 📚 Chi tiết

Xem file `DEPLOY_VERCEL.md` để biết chi tiết từng bước.

---

## 🔧 Local Development

### Backend:
```bash
cd backend
pnpm install
pnpm start
# Server: http://localhost:5320
```

### Frontend:
```bash
cd frontend
pnpm install
# Tạo .env.local với: VITE_GLOB_API_URL=http://localhost:5320/api
pnpm dev
# App: http://localhost:5555
```

---

## ❓ Troubleshooting

Xem `DEPLOY_VERCEL.md` phần Troubleshooting.

