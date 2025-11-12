# Hướng dẫn Deploy lên Vercel

## 📋 Yêu cầu

1. Tài khoản Vercel (đăng ký tại https://vercel.com)
2. GitHub repository đã push code
3. MongoDB Atlas connection string
4. Gemini API key (nếu dùng Gemini model)

## 🚀 Các bước Deploy

### Bước 1: Chuẩn bị Environment Variables

Trước khi deploy, bạn cần chuẩn bị các biến môi trường sau:

1. **MONGODB_URI**: Connection string của MongoDB Atlas
   - Ví dụ: `mongodb+srv://username:password@cluster.mongodb.net/?appName=app-name`

2. **GEMINI_API_KEY** (Optional): API key cho Gemini model
   - Lấy tại: https://aistudio.google.com/app/apikey

3. **JWT_SECRET** (Optional): Secret key cho JWT tokens (nếu không set sẽ dùng default)

### Bước 2: Deploy qua Vercel Dashboard

#### 2.1. Import Project

1. Đăng nhập vào [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Chọn repository GitHub của bạn
4. Click **"Import"**

#### 2.2. Cấu hình Project

1. **Framework Preset**: Không chọn (hoặc chọn "Other")
2. **Root Directory**: Để trống (root của monorepo)
3. **Build Command**: `pnpm vercel:build`
4. **Output Directory**: `.vercel/output`
5. **Install Command**: `pnpm install -w --no-frozen-lockfile`

#### 2.3. Thêm Environment Variables

Trong phần **"Environment Variables"**, thêm các biến sau:

| Name | Value | Environment |
|------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://...` | Production, Preview, Development |
| `GEMINI_API_KEY` | `AIzaSy...` | Production, Preview, Development |
| `JWT_ACCESS_TOKEN_SECRET` | (random string) | Production, Preview, Development |
| `JWT_REFRESH_TOKEN_SECRET` | (random string) | Production, Preview, Development |

**Lưu ý:**
- Để tạo JWT secrets, bạn có thể dùng: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Hoặc dùng online tool: https://generate-secret.vercel.app/32

#### 2.4. Deploy

1. Click **"Deploy"**
2. Chờ build hoàn tất (thường mất 3-5 phút)
3. Sau khi deploy xong, bạn sẽ có URL như: `https://your-project.vercel.app`

### Bước 3: Kiểm tra Deployment

1. Truy cập URL được cung cấp
2. Kiểm tra:
   - Frontend load được không
   - API endpoints hoạt động không (`/api/status`)
   - Login có hoạt động không

## 🔧 Cấu hình nâng cao

### Custom Domain

1. Vào **Settings** → **Domains**
2. Thêm domain của bạn
3. Follow instructions để cấu hình DNS

### Environment Variables cho từng môi trường

Bạn có thể set khác nhau cho:
- **Production**: Môi trường production
- **Preview**: Các preview deployments (từ PR)
- **Development**: Local development (nếu dùng Vercel CLI)

### Build Logs

Nếu build fail, check:
1. **Deployments** tab → Click vào deployment
2. Xem **Build Logs** để debug
3. Common issues:
   - Missing dependencies
   - Build timeout (tăng trong Settings)
   - Environment variables chưa set

## 📝 Cấu trúc Build

Build process sẽ:

1. **Install dependencies**: `pnpm install -w --no-frozen-lockfile`
2. **Build Backend**: `pnpm -F @vben/backend-mock build`
   - Nitro build với preset `vercel`
   - Output: `.vercel/output/`
3. **Build Frontend**: `pnpm -F @vben/playground build`
   - Vite build
   - Output: `playground/dist/`
4. **Merge**: Copy `playground/dist/` → `.vercel/output/static/`

Kết quả: Một Vercel project serve cả FE và BE.

## 🐛 Troubleshooting

### Lỗi: "Cannot find module"

**Nguyên nhân**: Dependencies chưa được install đúng
**Giải pháp**: 
- Check `pnpm-lock.yaml` có commit không
- Đảm bảo `installCommand` đúng

### Lỗi: "Build timeout"

**Nguyên nhân**: Build quá lâu
**Giải pháp**:
- Vào Settings → General → Build & Development Settings
- Tăng "Build Command Timeout" (max 45 phút)

### Lỗi: "MongoDB connection failed"

**Nguyên nhân**: Environment variable chưa set hoặc sai
**Giải pháp**:
- Check `MONGODB_URI` trong Environment Variables
- Đảm bảo MongoDB Atlas IP whitelist cho phép Vercel IPs (hoặc `0.0.0.0/0`)

### Lỗi: "GEMINI_API_KEY is not set"

**Nguyên nhân**: API key chưa set
**Giải pháp**:
- Thêm `GEMINI_API_KEY` vào Environment Variables
- Hoặc chỉ dùng local models (không cần Gemini)

## 🔐 Security Best Practices

1. **Không commit secrets vào code**
   - Dùng Environment Variables
   - Check `.gitignore` có ignore `.env` files

2. **Rotate secrets định kỳ**
   - Đổi JWT secrets mỗi 3-6 tháng
   - Rotate API keys nếu bị leak

3. **Limit MongoDB access**
   - Dùng MongoDB Atlas IP whitelist
   - Tạo user riêng cho production với quyền tối thiểu

## 📚 Tài liệu tham khảo

- [Vercel Documentation](https://vercel.com/docs)
- [Nitro Vercel Preset](https://nitro.unjs.io/deploy/providers/vercel)
- [Vite Build](https://vitejs.dev/guide/build.html)

## ✅ Checklist trước khi Deploy

- [ ] Code đã push lên GitHub
- [ ] Environment variables đã chuẩn bị
- [ ] MongoDB Atlas đã setup và whitelist IPs
- [ ] Gemini API key đã có (nếu dùng)
- [ ] JWT secrets đã generate
- [ ] Test local build thành công: `pnpm vercel:build`
- [ ] `.gitignore` đã ignore sensitive files

## 🎉 Sau khi Deploy

1. Test tất cả features:
   - Login/Logout
   - Chat functionality
   - Analytics
   - Model management (admin)
   - User management (admin)

2. Monitor:
   - Vercel Analytics (nếu enable)
   - Error logs trong Vercel Dashboard
   - MongoDB Atlas metrics

3. Setup:
   - Custom domain (nếu có)
   - CI/CD cho auto-deploy từ main branch
   - Preview deployments cho PRs

