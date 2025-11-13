# Environment Variables Guide

## 📋 Backend Environment Variables

Tạo file `.env` hoặc `.env.local` trong thư mục `backend/`:

```env
# MongoDB Connection String
# Lấy từ MongoDB Atlas: https://cloud.mongodb.com
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=app-name

# Gemini API Key (Optional)
# Lấy từ: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...

# JWT Secrets
# Generate bằng: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_TOKEN_SECRET=your-access-token-secret-here
JWT_REFRESH_TOKEN_SECRET=your-refresh-token-secret-here

# Frontend URL (để config CORS - optional)
# Sẽ được set tự động trong Vercel, hoặc set thủ công nếu cần
FRONTEND_URL=https://your-frontend-project.vercel.app
```

### Generate JWT Secrets:

```bash
# Generate access token secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate refresh token secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📋 Frontend Environment Variables

Tạo file `.env` hoặc `.env.local` trong thư mục `frontend/`:

```env
# Backend API URL
# Sau khi deploy backend lên Vercel, thay bằng URL của backend project
# Ví dụ: https://your-backend-project.vercel.app/api
VITE_GLOB_API_URL=https://your-backend-project.vercel.app/api

# Local development (uncomment để dùng local backend)
# VITE_GLOB_API_URL=http://localhost:5320/api
```

**QUAN TRỌNG**: 
- URL phải có `/api` ở cuối
- Ví dụ: `https://backend.vercel.app/api` ✅
- Ví dụ: `https://backend.vercel.app` ❌ (thiếu `/api`)

---

## 🔐 Security Notes

1. **Không commit `.env` files vào Git**
   - Đã có trong `.gitignore`
   - Chỉ commit `.env.example` (nếu có)

2. **Vercel Environment Variables**
   - Set trong Vercel Dashboard → Settings → Environment Variables
   - Có thể set khác nhau cho Production, Preview, Development

3. **Local Development**
   - Dùng `.env.local` (đã ignore trong git)
   - Hoặc `.env` (cũng đã ignore)

---

## 📝 Checklist

### Backend:
- [ ] `MONGODB_URI` đã set
- [ ] `JWT_ACCESS_TOKEN_SECRET` đã generate và set
- [ ] `JWT_REFRESH_TOKEN_SECRET` đã generate và set
- [ ] `GEMINI_API_KEY` đã set (nếu dùng Gemini)
- [ ] `FRONTEND_URL` đã set (optional, để config CORS)

### Frontend:
- [ ] `VITE_GLOB_API_URL` đã set với backend URL + `/api`
- [ ] URL đúng format (có `/api` ở cuối)

