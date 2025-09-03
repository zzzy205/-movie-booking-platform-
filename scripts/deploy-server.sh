#!/bin/bash

# 电影预订平台服务器部署脚本
# 使用方法: ./scripts/deploy-server.sh [server_ip] [domain]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${RED}错误: 请提供服务器IP地址${NC}"
    echo "使用方法: $0 <server_ip> [domain]"
    echo "示例: $0 192.168.1.100"
    echo "示例: $0 192.168.1.100 example.com"
    exit 1
fi

SERVER_IP=$1
DOMAIN=${2:-""}

echo -e "${BLUE}🚀 开始部署电影预订平台到服务器: ${SERVER_IP}${NC}"
echo -e "${YELLOW}域名: ${DOMAIN:-'未设置'}${NC}"
echo ""

# 1. 创建生产环境配置文件
echo -e "${BLUE}📝 创建生产环境配置文件...${NC}"
cat > .env.production << EOF
# 生产环境配置
NODE_ENV=production
PORT=8000

# 数据库配置
DB_PATH=./data/movie_booking.db

# JWT配置 - 请修改为强密码
JWT_SECRET=your-production-secret-key-$(openssl rand -hex 32)

# CORS配置
CORS_ORIGIN=http://${SERVER_IP}:3000

# 前端配置
REACT_APP_API_URL=http://${SERVER_IP}:8000
REACT_APP_WS_URL=ws://${SERVER_IP}:8000

# 服务器配置
SERVER_IP=${SERVER_IP}
DOMAIN=${DOMAIN}
EOF

echo -e "${GREEN}✅ 生产环境配置文件创建完成${NC}"

# 2. 创建docker-compose生产环境文件
echo -e "${BLUE}🐳 创建Docker生产环境配置...${NC}"
cat > docker-compose.server.yml << EOF
version: '3.8'

services:
  # 前端服务
  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend/Dockerfile.prod
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=http://${SERVER_IP}:8000
      - REACT_APP_WS_URL=ws://${SERVER_IP}:8000
    networks:
      - movie-network

  # 后端服务
  backend:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile.prod
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=8000
      - DB_PATH=/app/data/movie_booking.db
      - JWT_SECRET=\${JWT_SECRET}
      - CORS_ORIGIN=http://${SERVER_IP}:3000
    networks:
      - movie-network

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf/nginx.server.conf:/etc/nginx/nginx.conf
      - ./nginx/conf/default.server.conf:/etc/nginx/conf.d/default.conf
    networks:
      - movie-network

networks:
  movie-network:
    driver: bridge
EOF

echo -e "${GREEN}✅ Docker生产环境配置创建完成${NC}"

# 3. 创建Nginx服务器配置
echo -e "${BLUE}🌐 创建Nginx服务器配置...${NC}"

