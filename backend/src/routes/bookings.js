const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { 
  userBookings, 
  clearSessionBookings, 
  getUserBookings, 
  addUserBooking, 
  getSessionBookings, 
  getSessionSeats, 
  atomicReserveSeats 
} = require('../models/bookings');

// 数据文件路径
const BOOKINGS_FILE = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) + '/bookings.json' : '/app/data/bookings.json';

// 保存预订数据到文件
const saveBookingsToFile = (bookingsData) => {
  try {
    const dir = path.dirname(BOOKINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookingsData, null, 2), 'utf8');
    console.log('预订数据已保存到文件');
  } catch (error) {
    console.error('保存预订数据失败:', error);
  }
};

const router = express.Router();

// 验证JWT token的中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '访问令牌缺失'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '访问令牌无效'
      });
    }
    req.user = decoded;
    next();
  });
};

// 获取用户预订信息
router.get('/user', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userBookingsList = getUserBookings(userId);
    
    res.json({
      success: true,
      data: userBookingsList
    });
  } catch (error) {
    console.error('获取用户预订信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取场次座位预订信息
router.get('/sessions/:sessionId/seats', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const allBookedSeats = getSessionSeats(parseInt(sessionId));
    
    res.json({
      success: true,
      data: {
        seats: allBookedSeats
      }
    });
  } catch (error) {
    console.error('获取场次座位信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 创建预订
router.post('/', authenticateToken, (req, res) => {
  try {
    const { session_id, seats } = req.body;
    const userId = req.user.userId;
    
    if (!session_id || !seats || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        success: false,
        message: '预订信息不完整'
      });
    }
    
    // 🚨 新增：服务器端时间验证（防止客户端时间篡改）
    const { getSessionById } = require('../routes/movies');
    const session = getSessionById(session_id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '电影场次不存在'
      });
    }
    
    // 🚨 服务器端验证预约开放时间（防止客户端时间篡改）
    const serverNow = new Date();
    const bookingOpenTime = new Date(session.booking_open_time);
    
    // 安全日志：记录时间验证操作
    console.log(`[安全验证] 用户${userId}尝试预订场次${session_id}:`, {
      serverTime: serverNow.toISOString(),
      bookingOpenTime: session.booking_open_time,
      parsedBookingOpenTime: bookingOpenTime.toISOString(),
      timeDifference: bookingOpenTime.getTime() - serverNow.getTime()
    });
    
    // 额外验证：确保时间格式有效
    if (isNaN(bookingOpenTime.getTime())) {
      console.log(`[安全警告] 场次${session_id}的预约开放时间格式无效:`, session.booking_open_time);
      return res.status(400).json({
        success: false,
        message: '预约开放时间格式无效'
      });
    }
    
    if (serverNow < bookingOpenTime) {
      const timeRemaining = Math.ceil((bookingOpenTime.getTime() - serverNow.getTime()) / (1000 * 60 * 60));
      const minutesRemaining = Math.ceil((bookingOpenTime.getTime() - serverNow.getTime()) / (1000 * 60));
      
      let timeMessage = '';
      if (timeRemaining > 0) {
        timeMessage = `还有${timeRemaining}小时`;
      } else {
        timeMessage = `还有${minutesRemaining}分钟`;
      }
      
      console.log(`[安全阻止] 用户${userId}尝试在预约未开放时预订场次${session_id}:`, {
        serverTime: serverNow.toISOString(),
        bookingOpenTime: session.booking_open_time,
        timeRemaining: timeRemaining > 0 ? timeRemaining : minutesRemaining,
        timeUnit: timeRemaining > 0 ? '小时' : '分钟'
      });
      
      return res.status(400).json({
        success: false,
        message: `预约还未开放，${timeMessage}`,
        data: {
          currentTime: serverNow.toISOString(),
          bookingOpenTime: session.booking_open_time,
          timeRemaining: timeRemaining > 0 ? timeRemaining : minutesRemaining,
          timeUnit: timeRemaining > 0 ? '小时' : '分钟'
        }
      });
    }
    
    // 🚨 服务器端验证电影是否已开场（防止客户端时间篡改）
    const sessionStartTime = new Date(session.startTime || `${session.date}T${session.time}`);
    
    // 额外验证：确保时间格式有效
    if (isNaN(sessionStartTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: '电影开始时间格式无效'
      });
    }
    
    if (serverNow >= sessionStartTime) {
      return res.status(400).json({
        success: false,
        message: '电影已经开始，无法预订座位',
        data: {
          currentTime: serverNow.toISOString(),
          sessionStartTime: sessionStartTime.toISOString()
        }
      });
    }
    
    // 确保用户有预订记录数组
    if (!userBookings[userId]) {
      userBookings[userId] = [];
    }
    
    // 检查用户在该场次是否已经预订了座位
    const existingUserBookings = userBookings[userId].filter(booking => 
      booking.session_id === parseInt(session_id) && 
      booking.status === 'active'
    );
    
    // 计算用户在该场次已预订的座位总数
    let totalExistingSeats = 0;
    existingUserBookings.forEach(booking => {
      if (booking.seats && Array.isArray(booking.seats)) {
        totalExistingSeats += booking.seats.length;
      }
    });
    
    // 检查是否超过每场电影最多4个座位的限制
    if (totalExistingSeats + seats.length > 4) {
      return res.status(400).json({
        success: false,
        message: `每场电影最多只能预订4个座位，您已预订${totalExistingSeats}个，本次最多可预订${4 - totalExistingSeats}个`
      });
    }
    
    // 使用原子性预订机制，防止并发问题
    const result = atomicReserveSeats(session_id, seats, userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    res.status(201).json({
      success: true,
      message: `预订成功！共预订${seats.length}个座位`,
      data: result.data
    });
    
  } catch (error) {
    console.error('创建预订错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 取消预订
router.post('/cancel', authenticateToken, (req, res) => {
  try {
    const { booking_id } = req.body;
    const userId = req.user.userId;
    
    // 确保用户有预订记录数组
    if (!userBookings[userId]) {
      return res.status(404).json({
        success: false,
        message: '预订记录不存在'
      });
    }
    
    const bookingIndex = userBookings[userId].findIndex(booking => 
      booking.id === parseInt(booking_id)
    );
    
    if (bookingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '预订记录不存在'
      });
    }
    
    const booking = userBookings[userId][bookingIndex];
    
    // 🚨 新增：服务器端时间验证（防止开场后取消）
    const { getSessionById } = require('../routes/movies');
    const session = getSessionById(booking.session_id);
    
    if (session) {
      // 服务器端验证电影是否已开场
      const serverNow = new Date();
      const sessionStartTime = new Date(session.startTime || `${session.date}T${session.time}`);
      
      if (serverNow >= sessionStartTime) {
        return res.status(400).json({
          success: false,
          message: '电影已经开始，无法取消预订'
        });
      }
    }
    
    // 更新预订状态为已取消
    userBookings[userId][bookingIndex].status = 'cancelled';
    userBookings[userId][bookingIndex].cancelled_at = new Date().toISOString();
    
    res.json({
      success: true,
      message: '预订已取消，座位已释放',
      data: {
        booking_id: booking.id,
        cancelled_seats: booking.seats
      }
    });
    
  } catch (error) {
    console.error('取消预订错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 取消指定座位（部分取消）
router.post('/cancel-seats', authenticateToken, (req, res) => {
  try {
    const { booking_id, seats } = req.body;
    const userId = req.user.userId;
    
    // 确保用户有预订记录数组
    if (!userBookings[userId]) {
      return res.status(404).json({
        success: false,
        message: '预订记录不存在'
      });
    }
    
    const bookingIndex = userBookings[userId].findIndex(booking => 
      booking.id === parseInt(booking_id)
    );
    
    if (bookingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '预订记录不存在'
      });
    }
    
    const booking = userBookings[userId][bookingIndex];
    
    // 🚨 新增：服务器端时间验证（防止开场后取消）
    const { getSessionById } = require('../routes/movies');
    const session = getSessionById(booking.session_id);
    
    if (session) {
      // 服务器端验证电影是否已开场
      const serverNow = new Date();
      const sessionStartTime = new Date(session.startTime || `${session.date}T${session.time}`);
      
      if (serverNow >= sessionStartTime) {
        return res.status(400).json({
          success: false,
          message: '电影已经开始，无法取消预订'
        });
      }
    }
    
    // 验证要取消的座位是否属于该预订
    const seatsToCancel = seats.filter(seat => 
      booking.seats.some(bookedSeat => 
        bookedSeat.row === seat.row && bookedSeat.col === seat.col
      )
    );
    
    if (seatsToCancel.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有找到要取消的座位'
      });
    }
    
    // 从预订中移除要取消的座位
    const remainingSeats = booking.seats.filter(seat => 
      !seatsToCancel.some(cancelSeat => 
        cancelSeat.row === seat.row && cancelSeat.col === seat.col
      )
    );
    
    if (remainingSeats.length === 0) {
      // 如果所有座位都被取消，则直接删除整个预订记录
      userBookings[userId].splice(bookingIndex, 1);
      console.log(`用户${userId}的预订${booking.id}已完全取消，记录已删除`);
    } else {
      // 更新预订的座位列表
      userBookings[userId][bookingIndex].seats = remainingSeats;
      console.log(`用户${userId}的预订${booking.id}部分取消，剩余${remainingSeats.length}个座位`);
    }
    
    // 保存到文件
    saveBookingsToFile(userBookings);
    
    res.json({
      success: true,
      message: `成功取消${seatsToCancel.length}个座位`,
      data: {
        booking_id: booking.id,
        cancelled_seats: seatsToCancel,
        remaining_seats: remainingSeats,
        status: remainingSeats.length === 0 ? 'cancelled' : 'active'
      }
    });
    
  } catch (error) {
    console.error('取消座位错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取场次预订信息
router.get('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const allBookedSeats = getSessionBookings(parseInt(sessionId));
    
    res.json({
      success: true,
      data: allBookedSeats
    });
  } catch (error) {
    console.error('获取场次预订信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
