# ⚡ Hướng dẫn nhanh Deploy lên Vercel

## 📋 So sánh với hướng dẫn Vben

Hướng dẫn của Vben chủ yếu cho **deploy truyền thống** (nginx/CDN), còn Vercel là **serverless platform** nên có một số khác biệt:

| Vben Guide | Vercel |
|------------|--------|
| Build local → Upload dist folder | Push code → Vercel tự build |
| Cấu hình nginx | Không cần (Vercel tự xử lý) |
| Cấu hình CORS ở nginx | Cấu hình trong code (đã có) |
| Sửa `.env.production` | Set Environment Variables trong Vercel Dashboard |
| `VITE_BASE` cho subdirectory | Không cần (Vercel tự xử lý routing) |

## 🚀 Build & Deploy trên Vercel

### Không cần build local!

Với Vercel, bạn **KHÔNG CẦN** chạy `pnpm build` local. Chỉ cần:

1. **Push code lên GitHub**
2. **Vercel tự động build và deploy**

### Các bước:

#### 1. Commit và Push code

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

#### 2. Tạo Project trên Vercel Dashboard

1. Vào https://vercel.com/dashboard
2. **Add New Project**
3. Chọn repository
4. Cấu hình settings (xem `DEPLOY_VERCEL.md`)

#### 3. Vercel tự động:

- ✅ Install dependencies
- ✅ Build project
- ✅ Deploy
- ✅ Tạo URL

## 🔧 Cấu hình Environment Variables

Thay vì sửa `.env.production`, set trong **Vercel Dashboard**:

### Frontend:
- `VITE_GLOB_API_URL` = `https://your-backend.vercel.app/api`

### Backend:
- `MONGODB_URI`
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`
- `GEMINI_API_KEY` (optional)

## 📝 Build Commands (Vercel tự chạy)

### Frontend:
```
pnpm install --recursive --no-frozen-lockfile && 
pnpm build --filter @vben/playground^... && 
pnpm --filter @vben/playground build
```

### Backend:
```
pnpm install --recursive --no-frozen-lockfile && 
pnpm --filter @vben/backend-mock build
```

## ✅ Đã sửa các lỗi:

1. ✅ EJS template trong `index.html` → Thay bằng text mặc định
2. ✅ EJS template trong loading templates → Thay bằng text mặc định
3. ✅ `jiti` module error → Đã exclude và replace
4. ✅ Serverless Functions limit → Gộp tất cả API vào 1 function

## 🎯 Sau khi deploy:

1. **Backend URL**: `https://your-backend.vercel.app`
2. **Frontend URL**: `https://your-frontend.vercel.app`
3. **Auto-deploy**: Mỗi lần push code → Tự động deploy

## 💡 Tips:

- **Preview Deployments**: Mỗi PR tạo preview URL tự động
- **Custom Domain**: Có thể setup trong Settings
- **Analytics**: Enable trong Vercel Dashboard
- **Logs**: Xem real-time logs trong Dashboard

## 📚 Chi tiết:

Xem `DEPLOY_VERCEL.md` để biết chi tiết từng bước cấu hình.

