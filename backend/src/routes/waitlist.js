const express = require('express');
const jwt = require('jsonwebtoken');
const { 
  joinWaitlist, 
  leaveWaitlist, 
  getSessionWaitlist, 
  getSessionWaitlistCount, 
  isUserInWaitlist,
  clearSessionWaitlist
} = require('../models/waitlist');

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

// 加入候补
router.post('/join', authenticateToken, (req, res) => {
  try {
    const { session_id } = req.body;
    const userId = req.user.userId;
    const userAccount = req.user.account || 'unknown';
    const userUsername = req.user.username || 'unknown';
    
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: '场次ID不能为空'
      });
    }
    
    // 检查用户是否已经在该场次预订了座位
    const { userBookings } = require('../models/bookings');
    const userBookingsList = userBookings[userId] || [];
    const hasBookedSeats = userBookingsList.some(booking => 
      booking.session_id === parseInt(session_id) && 
      booking.status === 'active'
    );
    
    if (hasBookedSeats) {
      return res.status(400).json({
        success: false,
        message: '您已经预订了该场次的座位，无需加入候补'
      });
    }
    
    // 加入候补
    const result = joinWaitlist(session_id, userId, userAccount, userUsername);
    
    if (result.success) {
      // 获取最新的候补统计
      const waitlistCount = getSessionWaitlistCount(session_id);
      const userInWaitlist = isUserInWaitlist(session_id, userId);
      
      res.json({
        success: true,
        message: result.message,
        data: {
          waitlist_count: waitlistCount,
          user_in_waitlist: userInWaitlist
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('加入候补错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 离开候补
router.delete('/leave', authenticateToken, (req, res) => {
  try {
    const { session_id } = req.body;
    const userId = req.user.userId;
    
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: '场次ID不能为空'
      });
    }
    
    // 离开候补
    const result = leaveWaitlist(session_id, userId);
    
    if (result.success) {
      // 获取最新的候补统计
      const waitlistCount = getSessionWaitlistCount(session_id);
      const userInWaitlist = isUserInWaitlist(session_id, userId);
      
      res.json({
        success: true,
        message: result.message,
        data: {
          waitlist_count: waitlistCount,
          user_in_waitlist: userInWaitlist
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('离开候补错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取场次候补信息
router.get('/sessions/:sessionId', authenticateToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;
    
    // 获取候补列表
    const waitlist = getSessionWaitlist(sessionId);
    
    // 检查当前用户是否在候补中
    const userInWaitlist = isUserInWaitlist(sessionId, userId);
    
    // 获取候补人数
    const waitlistCount = getSessionWaitlistCount(sessionId);
    
    res.json({
      success: true,
      data: {
        waitlist_count: waitlistCount,
        user_in_waitlist: userInWaitlist,
        waitlist: waitlist
      }
    });
    
  } catch (error) {
    console.error('获取候补信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 检查用户候补状态
router.get('/status/:sessionId', authenticateToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;
    
    // 检查用户是否在候补中
    const userInWaitlist = isUserInWaitlist(sessionId, userId);
    
    // 获取候补人数
    const waitlistCount = getSessionWaitlistCount(sessionId);
    
    res.json({
      success: true,
      data: {
        waitlist_count: waitlistCount,
        user_in_waitlist: userInWaitlist
      }
    });
    
  } catch (error) {
    console.error('检查候补状态错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 清理指定场次的所有投票数据（仅管理员）
router.delete('/clear-session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: '场次ID不能为空'
      });
    }
    
    // 清理该场次的所有投票数据
    const clearedCount = clearSessionWaitlist(sessionId);
    
    res.json({
      success: true,
      message: `已清理场次${sessionId}的投票数据`,
      data: {
        session_id: parseInt(sessionId),
        cleared_count: clearedCount
      }
    });
    
  } catch (error) {
    console.error('清理投票数据错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 调试接口：获取所有waitlist数据（仅管理员）
router.get('/debug/all', (req, res) => {
  try {
    const { waitlistEntries } = require('../models/waitlist');
    
    res.json({
      success: true,
      message: '获取调试信息成功',
      data: {
        total_entries: waitlistEntries.length,
        entries: waitlistEntries,
        waiting_entries: waitlistEntries.filter(entry => entry.status === 'waiting'),
        cancelled_entries: waitlistEntries.filter(entry => entry.status === 'cancelled')
      }
    });
    
  } catch (error) {
    console.error('获取调试信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
