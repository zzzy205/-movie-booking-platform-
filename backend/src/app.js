const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

// 环境变量
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:3001", "http://localhost:8001"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'", "ws://localhost:8001"],
    },
  },
}));
app.use(compression());
app.use(morgan('combined'));

// 修复CORS配置，使用环境变量
const allowedOrigins = [
  'http://localhost:3001',
  process.env.CORS_ORIGIN
].filter(Boolean); // 过滤掉undefined值

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求（比如同源请求）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 限流配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 提高限制：每个IP 15分钟内最多1000个请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 跳过健康检查和静态资源的限流
  skip: (req) => {
    return req.path === '/health' || req.path.startsWith('/static');
  }
});

// 为认证相关接口设置更宽松的限流
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 200, // 认证接口：每个IP 15分钟内最多200个请求
  message: {
    success: false,
    message: '登录尝试过于频繁，请稍后再试'
  }
});

app.use(limiter);
app.use('/auth', authLimiter); // 为认证路由应用专门的限流

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务 - 提供上传的图片访问
app.use('/static/images', (req, res, next) => {
  // 设置CORS头
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
}, express.static(path.join(__dirname, '../uploads/images')));

// 健康检查
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// 导入路由
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const announcementRoutes = require('./routes/announcements');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');
const systemRoutes = require('./routes/system');
const waitlistRoutes = require('./routes/waitlist');
const imageRoutes = require('./routes/images');

// 注册路由
app.use('/auth', authRoutes);
app.use('/movies', movieRoutes.router);
app.use('/announcements', announcementRoutes);
app.use('/bookings', bookingRoutes);
app.use('/users', userRoutes);
app.use('/system', systemRoutes);
app.use('/waitlist', waitlistRoutes);
app.use('/images', imageRoutes);

// 基础路由
app.get('/', (req, res) => {
  res.json({
    message: '电影预订平台后端API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
  
  // 加入房间（电影场次）
  socket.on('join_session', (sessionId) => {
    socket.join(`session_${sessionId}`);
    console.log(`用户 ${socket.id} 加入场次 ${sessionId}`);
  });
  
  // 离开房间
  socket.on('leave_session', (sessionId) => {
    socket.leave(`session_${sessionId}`);
    console.log(`用户 ${socket.id} 离开场次 ${sessionId}`);
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: NODE_ENV === 'development' ? err.message : '未知错误'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`🚀 服务器启动成功！`);
  console.log(`📍 端口: ${PORT}`);
  console.log(`🌍 环境: ${NODE_ENV}`);
  console.log(`⏰ 时间: ${new Date().toISOString()}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

module.exports = { app, io };
