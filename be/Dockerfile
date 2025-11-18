FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# Install dependencies including development tools
RUN npm ci

COPY . .

EXPOSE 3001

# Sử dụng nodemon để tự động khởi động lại khi có thay đổi
CMD ["npm", "run", "start"] 