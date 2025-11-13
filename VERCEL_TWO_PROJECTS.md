# 🚀 Hướng dẫn Deploy 2 Project riêng biệt trên Vercel

## 📋 Tổng quan

Dự án được tách thành 2 project riêng trên Vercel:
- **Frontend Project**: Serve static files từ `playground/`
- **Backend Project**: Serve API từ `apps/backend-mock/`

---

## 🎨 FRONTEND PROJECT (Playground)

### Bước 1: Tạo Project trên Vercel

1. Đăng nhập [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Chọn repository GitHub của bạn
4. Click **"Import"**

### Bước 2: Cấu hình Project Settings

Vào **Settings** → **Build and Deployment Settings**:

#### Framework Settings:
- **Framework Preset**: `Other` (hoặc để trống)
- **Build Command**: `pnpm --filter @vben/playground build --mode production`
- **Output Directory**: `dist`
- **Install Command**: `pnpm install --recursive --no-frozen-lockfile`
- **Development Command**: `None` (hoặc để trống)

#### Root Directory:
- **Root Directory**: `playground`
- **Include files outside the root directory in the Build Step**: ✅ **Enabled** (QUAN TRỌNG!)
- **Skip deployments when there are no changes to the root directory or its dependencies**: ❌ Disabled

> ⚠️ **LƯU Ý QUAN TRỌNG**: Phải bật "Include files outside the root directory" vì frontend cần các packages từ monorepo (như `@vben-core/*`, `@vben/*`).

### Bước 3: Environment Variables

Vào **Settings** → **Environment Variables**, thêm:

| Name | Value | Environment | Mô tả |
|------|-------|-------------|-------|
| `VITE_GLOB_API_URL` | `https://your-backend-project.vercel.app/api` | Production, Preview, Development | URL của backend project API (sẽ lấy sau khi deploy backend) |

**Lưu ý**: 
- Thay `your-backend-project.vercel.app` bằng URL thực tế của backend project sau khi deploy
- **QUAN TRỌNG**: Phải có `/api` ở cuối URL (ví dụ: `https://your-backend.vercel.app/api`)
- Nếu chưa có backend URL, có thể để tạm `http://localhost:5320/api` cho development, sau đó update lại

### Bước 4: Deploy

1. Click **"Deploy"**
2. Chờ build hoàn tất
3. Lưu lại URL của frontend project (ví dụ: `https://your-frontend-project.vercel.app`)

---

## ⚙️ BACKEND PROJECT (Backend Mock)

### Bước 1: Tạo Project mới trên Vercel

1. Trong Vercel Dashboard, click **"Add New..."** → **"Project"**
2. Chọn **CÙNG repository** như frontend project
3. Click **"Import"**

### Bước 2: Cấu hình Project Settings

Vào **Settings** → **Build and Deployment Settings**:

#### Framework Settings:
- **Framework Preset**: `Other` (hoặc để trống)
- **Build Command**: `pnpm --filter @vben/backend-mock build`
- **Output Directory**: `.vercel/output` (hoặc `.output` nếu Nitro không tạo `.vercel/output`)
- **Install Command**: `pnpm install --recursive --no-frozen-lockfile`
- **Development Command**: `None` (hoặc để trống)

#### Root Directory:
- **Root Directory**: `apps/backend-mock`
- **Include files outside the root directory in the Build Step**: ✅ **Enabled** (QUAN TRỌNG!)
- **Skip deployments when there are no changes to the root directory or its dependencies**: ❌ Disabled

> ⚠️ **LƯU Ý**: Backend cũng cần access các packages từ monorepo, nên phải bật "Include files outside the root directory".

### Bước 3: Environment Variables

Vào **Settings** → **Environment Variables**, thêm:

| Name | Value | Environment | Mô tả |
|------|-------|-------------|-------|
| `MONGODB_URI` | `mongodb+srv://...` | Production, Preview, Development | MongoDB connection string |
| `GEMINI_API_KEY` | `AIzaSy...` | Production, Preview, Development | Gemini API key (optional) |
| `JWT_ACCESS_TOKEN_SECRET` | (random string) | Production, Preview, Development | JWT secret cho access token |
| `JWT_REFRESH_TOKEN_SECRET` | (random string) | Production, Preview, Development | JWT secret cho refresh token |
| `NITRO_OUTPUT_DIR` | `.vercel/output` | Production, Preview, Development | Output directory cho Nitro (optional) |

**Lưu ý**:
- Để tạo JWT secrets, chạy:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Hoặc dùng: https://generate-secret.vercel.app/32

### Bước 4: Deploy

1. Click **"Deploy"**
2. Chờ build hoàn tất
3. Lưu lại URL của backend project (ví dụ: `https://your-backend-project.vercel.app`)

---

## 🔗 Kết nối Frontend với Backend

### Sau khi cả 2 project đã deploy xong:

1. **Lấy Backend URL**:
   - Vào backend project trên Vercel
   - Copy URL (ví dụ: `https://your-backend-project.vercel.app`)

2. **Update Frontend Environment Variable**:
   - Vào frontend project → **Settings** → **Environment Variables**
   - Update `VITE_GLOB_API_URL` với backend URL vừa copy + `/api` (ví dụ: `https://your-backend.vercel.app/api`)
   - Click **"Save"**

3. **Redeploy Frontend**:
   - Vào **Deployments** tab
   - Click **"..."** trên deployment mới nhất → **"Redeploy"**
   - Hoặc push một commit mới để trigger auto-deploy

---

## 🔧 Cấu hình Frontend để sử dụng Backend URL

### Kiểm tra file `playground/src/api/request.ts`:

File này sử dụng `useAppConfig` để lấy `apiURL` từ `VITE_GLOB_API_URL`. 

**Cách hoạt động**:
1. Trong production build, plugin `vite:extra-app-config` sẽ đọc env variable `VITE_GLOB_API_URL` từ `process.env`
2. Inject vào `window._VBEN_ADMIN_PRO_APP_CONF_` trong file `_app.config.js`
3. Frontend code sử dụng `useAppConfig()` để lấy `apiURL` từ đó

**Không cần thay đổi code**, chỉ cần set env variable `VITE_GLOB_API_URL` trong Vercel là đủ.

### Cho Local Development:

Nếu muốn test local, tạo file `.env` hoặc `.env.local` trong `playground/`:

```env
VITE_GLOB_API_URL=http://localhost:5320/api
```

---

## ✅ Checklist

### Frontend Project:
- [ ] Root Directory: `playground`
- [ ] Build Command: `pnpm --filter @vben/playground build --mode production`
- [ ] Output Directory: `dist`
- [ ] Install Command: `pnpm install --recursive --no-frozen-lockfile`
- [ ] Include files outside root: ✅ Enabled
- [ ] Environment Variable: `VITE_GLOB_API_URL` = Backend URL + `/api` (ví dụ: `https://backend.vercel.app/api`)
- [ ] Deploy thành công
- [ ] Frontend URL đã lưu

### Backend Project:
- [ ] Root Directory: `apps/backend-mock`
- [ ] Build Command: `pnpm --filter @vben/backend-mock build`
- [ ] Output Directory: `.vercel/output` hoặc `.output`
- [ ] Install Command: `pnpm install --recursive --no-frozen-lockfile`
- [ ] Include files outside root: ✅ Enabled
- [ ] Environment Variables:
  - [ ] `MONGODB_URI`
  - [ ] `GEMINI_API_KEY` (optional)
  - [ ] `JWT_ACCESS_TOKEN_SECRET`
  - [ ] `JWT_REFRESH_TOKEN_SECRET`
- [ ] Deploy thành công
- [ ] Backend URL đã lưu
- [ ] Test API endpoint: `https://your-backend-project.vercel.app/api/status`

### Kết nối:
- [ ] Frontend `VITE_GLOB_API_URL` đã update với Backend URL + `/api`
- [ ] Frontend đã redeploy sau khi update env var
- [ ] Test login/API calls từ frontend

---

## 🐛 Troubleshooting

### Lỗi: "Failed to resolve entry for package @vben-core/xxx"

**Nguyên nhân**: Package chưa được build hoặc không tìm thấy.

**Giải pháp**:
1. Đảm bảo "Include files outside the root directory" đã bật
2. Kiểm tra `installCommand` có `--recursive` không
3. Kiểm tra build logs xem có lỗi install không

### Lỗi: "Backend build did not produce .vercel/output"

**Nguyên nhân**: Nitro không output đúng thư mục.

**Giải pháp**:
1. Kiểm tra `apps/backend-mock/nitro.config.ts` (nếu có)
2. Thêm env var `NITRO_OUTPUT_DIR=.vercel/output`
3. Hoặc đổi Output Directory trong Vercel settings thành `.output`

### Lỗi: "CORS error" khi frontend gọi backend

**Nguyên nhân**: Backend chưa config CORS cho frontend domain.

**Giải pháp**:
1. Kiểm tra backend có middleware CORS không
2. Thêm frontend URL vào CORS allowed origins
3. Hoặc config CORS trong Nitro config

### Lỗi: "API calls fail" sau khi deploy

**Nguyên nhân**: Frontend chưa update `VITE_GLOB_API_URL` hoặc backend URL sai.

**Giải pháp**:
1. Kiểm tra Environment Variables trong frontend project
2. Đảm bảo `VITE_GLOB_API_URL` đúng với backend URL + `/api` (ví dụ: `https://backend.vercel.app/api`)
3. Redeploy frontend sau khi update env var (Vercel sẽ tự động rebuild khi save env var)
4. Check browser console → Network tab để xem API calls đi đến đâu
5. Check file `_app.config.js` trong build output xem có chứa đúng URL không

---

## 📚 Tài liệu tham khảo

- [Vercel Monorepo Guide](https://vercel.com/docs/monorepos)
- [Nitro Vercel Preset](https://nitro.unjs.io/deploy/providers/vercel)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

## 🎉 Sau khi hoàn tất

1. **Test toàn bộ features**:
   - Login/Logout
   - Chat functionality
   - API calls từ frontend
   - Analytics
   - Model management
   - User management

2. **Monitor**:
   - Vercel Analytics
   - Error logs trong cả 2 projects
   - MongoDB Atlas metrics

3. **Setup thêm** (optional):
   - Custom domains cho cả 2 projects
   - Preview deployments cho PRs
   - CI/CD workflows

