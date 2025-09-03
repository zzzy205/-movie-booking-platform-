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
export $(cat .env.production | xargs)

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
echo "🌐 前端地址: http://${SERVER_IP}:3000"
echo "🔌 后端API: http://${SERVER_IP}:8000"
echo "🌍 Nginx代理: http://${SERVER_IP}"
