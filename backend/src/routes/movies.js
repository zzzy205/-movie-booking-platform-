const express = require('express');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// 数据文件路径
const MOVIES_FILE = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) + '/movies.json' : '/app/data/movies.json';

// 确保数据目录存在
const ensureDataDir = () => {
  const dir = path.dirname(MOVIES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 从文件加载电影数据
const loadMoviesFromFile = () => {
  try {
    if (fs.existsSync(MOVIES_FILE)) {
      const data = fs.readFileSync(MOVIES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载电影数据失败:', error);
  }
  
  // 如果文件不存在或读取失败，返回默认电影
  return [
    {
      id: 1,
      title: '示例电影',
      date: '2025-01-21',
      time: '03:00:00',
      duration: 120, // 分钟
      booking_open_time: '2025-01-21T02:00:00.000Z', // 预约开放时间
      max_seats: 120,
      status: 'active',
      created_at: new Date().toISOString()
    }
  ];
};

// 保存电影数据到文件
const saveMoviesToFile = (moviesData) => {
  try {
    ensureDataDir();
    fs.writeFileSync(MOVIES_FILE, JSON.stringify(moviesData, null, 2), 'utf8');
    console.log('电影数据已保存到文件');
  } catch (error) {
    console.error('保存电影数据失败:', error);
  }
};

// 全局ID计数器，确保ID永不重复
let nextSessionId = 1;

// 模拟电影场次数据库
let movieSessions = loadMoviesFromFile();

// 修复数据中的 null id
movieSessions = movieSessions.map((session, index) => {
  if (session.id === null || session.id === undefined) {
    console.log(`修复场次 ${session.title} 的 ID，从 null 改为 ${index + 1}`);
    return { ...session, id: index + 1 };
  }
  return session;
});

// 保存修复后的数据
if (movieSessions.some(s => s.id !== null && s.id !== undefined)) {
  try {
    fs.writeFileSync(MOVIES_FILE, JSON.stringify(movieSessions, null, 2), 'utf8');
    console.log('已保存修复后的电影数据');
  } catch (error) {
    console.error('保存修复后的电影数据失败:', error);
  }
}

// 初始化nextSessionId为当前最大ID + 1
const validIds = movieSessions.map(s => s.id).filter(id => id !== null && id !== undefined);
nextSessionId = validIds.length > 0 ? Math.max(...validIds) + 1 : 1;

// 检查是否可以预订（预约时间是否已到）
const canBookSession = (session) => {
  const now = new Date();
  const bookingOpenTime = new Date(session.booking_open_time);
  return now >= bookingOpenTime;
};

// 获取所有电影场次
router.get('/sessions', (req, res) => {
  try {
    // 为每个场次添加是否可以预订的状态和候补信息
    const sessionsWithBookingStatus = movieSessions.map(session => {
      // 获取该场次的预订座位数量
      const { getSessionBookings } = require('../models/bookings');
      const sessionBookings = getSessionBookings(session.id);
      const bookedSeatsCount = sessionBookings.length;
      
      // 获取候补人数
      const { getSessionWaitlistCount } = require('../models/waitlist');
      const waitlistCount = getSessionWaitlistCount(session.id);
      
      // 判断是否已满
      const isFull = bookedSeatsCount >= session.max_seats;
      
      return {
        ...session,
        canBook: canBookSession(session),
        currentTime: new Date().toISOString(),
        booked_seats_count: bookedSeatsCount,
        available_seats_count: Math.max(0, session.max_seats - bookedSeatsCount),
        waitlist_count: waitlistCount,
        is_full: isFull
      };
    });
    
    res.json({
      success: true,
      data: sessionsWithBookingStatus
    });
  } catch (error) {
    console.error('获取电影场次错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取单个场次
router.get('/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const session = movieSessions.find(s => s.id === parseInt(id));
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '电影场次不存在'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('获取电影场次错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 导出获取单个场次的函数，供其他路由使用
const getSessionById = (id) => {
  return movieSessions.find(s => s.id === parseInt(id));
};

// 创建电影场次验证规则
const createSessionValidation = [
  body('title').notEmpty().withMessage('电影标题不能为空'),
  body('date').notEmpty().withMessage('电影日期不能为空'),
  body('time').notEmpty().withMessage('电影时间不能为空'),
  body('duration').isInt({ min: 1 }).withMessage('电影时长必须是正整数'),
  body('booking_open_time').isISO8601().withMessage('预约开放时间格式不正确'),
  body('max_seats').isInt({ min: 1, max: 120 }).withMessage('座位数必须在1-120之间')
];

// 创建电影场次
router.post('/sessions', createSessionValidation, (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { title, date, time, duration, booking_open_time, max_seats } = req.body;

    // 检查时间逻辑
    const startTime = new Date(`${date}T${time}`);
    if (new Date(booking_open_time) >= startTime) {
      return res.status(400).json({
        success: false,
        message: '预约开放时间必须早于电影开始时间'
      });
    }

    // 创建新场次
    const newSession = {
      id: nextSessionId++, // 使用全局计数器生成ID
      title,
      date,
      time,
      duration,
      booking_open_time,
      max_seats,
      status: 'active',
      created_at: new Date().toISOString()
    };

    movieSessions.push(newSession);
    
    // 保存到文件
    saveMoviesToFile(movieSessions);

    res.status(201).json({
      success: true,
      message: '电影场次创建成功',
      data: newSession
    });

  } catch (error) {
    console.error('创建电影场次错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 更新电影场次验证规则
const updateSessionValidation = [
  body('title').optional().notEmpty().withMessage('电影标题不能为空'),
  body('date').optional().notEmpty().withMessage('电影日期不能为空'),
  body('time').optional().notEmpty().withMessage('电影时间不能为空'),
  body('duration').optional().isInt({ min: 1 }).withMessage('电影时长必须是正整数'),
  body('booking_open_time').optional().isISO8601().withMessage('预约开放时间格式不正确'),
  body('max_seats').optional().isInt({ min: 1, max: 120 }).withMessage('座位数必须在1-120之间')
];

// 更新电影场次
router.put('/sessions/:id', updateSessionValidation, (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const sessionIndex = movieSessions.findIndex(s => s.id === parseInt(id));
    
    if (sessionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '电影场次不存在'
      });
    }

    const { title, date, time, duration, booking_open_time, max_seats } = req.body;

    // 检查时间逻辑
    if (date && time && booking_open_time && new Date(`${date}T${time}`) <= new Date(booking_open_time)) {
      return res.status(400).json({
        success: false,
        message: '预约开放时间必须早于电影开始时间'
      });
    }

    // 更新场次信息
    const updatedSession = {
      ...movieSessions[sessionIndex],
      ...(title && { title }),
      ...(date && { date }),
      ...(time && { time }),
      ...(duration && { duration }),
      ...(booking_open_time && { booking_open_time }),
      ...(max_seats && { max_seats }),
      updated_at: new Date().toISOString()
    };

    movieSessions[sessionIndex] = updatedSession;
    
    // 保存到文件
    saveMoviesToFile(movieSessions);

    res.json({
      success: true,
      message: '电影场次更新成功',
      data: updatedSession
    });

  } catch (error) {
    console.error('更新电影场次错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 删除电影场次
router.delete('/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sessionIndex = movieSessions.findIndex(s => s.id === parseInt(id));
    
    if (sessionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '电影场次不存在'
      });
    }

    const sessionToDelete = movieSessions[sessionIndex];
    
    // 级联删除：清理所有相关预订数据
    let totalBookingsCleared = 0;
    
    // 调用预订清理函数，清理该场次的所有预订数据
    const { clearSessionBookings } = require('../models/bookings');
    totalBookingsCleared = clearSessionBookings(id);
    
    // 清理该场次的所有投票数据
    let totalWaitlistCleared = 0;
    const { clearSessionWaitlist } = require('../models/waitlist');
    totalWaitlistCleared = clearSessionWaitlist(id);
    
    // 删除场次
    const deletedSession = movieSessions.splice(sessionIndex, 1)[0];
    
    // 保存到文件
    saveMoviesToFile(movieSessions);

    res.json({
      success: true,
      message: `电影场次删除成功，已清理相关预订和投票数据`,
      data: {
        deletedSession,
        totalBookingsCleared,
        totalWaitlistCleared,
        message: `已清理 ${totalBookingsCleared} 条相关预订记录，${totalWaitlistCleared} 条投票记录`
      }
    });

  } catch (error) {
    console.error('删除电影场次错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 验证是否可以预订场次
router.post('/sessions/:id/validate-booking', (req, res) => {
  try {
    const { id } = req.params;
    const session = movieSessions.find(s => s.id === parseInt(id));
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '电影场次不存在'
      });
    }

    const canBook = canBookSession(session);
    const now = new Date();
    const bookingOpenTime = new Date(session.booking_open_time);
    
    if (!canBook) {
      return res.status(400).json({
        success: false,
        message: '预约时间未到，无法预订',
        data: {
          canBook: false,
          currentTime: now.toISOString(),
          bookingOpenTime: session.booking_open_time,
          timeRemaining: Math.max(0, bookingOpenTime.getTime() - now.getTime())
        }
      });
    }

    res.json({
      success: true,
      message: '可以预订',
      data: {
        canBook: true,
        currentTime: now.toISOString(),
        bookingOpenTime: session.booking_open_time
      }
    });

  } catch (error) {
    console.error('验证预订错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = {
  router,
  getSessionById
};
