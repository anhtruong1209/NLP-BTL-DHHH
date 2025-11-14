# Hướng dẫn Test API

## 1. Test bằng Postman/Thunder Client

### Endpoint: Login
- **URL**: `https://nlp-btl-dhhh-backend-mock.vercel.app/api/auth/login`
- **Method**: `POST`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (JSON):
  ```json
  {
    "selectAccount": "admin",
    "username": "admin",
    "password": "admin@123",
    "captcha": true
  }
  ```

### Endpoint: Get User Info
- **URL**: `https://nlp-btl-dhhh-backend-mock.vercel.app/api/user/info`
- **Method**: `GET`
- **Headers**:
  ```
  Authorization: Bearer <token>
  ```

## 2. Test bằng cURL (PowerShell)

```powershell
# Login
$body = @{
    selectAccount = "admin"
    username = "admin"
    password = "admin@123"
    captcha = $true
} | ConvertTo-Json -Compress

Invoke-WebRequest -Uri "https://nlp-btl-dhhh-backend-mock.vercel.app/api/auth/login" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

## 3. Test bằng Browser Console

```javascript
// Login
fetch('https://nlp-btl-dhhh-backend-mock.vercel.app/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({
    selectAccount: 'admin',
    username: 'admin',
    password: 'admin@123',
    captcha: true
  })
})
.then(res => res.json())
.then(data => console.log('Success:', data))
.catch(err => console.error('Error:', err));
```

## 4. Kiểm tra Logs trên Vercel

1. Vào [Vercel Dashboard](https://vercel.com)
2. Chọn project `nlp-btl-dhhh-backend-mock`
3. Vào tab **Logs**
4. Filter theo route `/api/auth/login`
5. Xem logs để debug:
   - Nếu thấy `[API Route] Request:` → Route đã được gọi
   - Nếu thấy `[API Route] Matched route:` → Route matching hoạt động
   - Nếu thấy `[API Route] No handler found` → Kiểm tra handlers

## 5. Troubleshooting

### Lỗi 404 Not Found
- **Nguyên nhân**: Route không được tạo đúng hoặc Vercel không route đến function
- **Giải pháp**: 
  1. Kiểm tra `.vercel/output/config.json` - route có đúng không
  2. Kiểm tra `.vercel/output/functions` - có function `__fallback` không
  3. Redeploy backend

### Lỗi CORS
- **Nguyên nhân**: CORS headers chưa được set đúng
- **Giải pháp**: 
  1. Kiểm tra `backend/vercel.json` - headers có đúng không
  2. Kiểm tra `backend/routes/api/[...].ts` - CORS headers có được set không

### Không thấy logs
- **Nguyên nhân**: Request không đến được function handler
- **Giải pháp**: 
  1. Kiểm tra Vercel routing config
  2. Kiểm tra function có được deploy đúng không

