# 项目结构说明

## 目录结构概览
```
movie-booking-platform/
├── 📁 frontend/                 # React前端应用
│   ├── 📁 public/              # 静态资源
│   └── 📁 src/                 # 源代码
│       ├── 📁 components/      # 可复用组件
│       ├── 📁 pages/           # 页面组件
│       ├── 📁 types/           # TypeScript类型定义
│       └── 📁 utils/           # 工具函数
├── 📁 backend/                  # Node.js后端API
│   ├── 📁 config/              # 配置文件
│   ├── 📁 middleware/          # 中间件
│   ├── 📁 models/              # 数据模型
│   ├── 📁 routes/              # 路由定义
│   └── 📁 src/                 # 源代码
├── 📁 nginx/                    # Nginx配置
│   └── 📁 conf/                # 配置文件
├── 📁 docker/                   # Docker相关文件
│   ├── 📁 frontend/            # 前端Dockerfile
│   └── 📁 backend/             # 后端Dockerfile
├── 📁 scripts/                  # 部署脚本
├── 📁 docs/                     # 项目文档
│   ├── ARCHITECTURE.md         # 架构设计
│   └── PROJECT_STRUCTURE.md    # 本文档
├── 📁 data/                     # 数据存储目录（运行时创建）
├── 📄 docker-compose.yml       # 开发环境配置
├── 📄 docker-compose.prod.yml  # 生产环境配置
├── 📄 env.example              # 环境变量示例
├── 📄 README.md                # 项目说明
└── 📄 DEPLOYMENT_STRATEGY.md   # 部署策略
```

## 各目录详细说明

### 前端 (frontend/)
- **public/**: 静态资源文件，如favicon、index.html等
- **src/components/**: 可复用的UI组件
  - Layout/: 布局相关组件
  - SeatGrid/: 座位网格组件
  - MovieList/: 电影列表组件
  - BookingForm/: 预订表单组件
- **src/pages/**: 页面级组件
  - Login/: 登录页面
  - Dashboard/: 主界面
  - Admin/: 管理后台
  - Profile/: 用户信息页面
- **src/types/**: TypeScript类型定义
- **src/utils/**: 工具函数和辅助方法

### 后端 (backend/)
- **config/**: 配置文件，如数据库连接、环境变量等
- **middleware/**: Express中间件
  - auth.js: JWT认证中间件
  - admin.js: 管理员权限验证
  - validation.js: 数据验证
- **models/**: 数据模型定义
- **routes/**: API路由定义
  - auth.js: 认证相关路由
  - movies.js: 电影场次管理
  - bookings.js: 预订管理
  - admin.js: 管理功能
- **src/**: 核心业务逻辑代码

### 配置和部署
- **nginx/**: Nginx反向代理配置
- **docker/**: Docker镜像构建文件
- **scripts/**: 自动化部署脚本
- **docs/**: 项目文档和说明

## 文件说明

### 配置文件
- **docker-compose.yml**: 开发环境Docker配置
- **docker-compose.prod.yml**: 生产环境Docker配置
- **env.example**: 环境变量配置示例

### 文档文件
- **README.md**: 项目概述和快速开始指南
- **DEPLOYMENT_STRATEGY.md**: 部署策略和流程说明
- **ARCHITECTURE.md**: 系统架构设计文档

## 开发工作流

### 1. 本地开发
```bash
# 启动开发环境
docker-compose up -d --build

# 访问应用
# 前端: http://localhost:3000
# 后端: http://localhost:8000
```

### 2. 代码结构
- 前端组件化开发，便于维护和复用
- 后端模块化设计，职责分离清晰
- 统一的类型定义，提高代码质量

### 3. 部署流程
- 开发环境：Docker Compose + 热重载
- 生产环境：优化后的Docker镜像 + Nginx

## 注意事项

1. **数据目录**: `data/` 目录会在运行时自动创建，用于存储SQLite数据库文件
2. **环境变量**: 复制 `env.example` 为 `.env` 并根据实际环境修改
3. **端口配置**: 默认前端3000端口，后端8000端口，Nginx 80端口
4. **数据库**: 使用SQLite，数据文件存储在 `data/` 目录中

## 下一步计划

- [ ] 创建前端基础组件
- [ ] 搭建后端API框架
- [ ] 配置数据库模型
- [ ] 实现用户认证系统
- [ ] 开发座位预订功能
- [ ] 创建管理后台
- [ ] 配置Nginx反向代理
- [ ] 编写部署脚本
