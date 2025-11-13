# 🚀 Các bước Deploy lên Vercel

## 📋 Sau khi Build xong

Sau khi build thành công từ root:
```bash
pnpm build
```

Bạn có 3 cách để deploy lên Vercel:

---

## 🎯 Cách 1: Deploy qua Vercel Dashboard (KHUYẾN NGHỊ)

### Bước 1: Push code lên GitHub

```bash
# Commit và push code
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Bước 2: Tạo Project trên Vercel

1. Đăng nhập [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Chọn repository GitHub của bạn
4. Click **"Import"**

### Bước 3: Cấu hình Backend Project

**Project Settings:**
- **Project Name**: `your-project-backend`
- **Root Directory**: `backend`
- **Framework Preset**: `Other`
- **Build Command**: `pnpm install --recursive --no-frozen-lockfile && pnpm --filter @vben/backend-mock build`
- **Output Directory**: `.vercel/output` (hoặc để trống để Vercel tự detect)
- **Install Command**: `pnpm install --recursive --no-frozen-lockfile`
- ✅ **Include files outside the root directory**: **Enabled**

**Environment Variables:**
- `MONGODB_URI`
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`
- `GEMINI_API_KEY` (optional)

**Deploy** → Lưu backend URL

### Bước 4: Cấu hình Frontend Project

1. Tạo project mới (cùng repo)
2. **Root Directory**: `frontend`
3. **Build Command**: `pnpm install --recursive --no-frozen-lockfile && pnpm build --filter @vben/playground^... && pnpm --filter @vben/playground build`
4. **Output Directory**: `dist`
5. ✅ **Include files outside the root directory**: **Enabled**

**Environment Variables:**
- `VITE_GLOB_API_URL` = `https://your-backend.vercel.app/api`

**Deploy** → Xong!

---

## 🎯 Cách 2: Deploy bằng Vercel CLI

### Bước 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Bước 2: Login

```bash
vercel login
```

### Bước 3: Deploy Backend

```bash
cd backend
vercel
```

Làm theo hướng dẫn:
- Link to existing project? **No** (lần đầu)
- Project name: `your-project-backend`
- Directory: `./backend`
- Override settings? **Yes**
  - Build Command: `pnpm install --recursive --no-frozen-lockfile && pnpm --filter @vben/backend-mock build`
  - Output Directory: `.vercel/output`
  - Install Command: `pnpm install --recursive --no-frozen-lockfile`

Sau đó set environment variables:
```bash
vercel env add MONGODB_URI
vercel env add JWT_ACCESS_TOKEN_SECRET
vercel env add JWT_REFRESH_TOKEN_SECRET
```

Deploy production:
```bash
vercel --prod
```

### Bước 4: Deploy Frontend

```bash
cd ../frontend
vercel
```

Làm theo hướng dẫn tương tự, sau đó:
```bash
vercel env add VITE_GLOB_API_URL
# Nhập: https://your-backend.vercel.app/api

vercel --prod
```

---

## 🎯 Cách 3: Auto Deploy từ GitHub (Tự động)

Sau khi đã setup project trên Vercel Dashboard:

1. **Mỗi lần push code lên GitHub**, Vercel sẽ tự động:
   - Detect changes
   - Build lại
   - Deploy tự động

2. **Không cần làm gì thêm**, chỉ cần:
   ```bash
   git add .
   git commit -m "Update code"
   git push origin main
   ```

3. Vercel sẽ tự động deploy!

---

## ✅ Checklist trước khi Deploy

### Backend:
- [ ] Code đã commit và push lên GitHub
- [ ] Environment variables đã chuẩn bị
- [ ] Build command đúng
- [ ] Output directory đúng (`.vercel/output` hoặc để trống)

### Frontend:
- [ ] Code đã commit và push lên GitHub
- [ ] Backend đã deploy và có URL
- [ ] `VITE_GLOB_API_URL` đã set với backend URL + `/api`
- [ ] Build command đúng (có build dependencies trước)

---

## 🎉 Sau khi Deploy

1. **Test Backend:**
   ```bash
   curl https://your-backend.vercel.app/api/status
   ```

2. **Test Frontend:**
   - Mở URL frontend trong browser
   - Kiểm tra console không có lỗi
   - Test login/API calls

3. **Monitor:**
   - Vercel Dashboard → Deployments
   - Xem logs nếu có lỗi
   - Check Analytics

---

## 💡 Tips

1. **Preview Deployments**: Mỗi PR sẽ tạo preview deployment tự động
2. **Custom Domain**: Có thể setup domain riêng trong Settings
3. **Environment Variables**: Có thể set khác nhau cho Production/Preview/Development
4. **Rollback**: Có thể rollback về deployment cũ nếu có lỗi

---

## 📚 Tài liệu tham khảo

- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Vercel Dashboard](https://vercel.com/dashboard)
- Xem `DEPLOY_VERCEL.md` để biết chi tiết hơn

