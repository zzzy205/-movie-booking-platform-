# 电影预订平台 (Movie Booking Platform)

## 项目概述
一个轻量级的内部网络电影预订系统，支持用户选座预订、管理员场次管理等功能。

## 技术架构
- **前端**: React + TypeScript + Ant Design
- **后端**: Node.js + Express + SQLite
- **数据库**: SQLite
- **实时通信**: WebSocket
- **部署**: Docker + Docker Compose

## 核心功能
- 用户登录（6位数字账号）
- 电影场次浏览和预订
- 座位选择（10×10网格，每用户每场最多4个）
- 实时座位状态更新
- 管理员场次和公告管理
- 批量用户导入/导出

## 快速开始

### 开发环境
```bash
# 克隆项目
git clone [repository-url]
cd movie-booking-platform

# 启动开发环境
docker-compose up -d --build

# 访问应用
# 前端: http://localhost:3000
# 后端: http://localhost:8000
```

### 生产部署
```bash
# 生产环境部署
docker-compose -f docker-compose.prod.yml up -d --build
```

## 项目结构
```
movie-booking-platform/
├── frontend/                 # React前端应用
├── backend/                  # Node.js后端API
├── nginx/                    # Nginx配置
├── docker/                   # Docker相关文件
├── scripts/                  # 部署脚本
├── docs/                     # 项目文档
├── docker-compose.yml        # 开发环境
├── docker-compose.prod.yml   # 生产环境
└── .env.example             # 环境变量示例
```

## 环境要求
- Docker & Docker Compose
- Node.js 18+
- 4核CPU服务器
- 支持100并发用户

## 许可证
内部使用项目
