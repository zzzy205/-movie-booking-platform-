# 🚀 电影预订平台服务器部署和更新指南

## 📋 服务器信息

### 服务器连接信息
- **IP地址**: 192.168.22.120
- **用户名**: movieadmin
- **密码**: Admin1234!
- **SSH端口**: 22

### 项目位置
- **项目目录**: `/home/movieadmin/`
- **Docker Compose文件**: `/home/movieadmin/docker-compose.server.yml`
- **数据目录**: `/home/movieadmin/data/`
- **Nginx配置**: `/home/movieadmin/nginx/conf/`

## 🔧 初始部署流程

### 1. 准备Docker镜像
```bash
# 在WSL本地构建镜像
docker-compose build

# 给镜像打标签
docker tag movie-booking-platform-frontend:latest movie-booking-platform-frontend:v2
docker tag movie-booking-platform-backend:latest movie-booking-platform-backend:v2

# 保存镜像为tar文件
docker save movie-booking-platform-frontend:v2 -o frontend-v2.tar
docker save movie-booking-platform-backend:v2 -o backend-v2.tar
```

### 2. 传输文件到服务器
```bash
# 传输Docker镜像
scp frontend-v2.tar backend-v2.tar movieadmin@192.168.22.120:/home/movieadmin/

# 传输项目配置文件
scp docker-compose.server.yml movieadmin@192.168.22.120:/home/movieadmin/

# 传输Nginx配置
scp -r nginx/ movieadmin@192.168.22.120:/home/movieadmin/

# 传输用户数据（可选）
scp -r data/ movieadmin@192.168.22.120:/home/movieadmin/
```

### 3. 在服务器上部署
```bash
# 登录服务器
ssh movieadmin@192.168.22.120

# 加载Docker镜像
docker load -i frontend-v2.tar
docker load -i backend-v2.tar

# 启动服务
docker-compose -f docker-compose.server.yml up -d

# 检查服务状态
docker-compose -f docker-compose.server.yml ps
```

## 🔄 更新流程

### 1. 本地开发更新
```bash
# 在WSL中修改代码
# 测试功能正常

# 重新构建镜像
docker-compose build

# 给新镜像打标签（版本号递增）
docker tag movie-booking-platform-frontend:latest movie-booking-platform-frontend:v3
docker tag movie-booking-platform-backend:latest movie-booking-platform-backend:v3

# 保存新镜像
docker save movie-booking-platform-frontend:v3 -o frontend-v3.tar
docker save movie-booking-platform-backend:v3 -o backend-v3.tar
```

### 2. 传输更新到服务器
```bash
# 传输新镜像
scp frontend-v3.tar backend-v3.tar movieadmin@192.168.22.120:/home/movieadmin/

# 传输更新的配置文件（如果有修改）
scp docker-compose.server.yml movieadmin@192.168.22.120:/home/movieadmin/
```

### 3. 在服务器上更新
```bash
# 登录服务器
ssh movieadmin@192.168.22.120

# 停止现有服务
docker-compose -f docker-compose.server.yml down

# 加载新镜像
docker load -i frontend-v3.tar
docker load -i backend-v3.tar

# 更新docker-compose.server.yml中的镜像标签
# 修改image: movie-booking-platform-frontend:v3
# 修改image: movie-booking-platform-backend:v3

# 启动新服务
docker-compose -f docker-compose.server.yml up -d

# 检查服务状态
docker-compose -f docker-compose.server.yml ps
```

### 4. 清理旧镜像
```bash
# 删除旧镜像
docker rmi movie-booking-platform-frontend:v2
docker rmi movie-booking-platform-backend:v2

# 删除旧tar文件
rm frontend-v2.tar backend-v2.tar

# 清理未使用的资源
docker system prune -f
```

## 🌐 服务配置

### 端口配置
- **前端**: 3001:3000
- **后端**: 8001:8000
- **Nginx**: 8081:80

### 环境变量
- **前端API**: http://192.168.22.120:8001
- **前端WebSocket**: ws://192.168.22.120:8001
- **CORS**: http://192.168.22.120:3001

### 访问地址
- **前端应用**: http://192.168.22.120:3001
- **后端API**: http://192.168.22.120:8001
- **Nginx代理**: http://192.168.22.120:8081

## 🛠️ 常用命令

### 服务管理
```bash
# 启动服务
docker-compose -f docker-compose.server.yml up -d

# 停止服务
docker-compose -f docker-compose.server.yml down

# 查看服务状态
docker-compose -f docker-compose.server.yml ps

# 查看日志
docker-compose -f docker-compose.server.yml logs -f
docker-compose -f docker-compose.server.yml logs backend
docker-compose -f docker-compose.server.yml logs frontend
```

### 镜像管理
```bash
# 查看镜像
docker images | grep movie-booking-platform

# 删除镜像
docker rmi <image_id>

# 清理资源
docker system prune -f
```

### 文件传输
```bash
# 传输单个文件
scp filename movieadmin@192.168.22.120:/home/movieadmin/

# 传输目录
scp -r directory/ movieadmin@192.168.22.120:/home/movieadmin/

# 传输tar文件
scp *.tar movieadmin@192.168.22.120:/home/movieadmin/
```

## 🚨 故障排除

### 常见问题
1. **端口被占用**: 检查端口是否被其他服务占用
2. **镜像加载失败**: 确保tar文件完整传输
3. **服务启动失败**: 检查docker-compose配置和日志
4. **网络连接问题**: 检查防火墙和网络配置

### 日志查看
```bash
# 查看所有服务日志
docker-compose -f docker-compose.server.yml logs

# 查看特定服务日志
docker-compose -f docker-compose.server.yml logs backend
docker-compose -f docker-compose.server.yml logs frontend
docker-compose -f docker-compose.server.yml logs nginx
```

## 📝 注意事项

1. **版本管理**: 每次更新都要给镜像打新标签
2. **数据备份**: 更新前备份重要数据
3. **测试验证**: 更新后测试所有功能
4. **清理资源**: 及时清理旧镜像和文件
5. **网络配置**: 确保服务器IP和端口配置正确

## 🔗 相关文件

- `docker-compose.server.yml` - 服务器Docker配置
- `nginx/conf/` - Nginx配置文件
- `data/` - 用户数据和数据库
- `scripts/deploy-server.sh` - 部署脚本

---

**最后更新**: 2025-08-27
**维护者**: movieadmin
**版本**: v2.0
