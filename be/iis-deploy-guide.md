# Hướng dẫn triển khai Backend lên IIS

## Yêu cầu
- Windows Server với IIS đã cài đặt
- Node.js đã được cài đặt trên server
- IISNode module (https://github.com/Azure/iisnode/releases)
- URL Rewrite Module (https://www.iis.net/downloads/microsoft/url-rewrite)
- .NET Core Hosting Bundle (nếu sử dụng chức năng WebSocket)


```bash
# Clone repository về máy phát triển
git clone <your-repo-url>

# Di chuyển vào thư mục backend
cd be

# Cài đặt dependencies và optimizing cho production
npm run deploy:iis
```

## Bước 2: Copy code lên server IIS
- Copy toàn bộ thư mục backend lên server IIS (có thể đóng gói thành ZIP rồi giải nén)
- Đảm bảo đã copy file `web.config` vào thư mục gốc

## Bước 3: Tạo ứng dụng trên IIS
1. Mở IIS Manager
2. Tạo một Website mới hoặc Application trong một Website có sẵn
3. Thiết lập Physical Path đến thư mục chứa code backend
4. Thiết lập Application Pool:
   - Chọn "No Managed Code"
   - Thiết lập Identity có quyền truy cập thư mục ứng dụng

## Bước 4: Cấu hình biến môi trường
1. Tạo file `.env` trong thư mục gốc chứa các biến môi trường cần thiết
2. HOẶC thiết lập biến môi trường trong Application Pool > Advanced Settings > Environment Variables

## Bước 5: Kiểm tra quyền truy cập
- Đảm bảo user chạy Application Pool có quyền đọc/ghi trên thư mục ứng dụng
- Đảm bảo IIS_IUSRS có quyền thực thi Node.js

## Bước 6: Kiểm tra logs
- Logs được tạo trong thư mục `iisnode` theo cấu hình trong `web.config`
- Kiểm tra Event Viewer nếu có lỗi khởi động

## Xử lý sự cố:
1. **Lỗi 500.19**: Thiếu quyền truy cập hoặc module không được cài đặt
2. **Lỗi 502.5**: Node.js không thể khởi động, kiểm tra logs
3. **Không tìm thấy .env**: Nếu sử dụng dotenv, kiểm tra đường dẫn tương đối

## Tối ưu hóa:
- Thiết lập Node.js concurrency trong web.config
- Cấu hình số lượng workers trong Application Pool 