# 🚀 Hướng dẫn Deploy Backend & Frontend lên Vercel

## 📋 Tổng quan

Dự án được tách thành 2 project riêng biệt trên Vercel:
- **Backend**: API server (Nitro) tại `backend/`
- **Frontend**: Vue.js app tại `frontend/`

Hai project giao tiếp với nhau qua **Environment Variable** `VITE_GLOB_API_URL`.

---

## 🎯 Quy trình Deploy

### Bước 1: Deploy Backend trước

Backend cần được deploy trước để có URL, sau đó frontend mới có thể kết nối.

#### 1.1. Tạo Backend Project trên Vercel

1. Đăng nhập [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Chọn repository GitHub của bạn
4. Click **"Import"**

#### 1.2. Cấu hình Backend Project

Vào **Settings** → **General**:

- **Project Name**: `your-project-backend` (hoặc tên bạn muốn)
- **Root Directory**: `backend`
- **Framework Preset**: `Other`

Vào **Settings** → **Build and Deployment Settings**:

- **Build Command**: `pnpm install --recursive --no-frozen-lockfile && pnpm --filter @vben/backend-mock build`
- **Output Directory**: `.vercel/output`
- **Install Command**: `pnpm install --recursive --no-frozen-lockfile`
- **Development Command**: (để trống)
- ✅ **Include files outside the root directory in the Build Step**: **Enabled** (QUAN TRỌNG!)

#### 1.3. Thêm Environment Variables cho Backend

Vào **Settings** → **Environment Variables**, thêm:

| Name | Value | Environment | Mô tả |
|------|-------|-------------|-------|
| `MONGODB_URI` | `mongodb+srv://...` | Production, Preview, Development | MongoDB connection string |
| `GEMINI_API_KEY` | `AIzaSy...` | Production, Preview, Development | Gemini API key (optional) |
| `JWT_ACCESS_TOKEN_SECRET` | (random string) | Production, Preview, Development | JWT secret cho access token |
| `JWT_REFRESH_TOKEN_SECRET` | (random string) | Production, Preview, Development | JWT secret cho refresh token |
| `FRONTEND_URL` | (sẽ set sau) | Production, Preview, Development | URL của frontend (optional, để config CORS) |

**Lưu ý**:
- Để generate JWT secrets:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `FRONTEND_URL` có thể để trống hoặc set sau khi deploy frontend

#### 1.4. Deploy Backend

1. Click **"Deploy"**
2. Chờ build hoàn tất (thường 3-5 phút)
3. **Lưu lại URL của backend** (ví dụ: `https://your-project-backend.vercel.app`)

#### 1.5. Test Backend

```bash
curl https://your-project-backend.vercel.app/api/status
```

Nếu trả về JSON response thì backend đã hoạt động.

---

### Bước 2: Deploy Frontend

#### 2.1. Tạo Frontend Project trên Vercel

1. Trong Vercel Dashboard, click **"Add New..."** → **"Project"**
2. Chọn **CÙNG repository** như backend project
3. Click **"Import"**

#### 2.2. Cấu hình Frontend Project

Vào **Settings** → **General**:

- **Project Name**: `your-project-frontend` (hoặc tên bạn muốn)
- **Root Directory**: `frontend`
- **Framework Preset**: `Vite` (hoặc `Other`)

Vào **Settings** → **Build and Deployment Settings**:

- **Build Command**: `pnpm install --recursive --no-frozen-lockfile && pnpm build --filter @vben/playground^... && pnpm --filter @vben/playground build`
- **Output Directory**: `dist`
- **Install Command**: `pnpm install --recursive --no-frozen-lockfile`
- **Development Command**: (để trống)
- ✅ **Include files outside the root directory in the Build Step**: **Enabled** (QUAN TRỌNG!)

> ⚠️ **LƯU Ý**: Build command có 2 phần:
> - `pnpm build --filter @vben/playground^...` - Build tất cả dependencies trước
> - `pnpm --filter @vben/playground build` - Build frontend sau

#### 2.3. Thêm Environment Variables cho Frontend

Vào **Settings** → **Environment Variables**, thêm:

| Name | Value | Environment | Mô tả |
|------|-------|-------------|-------|
| `VITE_GLOB_API_URL` | `https://your-project-backend.vercel.app/api` | Production, Preview, Development | URL của backend API |

**QUAN TRỌNG**:
- Thay `your-project-backend.vercel.app` bằng URL thực tế của backend vừa deploy
- **Phải có `/api` ở cuối URL** (ví dụ: `https://backend.vercel.app/api`)

#### 2.4. Deploy Frontend

1. Click **"Deploy"**
2. Chờ build hoàn tất
3. **Lưu lại URL của frontend** (ví dụ: `https://your-project-frontend.vercel.app`)

#### 2.5. Cập nhật Backend CORS (Optional)

Nếu muốn restrict CORS chỉ cho frontend domain:

1. Vào backend project → **Settings** → **Environment Variables**
2. Update `FRONTEND_URL` = `https://your-project-frontend.vercel.app`
3. Redeploy backend

---

## 🔗 Kết nối Frontend với Backend

### Cách hoạt động:

1. **Frontend** đọc `VITE_GLOB_API_URL` từ environment variable
2. Trong build time, Vite inject giá trị này vào `_app.config.js`
3. Frontend code sử dụng `useAppConfig()` để lấy `apiURL`
4. Tất cả API calls sẽ đi đến backend URL đã config

### Kiểm tra kết nối:

1. Mở frontend URL trong browser
2. Mở Developer Tools → Network tab
3. Thực hiện một action (ví dụ: login)
4. Kiểm tra API calls có đi đến đúng backend URL không

---

## 📝 Environment Variables Summary

### Backend Environment Variables:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=app-name
GEMINI_API_KEY=AIzaSy... (optional)
JWT_ACCESS_TOKEN_SECRET=your-secret-here
JWT_REFRESH_TOKEN_SECRET=your-secret-here
FRONTEND_URL=https://your-frontend.vercel.app (optional)
```

### Frontend Environment Variables:

```env
VITE_GLOB_API_URL=https://your-backend.vercel.app/api
```

---

## 🐛 Troubleshooting

### Lỗi: "Failed to resolve entry for package @vben-core/xxx"

**Nguyên nhân**: Dependencies chưa được build hoặc không tìm thấy.

**Giải pháp**:
1. ✅ Đảm bảo "Include files outside the root directory" đã bật
2. ✅ Kiểm tra build command có build dependencies trước không
3. ✅ Frontend build command phải là: `pnpm build --filter @vben/playground^... && pnpm --filter @vben/playground build`

### Lỗi: "Backend build did not produce .vercel/output"

**Nguyên nhân**: Nitro không output đúng thư mục.

**Giải pháp**:
1. Kiểm tra `backend/nitro.config.ts` có `preset: 'vercel'` không
2. Kiểm tra Output Directory trong Vercel settings = `.vercel/output`

### Lỗi: "API calls fail" hoặc "Network error"

**Nguyên nhân**: Frontend chưa config đúng backend URL.

**Giải pháp**:
1. ✅ Kiểm tra `VITE_GLOB_API_URL` trong Frontend Environment Variables
2. ✅ Đảm bảo URL có `/api` ở cuối (ví dụ: `https://backend.vercel.app/api`)
3. ✅ Redeploy frontend sau khi update env var
4. ✅ Check browser console → Network tab để xem API calls đi đến đâu
5. ✅ Check file `_app.config.js` trong build output xem có chứa đúng URL không

### Lỗi: "CORS error"

**Nguyên nhân**: Backend chưa config CORS đúng.

**Giải pháp**:
1. Backend đã config CORS cho tất cả origins (`*`) trong `nitro.config.ts`
2. Nếu vẫn lỗi, kiểm tra `backend/middleware/1.api.ts`
3. Có thể set `FRONTEND_URL` trong backend env vars để restrict CORS

### Lỗi: "MongoDB connection failed"

**Nguyên nhân**: Environment variable chưa set hoặc sai.

**Giải pháp**:
1. ✅ Check `MONGODB_URI` trong Backend Environment Variables
2. ✅ Đảm bảo MongoDB Atlas IP whitelist cho phép Vercel IPs (hoặc `0.0.0.0/0`)

### Lỗi: "Build timeout"

**Nguyên nhân**: Build quá lâu.

**Giải pháp**:
1. Vào Settings → General → Build & Development Settings
2. Tăng "Build Command Timeout" (max 45 phút)

---

## ✅ Checklist

### Backend:
- [ ] Root Directory: `backend`
- [ ] Build Command: `pnpm install --recursive --no-frozen-lockfile && pnpm --filter @vben/backend-mock build`
- [ ] Output Directory: `.vercel/output`
- [ ] Include files outside root: ✅ Enabled
- [ ] Environment Variables:
  - [ ] `MONGODB_URI`
  - [ ] `JWT_ACCESS_TOKEN_SECRET`
  - [ ] `JWT_REFRESH_TOKEN_SECRET`
  - [ ] `GEMINI_API_KEY` (optional)
- [ ] Deploy thành công
- [ ] Backend URL đã lưu
- [ ] Test API: `curl https://backend.vercel.app/api/status`

### Frontend:
- [ ] Root Directory: `frontend`
- [ ] Build Command: `pnpm install --recursive --no-frozen-lockfile && pnpm build --filter @vben/playground^... && pnpm --filter @vben/playground build`
- [ ] Output Directory: `dist`
- [ ] Include files outside root: ✅ Enabled
- [ ] Environment Variable: `VITE_GLOB_API_URL` = Backend URL + `/api`
- [ ] Deploy thành công
- [ ] Frontend URL đã lưu
- [ ] Test frontend load được
- [ ] Test API calls từ frontend

---

## 🎉 Sau khi Deploy

1. **Test toàn bộ features**:
   - Login/Logout
   - Chat functionality
   - API calls từ frontend
   - Analytics
   - Model management
   - User management

2. **Monitor**:
   - Vercel Analytics (nếu enable)
   - Error logs trong cả 2 projects
   - MongoDB Atlas metrics

3. **Setup thêm** (optional):
   - Custom domains cho cả 2 projects
   - Preview deployments cho PRs
   - CI/CD workflows

---

## 📚 Tài liệu tham khảo

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Monorepo Guide](https://vercel.com/docs/monorepos)
- [Nitro Vercel Preset](https://nitro.unjs.io/deploy/providers/vercel)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

## 💡 Tips

1. **Deploy order**: Luôn deploy backend trước, sau đó mới deploy frontend
2. **Environment Variables**: Có thể set khác nhau cho Production, Preview, Development
3. **Preview Deployments**: Mỗi PR sẽ tạo preview deployment tự động
4. **Custom Domains**: Có thể setup custom domain cho cả 2 projects
5. **Monitoring**: Enable Vercel Analytics để monitor performance

