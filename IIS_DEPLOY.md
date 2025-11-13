# Hướng dẫn Deploy lên IIS

## Yêu cầu

1. **IIS đã được cài đặt** trên Windows Server hoặc Windows 10/11
2. **URL Rewrite Module** - Tải về từ: https://www.iis.net/downloads/microsoft/url-rewrite
3. **Application Request Routing (ARR)** - Nếu cần reverse proxy (tùy chọn)

## Các bước triển khai

### 1. Build ứng dụng cho IIS

Từ thư mục gốc của dự án, chạy:

```bash
pnpm build:iis
```

Hoặc nếu bạn đã build rồi, chỉ cần copy file `web.config` vào thư mục `dist`:

```bash
copy playground\web.config playground\dist\web.config
```

### 2. Cài đặt URL Rewrite Module

1. Tải **URL Rewrite Module 2.1** từ: https://www.iis.net/downloads/microsoft/url-rewrite
2. Cài đặt module (yêu cầu quyền Administrator)
3. Khởi động lại IIS Manager

### 3. Tạo Website trên IIS

#### Cách 1: Sử dụng IIS Manager (GUI)

1. Mở **IIS Manager**
2. Click chuột phải vào **Sites** → **Add Website**
3. Điền thông tin:
   - **Site name**: `ChatBot-NLP-VMU` (hoặc tên bạn muốn)
   - **Application pool**: Chọn hoặc tạo mới (khuyến nghị: .NET v4.0 hoặc No Managed Code)
   - **Physical path**: Đường dẫn đến thư mục `playground\dist`
     - Ví dụ: `C:\inetpub\wwwroot\chatbot-nlp-vmu`
   - **Binding**:
     - **Type**: `http` hoặc `https`
     - **IP address**: `All Unassigned` hoặc IP cụ thể
     - **Port**: `80` (http) hoặc `443` (https)
     - **Host name**: Để trống hoặc nhập domain (ví dụ: `chatbot.example.com`)

4. Click **OK**

#### Cách 2: Sử dụng PowerShell (Quản trị viên)

```powershell
# Tạo thư mục nếu chưa có
New-Item -ItemType Directory -Path "C:\inetpub\wwwroot\chatbot-nlp-vmu" -Force

# Copy files từ dist vào thư mục IIS
Copy-Item -Path "C:\Users\Truong NCPT Vishipel\Documents\Vishipel\CODE\NLP-BTL-DHHH\playground\dist\*" -Destination "C:\inetpub\wwwroot\chatbot-nlp-vmu" -Recurse -Force

# Tạo Application Pool
New-WebAppPool -Name "ChatBotNLPAppPool"
Set-ItemProperty -Path "IIS:\AppPools\ChatBotNLPAppPool" -Name "managedRuntimeVersion" -Value ""

# Tạo Website
New-WebSite -Name "ChatBot-NLP-VMU" -Port 80 -PhysicalPath "C:\inetpub\wwwroot\chatbot-nlp-vmu" -ApplicationPool "ChatBotNLPAppPool"
```

### 4. Cấu hình Application Pool

1. Trong IIS Manager, chọn **Application Pools**
2. Chọn Application Pool của website vừa tạo
3. Click **Advanced Settings**
4. Đặt **Managed Pipeline Mode** = `Integrated` (khuyến nghị)
5. Đặt **Start Mode** = `AlwaysRunning` (tùy chọn, để tự động khởi động)

### 5. Kiểm tra quyền truy cập

1. Click chuột phải vào website → **Edit Permissions**
2. Tab **Security** → Đảm bảo **IIS_IUSRS** có quyền **Read & Execute**
3. Nếu thiếu, click **Edit** → **Add** → Nhập `IIS_IUSRS` → **Check Names** → **OK**
4. Chọn **IIS_IUSRS** → Check **Read & Execute** → **OK**

### 6. Kiểm tra web.config

Đảm bảo file `web.config` đã có trong thư mục `dist` với nội dung:
- URL Rewrite rules cho SPA routing
- MIME types cho các file JS/CSS
- Error handling

### 7. Test ứng dụng

1. Mở trình duyệt
2. Truy cập: `http://localhost` hoặc `http://your-server-ip`
3. Kiểm tra:
   - Trang chủ load được
   - Routing hoạt động (thử refresh trang khi ở route con)
   - API calls hoạt động (nếu có)

## Xử lý lỗi thường gặp

### Lỗi 404 khi refresh trang

**Nguyên nhân**: URL Rewrite Module chưa được cài đặt hoặc chưa hoạt động

**Giải pháp**:
1. Kiểm tra URL Rewrite Module đã cài: Trong IIS Manager → Server → Modules → Tìm "RewriteModule"
2. Nếu không có, cài đặt lại URL Rewrite Module
3. Kiểm tra file `web.config` có trong thư mục `dist`

### Lỗi 500 - Internal Server Error

**Nguyên nhân**: Cấu hình web.config sai hoặc thiếu quyền

**Giải pháp**:
1. Kiểm tra Event Viewer → Windows Logs → Application để xem lỗi chi tiết
2. Kiểm tra quyền truy cập thư mục (IIS_IUSRS cần quyền Read & Execute)
3. Kiểm tra Application Pool đang chạy

### File JS/CSS không load

**Nguyên nhân**: MIME types chưa được cấu hình

**Giải pháp**: File `web.config` đã có cấu hình MIME types, đảm bảo nó đã được copy vào `dist`

### CORS errors

**Nguyên nhân**: API backend và frontend ở domain/port khác nhau

**Giải pháp**: Uncomment dòng CORS trong `web.config` nếu cần, hoặc cấu hình CORS ở backend

## Cấu hình HTTPS (Tùy chọn)

1. Mua SSL certificate hoặc tạo Self-signed certificate
2. Trong IIS Manager → Chọn website → **Bindings**
3. Click **Add** → Chọn **https** → Port **443**
4. Chọn SSL certificate → **OK**

## Cấu hình Reverse Proxy cho API (Nếu cần)

Nếu backend API chạy trên port khác (ví dụ: 5320), bạn có thể cấu hình reverse proxy trong IIS:

1. Cài đặt **Application Request Routing (ARR)** và **URL Rewrite**
2. Thêm rule trong `web.config` để proxy `/api/*` đến backend server

## Tự động hóa Deployment

Bạn có thể tạo script PowerShell để tự động deploy:

```powershell
# deploy-iis.ps1
$sourcePath = "C:\path\to\playground\dist"
$destPath = "C:\inetpub\wwwroot\chatbot-nlp-vmu"

# Stop website (tùy chọn)
Stop-Website -Name "ChatBot-NLP-VMU"

# Copy files
Copy-Item -Path "$sourcePath\*" -Destination $destPath -Recurse -Force

# Start website
Start-Website -Name "ChatBot-NLP-VMU"

Write-Host "Deployment completed!"
```

## Lưu ý

- Đảm bảo đường dẫn không có khoảng trắng hoặc ký tự đặc biệt
- Nếu dùng domain, cấu hình DNS trỏ về IP server
- Kiểm tra firewall cho phép port 80/443
- Backup trước khi deploy lên production

