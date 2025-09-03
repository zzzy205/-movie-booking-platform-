# 电影预订平台 - 架构设计文档

## 系统概述
电影预订平台是一个轻量级的内部网络应用，支持用户选座预订、管理员场次管理等功能。

## 技术架构

### 前端架构 (React + TypeScript)
```
src/
├── components/          # 可复用组件
│   ├── Layout/         # 布局组件
│   ├── SeatGrid/       # 座位网格组件
│   ├── MovieList/      # 电影列表组件
│   └── BookingForm/    # 预订表单组件
├── pages/              # 页面组件
│   ├── Login/          # 登录页面
│   ├── Dashboard/      # 主界面
│   ├── Admin/          # 管理后台
│   └── Profile/        # 用户信息
├── utils/              # 工具函数
├── types/              # TypeScript类型定义
└── services/           # API服务
```

### 后端架构 (Node.js + Express)
```
src/
├── routes/             # 路由定义
│   ├── auth.js        # 认证相关
│   ├── movies.js      # 电影场次
│   ├── bookings.js    # 预订管理
│   └── admin.js       # 管理功能
├── middleware/         # 中间件
│   ├── auth.js        # JWT验证
│   ├── admin.js       # 管理员权限
│   └── validation.js  # 数据验证
├── models/             # 数据模型
├── services/           # 业务逻辑
└── utils/              # 工具函数
```

### 数据库设计 (SQLite)
```sql
-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(6) UNIQUE NOT NULL,  -- 6位数字
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 电影场次表
CREATE TABLE movie_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    duration INTEGER NOT NULL,  -- 时长(分钟)
    booking_open_time DATETIME NOT NULL,  -- 预约开放时间
    max_seats INTEGER DEFAULT 100,
    status ENUM('active', 'cancelled') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 座位预订表
CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    seat_row INTEGER NOT NULL,  -- 行号(1-10)
    seat_col INTEGER NOT NULL,  -- 列号(1-10)
    status ENUM('active', 'cancelled') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES movie_sessions(id)
);

-- 公告表
CREATE TABLE announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 系统日志表
CREATE TABLE system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 核心业务流程

### 1. 用户预订流程
```
用户登录 → 选择电影场次 → 查看座位状态 → 选择座位 → 确认预订 → 生成凭证
```

### 2. 座位管理流程
```
实时座位状态 → 预订成功更新 → WebSocket广播 → 前端状态同步
```

### 3. 管理员操作流程
```
管理员登录 → 管理场次 → 设置预约时间 → 发布公告 → 查看预订情况
```

## 性能优化策略

### 1. 前端优化
- 座位状态缓存
- 防抖处理用户操作
- 虚拟滚动（场次列表）
- 组件懒加载

### 2. 后端优化
- 数据库连接池
- 查询结果缓存
- 定时清理过期数据
- 异步处理非关键操作

### 3. 实时性保证
- WebSocket连接管理
- 心跳检测
- 断线重连机制
- 消息队列

## 安全考虑

### 1. 认证授权
- JWT令牌验证
- 角色权限控制
- 会话管理

### 2. 数据安全
- SQL注入防护
- XSS防护
- 输入验证
- 敏感信息加密

## 部署架构

### 开发环境
```
Docker Compose
├── Frontend (React Dev Server)
├── Backend (Node.js + Express)
├── Nginx (反向代理)
└── Redis (缓存)
```

### 生产环境
```
单机部署
├── Nginx (80端口)
├── Frontend (静态文件)
├── Backend (API服务)
└── SQLite (数据存储)
```

## 监控和维护

### 1. 日志管理
- 访问日志
- 错误日志
- 业务日志
- 7天自动清理

### 2. 健康检查
- 服务状态监控
- 数据库连接检查
- 磁盘空间监控

### 3. 备份策略
- 数据库定期备份
- 配置文件备份
- 日志文件归档
