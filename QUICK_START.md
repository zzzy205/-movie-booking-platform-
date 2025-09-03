# 🚀 快速启动指南

## 环境要求
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ 内存
- 2GB+ 磁盘空间

## 🎯 一键启动

### 1. 克隆项目
```bash
git clone [your-repository-url]
cd movie-booking-platform
```

### 2. 配置环境变量
```bash
# 复制环境变量文件
cp env.example .env

# 编辑环境变量（可选）
nano .env
```

### 3. 启动服务
```bash
# 使用部署脚本（推荐）
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# 或者手动启动
docker-compose up -d --build
```

### 4. 访问应用
- **前端界面**: http://localhost:3001
- **后端API**: http://localhost:8001  
- **Nginx代理**: http://localhost:8081

## 🔧 端口配置

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|----------|----------|------|
| 前端 | 3000 | 3001 | React开发服务器 |
| 后端 | 8000 | 8001 | Node.js API服务 |
| Nginx | 80 | 8081 | 反向代理服务器 |

## 📋 默认账户

### 管理员账户
- 用户名: `123456`
- 密码: `123456`
- 角色: 管理员

### 普通用户
- 用户名: `654321`
- 密码: `123456`
- 角色: 普通用户

## 🛠️ 常用命令

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs frontend
docker-compose logs backend
docker-compose logs nginx
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
```

### 停止服务
```bash
docker-compose down
```

### 更新代码后重新部署
```bash
./scripts/deploy.sh --clean
```

## 🔍 故障排除

### 1. 端口被占用
```bash
# 查看端口占用
netstat -tulpn | grep :3001
netstat -tulpn | grep :8001
netstat -tulpn | grep :8081

# 修改docker-compose.yml中的端口映射
```

### 2. 服务启动失败
```bash
# 查看详细日志
docker-compose logs

# 检查容器状态
docker-compose ps -a

# 重新构建
docker-compose down
docker-compose up -d --build
```

### 3. 数据库问题
```bash
# 检查数据库文件
ls -la data/

# 重新初始化数据库
rm -f data/movie_booking.db
docker-compose restart backend
```

## 📱 功能测试

### 1. 用户登录
- 访问 http://localhost:3001
- 使用默认账户登录

### 2. 创建电影场次
- 管理员登录后进入管理后台
- 添加新的电影场次

### 3. 预订座位
- 普通用户登录
- 选择电影场次
- 选择座位并确认预订

## 🌐 生产部署

### 1. 修改端口配置
编辑 `docker-compose.prod.yml` 中的端口映射

### 2. 设置环境变量
```bash
# 生产环境
export JWT_SECRET=your-production-secret
export NODE_ENV=production
```

### 3. 启动生产服务
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## 📞 技术支持

如遇到问题，请检查：
1. Docker服务是否正常运行
2. 端口是否被占用
3. 环境变量是否正确配置
4. 网络连接是否正常

## 📝 更新日志

- v1.0.0: 初始版本，包含基础功能
- 支持用户登录、电影管理、座位预订
- 支持管理员后台、用户管理
- 支持WebSocket实时通信
