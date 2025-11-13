# 🎯 Tối ưu số lượng Serverless Functions

## Vấn đề

Vercel Hobby plan chỉ cho phép **tối đa 12 Serverless Functions** mỗi deployment. 
Với ~35 API files, mỗi file tạo ra 1 function → Vượt quá giới hạn.

## Giải pháp

Thay vì tạo 1 function cho mỗi API file, chúng ta sẽ:

1. **Tắt auto-generation** của Nitro cho thư mục `api/`
2. **Tạo 1 catch-all route** trong `routes/api/[...].ts` để xử lý tất cả API calls
3. **Lazy load** các handlers khi cần

## Cấu hình

### 1. `nitro.config.ts`

Đã thêm:
```typescript
ignore: ['api/**'],  // Không tự động tạo functions từ api folder
```

### 2. `routes/api/[...].ts`

Catch-all route xử lý tất cả API calls và lazy load handlers.

## Kết quả

- **Trước**: ~35 functions (vượt quá giới hạn 12)
- **Sau**: 1 function duy nhất (trong giới hạn)

## Lưu ý

- Tất cả API routes vẫn hoạt động bình thường
- Performance có thể chậm hơn một chút do lazy loading, nhưng vẫn chấp nhận được
- Nếu cần performance tốt hơn, có thể upgrade lên Vercel Pro plan (không giới hạn functions)

## Test

Sau khi deploy, test các API endpoints:
- `/api/auth/login`
- `/api/user/info`
- `/api/models/list`
- etc.

Tất cả đều phải hoạt động bình thường.

