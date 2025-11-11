# @vben/backend-mock

## Description

ChatBot-NLP-VMU Admin 数据 mock 服务，使用 MongoDB 作为数据库存储。该服务不需要手动启动，已经集成在 vite 插件内，随应用一起启用。

## MongoDB Setup

### 1. 安装 MongoDB

确保 MongoDB 已安装并运行。默认连接地址: `mongodb://localhost:27017`

### 2. 环境变量 (可选)

可以通过环境变量配置 MongoDB:

```bash
MONGODB_URI=mongodb://localhost:27017
DB_NAME=chatbot-nlp-vmu
```

### 3. 默认账户

系统会自动创建以下默认账户:

- **Admin**: 
  - Username: `admin`
  - Password: `admin@123`
  - Roles: `super`, `admin`

- **User**: 
  - Username: `user`
  - Password: `user@123`
  - Roles: `user`

## Running the app

```bash
# development
$ pnpm run start

# production mode
$ pnpm run build
```

## API Endpoints

- `GET /api/system/user/list` - 获取用户列表
- `POST /api/system/user` - 创建用户
- `PUT /api/system/user/:id` - 更新用户
- `DELETE /api/system/user/:id` - 删除用户
- `POST /api/auth/login` - 用户登录