# 创建nginx.server.conf
cat > nginx/conf/nginx.server.conf << EOF
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    include /etc/nginx/conf.d/*.conf;
}
EOF

# 创建default.server.conf
cat > nginx/conf/default.server.conf << EOF
upstream frontend_backend {
    server frontend:3000;
}

upstream backend_api {
    server backend:8000;
}

server {
    listen 80;
    server_name ${SERVER_IP} ${DOMAIN};
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # 前端静态文件
    location / {
        proxy_pass http://frontend_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 处理React路由
        try_files \$uri \$uri/ /index.html;
    }

    # 后端API
    location /api/ {
        proxy_pass http://backend_api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket支持
    location /socket.io/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # 错误页面
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

echo -e "${GREEN}✅ Nginx服务器配置创建完成${NC}"

# 4. 创建部署说明文档
echo -e "${BLUE}📚 创建部署说明文档...${NC}"
cat > DEPLOYMENT_SERVER.md << EOF
# 🚀 服务器部署说明

## 📋 部署前准备

1. **服务器要求**:
   - Ubuntu 22.04 LTS 或 CentOS 8+
   - Docker 20.10+
   - Docker Compose 2.0+
   - 至少 2GB RAM, 10GB 磁盘空间

2. **网络配置**:
   - 服务器IP: ${SERVER_IP}
   - 域名: ${DOMAIN:-'未设置'}
   - 开放端口: 80, 3000, 8000

## 🔧 部署步骤

### 1. 上传项目文件
\`\`\`bash
# 在本地执行
scp -r . user@${SERVER_IP}:/home/user/movie-booking-platform
\`\`\`

### 2. 登录服务器
\`\`\`bash
ssh user@${SERVER_IP}
cd /home/user/movie-booking-platform
\`\`\`

### 3. 安装Docker (如果未安装)
\`\`\`bash
# Ubuntu
sudo apt update
sudo apt install docker.io docker-compose

# CentOS
sudo yum install docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
\`\`\`

### 4. 配置环境变量
\`\`\`bash
# 编辑生产环境配置
nano .env.production

# 修改JWT_SECRET为强密码
# 确认其他配置正确
\`\`\`

### 5. 构建和启动服务
\`\`\`bash
# 构建镜像
docker-compose -f docker-compose.server.yml build

# 启动服务
docker-compose -f docker-compose.server.yml up -d

# 查看服务状态
docker-compose -f docker-compose.server.yml ps
\`\`\`

### 6. 验证部署
\`\`\`bash
# 检查服务状态
curl http://${SERVER_IP}/health

# 检查前端
curl http://${SERVER_IP}

# 检查后端API
curl http://${SERVER_IP}/api/
\`\`\`

## 🌐 访问地址

- **前端应用**: http://${SERVER_IP}:3000
- **后端API**: http://${SERVER_IP}:8000
- **Nginx代理**: http://${SERVER_IP}

## 🔒 安全配置

1. **修改默认密码**:
   - 管理员账号: admin/123456
   - 普通用户: user/123456

2. **防火墙配置**:
   \`\`\`bash
   # 只开放必要端口
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS (如果配置SSL)
   sudo ufw enable
   \`\`\`

3. **SSL证书配置** (可选):
   \`\`\`bash
   # 使用Let's Encrypt
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d ${DOMAIN}
   \`\`\`

## 📊 监控和维护

1. **查看日志**:
   \`\`\`bash
   # 查看所有服务日志
   docker-compose -f docker-compose.server.yml logs -f

   # 查看特定服务日志
   docker-compose -f docker-compose.server.yml logs -f backend
   \`\`\`

2. **备份数据**:
   \`\`\`bash
   # 备份数据库
   cp -r data/ data_backup_\$(date +%Y%m%d_%H%M%S)/
   \`\`\`

3. **更新服务**:
   \`\`\`bash
   # 拉取最新代码
   git pull origin main

   # 重新构建和部署
   docker-compose -f docker-compose.server.yml down
   docker-compose -f docker-compose.server.yml build
   docker-compose -f docker-compose.server.yml up -d
   \`\`\`

## 🚨 故障排除

1. **服务无法启动**:
   - 检查端口是否被占用: \`netstat -tlnp\`
   - 检查Docker状态: \`docker ps -a\`
   - 查看错误日志: \`docker-compose logs\`

2. **无法访问应用**:
   - 检查防火墙设置
   - 确认服务正在运行
   - 检查网络配置

3. **数据库问题**:
   - 检查数据目录权限
   - 确认磁盘空间充足

## 📞 技术支持

如果遇到问题，请提供:
- 错误日志
- 服务器环境信息
- 部署步骤记录
EOF

echo -e "${GREEN}✅ 部署说明文档创建完成${NC}"

# 5. 创建快速部署脚本
echo -e "${BLUE}⚡ 创建快速部署脚本...${NC}"
cat > scripts/quick-deploy.sh << EOF
#!/bin/bash

# 快速部署脚本
set -e

echo "🚀 快速部署电影预订平台..."

# 检查环境变量文件
if [ ! -f .env.production ]; then
    echo "❌ 未找到 .env.production 文件，请先运行 ./scripts/deploy-server.sh"
    exit 1
fi

# 加载环境变量
export \$(cat .env.production | xargs)

# 停止现有服务
echo "🛑 停止现有服务..."
docker-compose -f docker-compose.server.yml down

# 构建镜像
echo "🔨 构建Docker镜像..."
docker-compose -f docker-compose.server.yml build

# 启动服务
echo "🚀 启动服务..."
docker-compose -f docker-compose.server.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose -f docker-compose.server.yml ps

echo "✅ 部署完成！"
echo "🌐 前端地址: http://\${SERVER_IP}:3000"
echo "🔌 后端API: http://\${SERVER_IP}:8000"
echo "🌍 Nginx代理: http://\${SERVER_IP}"
EOF

chmod +x scripts/quick-deploy.sh

echo -e "${GREEN}✅ 快速部署脚本创建完成${NC}"

echo ""
echo -e "${GREEN}🎉 所有配置文件创建完成！${NC}"
echo ""
echo -e "${BLUE}📋 下一步操作:${NC}"
echo "1. 检查并修改 .env.production 中的配置"
echo "2. 将项目文件上传到服务器"
echo "3. 在服务器上运行部署脚本"
echo ""
echo -e "${YELLOW}📚 详细部署说明请查看: DEPLOYMENT_SERVER.md${NC}"
echo -e "${YELLOW}⚡ 快速部署脚本: scripts/quick-deploy.sh${NC}"
