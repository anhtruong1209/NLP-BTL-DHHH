# 🛠️ Hướng dẫn Local Development

## 📋 Yêu cầu

- Node.js >= 20.10.0
- pnpm >= 9.12.0

## 🚀 Setup lần đầu

### 1. Install dependencies từ root

```bash
# Từ root của monorepo
pnpm install
```

Lệnh này sẽ:
- Install tất cả dependencies cho tất cả packages trong monorepo
- Link các workspace packages với nhau
- Chạy postinstall scripts

### 2. Chạy Backend

```bash
# Từ root của monorepo
pnpm --filter @vben/backend-mock start

# Hoặc từ thư mục backend
cd backend
pnpm start
```

Backend sẽ chạy tại: `http://localhost:5320`

### 3. Chạy Frontend

```bash
# Từ root của monorepo (KHUYẾN NGHỊ)
pnpm --filter @vben/playground dev

# Hoặc
pnpm dev:play

# Hoặc từ thư mục frontend (sau khi đã install từ root)
cd frontend
pnpm dev
```

Frontend sẽ chạy tại: `http://localhost:5555`

## ⚠️ Lưu ý quan trọng

### Không chạy `pnpm install` trong thư mục con

❌ **SAI**:
```bash
cd frontend
pnpm install  # Sẽ gây lỗi dependencies
```

✅ **ĐÚNG**:
```bash
# Từ root
pnpm install
```

### Frontend cần Backend

Frontend cần backend API để hoạt động. Có 2 cách:

**Option 1: Chạy backend local**
```bash
# Terminal 1: Backend
pnpm --filter @vben/backend-mock start

# Terminal 2: Frontend
pnpm --filter @vben/playground dev
```

**Option 2: Dùng backend trên Vercel**
- Tạo file `.env.local` trong `frontend/`:
```env
VITE_GLOB_API_URL=https://your-backend.vercel.app/api
```

## 🔧 Troubleshooting

### Lỗi: "Failed to resolve import"

**Nguyên nhân**: Dependencies chưa được install hoặc workspace chưa được link.

**Giải pháp**:
```bash
# Từ root
pnpm install
```

### Lỗi: "Package @vben/xxx not found"

**Nguyên nhân**: Workspace packages chưa được build.

**Giải pháp**:
```bash
# Build tất cả packages
pnpm build

# Hoặc build từng package cần thiết
pnpm --filter @vben/constants build
pnpm --filter @vben/utils build
# ... các packages khác
```

### Lỗi: "ant-design-vue not found"

**Nguyên nhân**: Dependencies chưa được install từ root.

**Giải pháp**:
```bash
# Từ root
pnpm install
```

### Lỗi khi chạy từ thư mục `frontend/`

Nếu chạy `pnpm dev` từ thư mục `frontend/` mà gặp lỗi, hãy:

1. Đảm bảo đã chạy `pnpm install` từ root
2. Hoặc chạy từ root: `pnpm --filter @vben/playground dev`

## 📝 Scripts hữu ích

Từ root của monorepo:

```bash
# Dev
pnpm dev:play          # Chạy frontend
pnpm --filter @vben/backend-mock start  # Chạy backend

# Build
pnpm build:play        # Build frontend
pnpm --filter @vben/backend-mock build   # Build backend

# Clean
pnpm clean             # Xóa tất cả build artifacts
```

## 🎯 Workflow khuyến nghị

1. **Lần đầu setup**:
   ```bash
   pnpm install
   ```

2. **Development**:
   ```bash
   # Terminal 1: Backend
   pnpm --filter @vben/backend-mock start
   
   # Terminal 2: Frontend
   pnpm dev:play
   ```

3. **Build để test**:
   ```bash
   pnpm build:play
   pnpm --filter @vben/playground preview
   ```

